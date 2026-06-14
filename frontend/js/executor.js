// frontend/js/executor.js

class DrawingExecutor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.shapes = []; // 存储所有的图形对象
        
        this.initCanvas();
        this.bindResize();
    }

    initCanvas() {
        const width = this.container.offsetWidth;
        const height = this.container.offsetHeight;

        this.stage = new Konva.Stage({
            container: 'canvas-container',
            width: width,
            height: height,
        });

        this.layer = new Konva.Layer();
        this.stage.add(this.layer);
        console.log(`[DrawingExecutor] 画布初始化完成，尺寸: ${width}x${height}`);
    }

    bindResize() {
        window.addEventListener('resize', () => {
            const width = this.container.offsetWidth;
            const height = this.container.offsetHeight;
            this.stage.width(width);
            this.stage.height(height);
        });
    }

    /**
     * 批量执行指令序列
     * @param {Array<CommandItem>} commands 
     */
    executeCommands(commands) {
        if (!Array.isArray(commands)) {
            console.error("[DrawingExecutor] 指令格式错误，预期为数组", commands);
            return;
        }

        for (const cmd of commands) {
            this.executeSingleCommand(cmd);
        }
        
        this.layer.draw(); // 批量处理完后统一渲染一次
    }

    /**
     * 执行单条指令 (遵循 code-simplifier 的清晰分发原则，避免复杂嵌套)
     * @param {CommandItem} cmd 
     */
    executeSingleCommand(cmd) {
        if (!cmd || !cmd.action) return;

        switch (cmd.action) {
            case window.ParserConfig.ACTIONS.DRAW:
                this.handleDraw(cmd);
                break;
            case window.ParserConfig.ACTIONS.MODIFY:
                this.handleModify(cmd);
                break;
            case window.ParserConfig.ACTIONS.DELETE:
                this.handleDelete(cmd);
                break;
            case window.ParserConfig.ACTIONS.MOVE:
                this.handleMove(cmd);
                break;
            case window.ParserConfig.ACTIONS.CLEAR:
                this.clearCanvas();
                break;
            case window.ParserConfig.ACTIONS.UNDO:
                console.log("[DrawingExecutor] 撤销功能即将实现");
                break;
            case 'select':
            case window.ParserConfig.ACTIONS.SELECT:
                this.handleSelect(cmd);
                break;
            default:
                console.warn(`[DrawingExecutor] 尚未支持的 Action: ${cmd.action}`);
        }
    }

    /**
     * 处理绘制动作
     */
    handleDraw(cmd) {
        const shapeType = cmd.shape;
        const props = cmd.props || {};
        
        // 只有当 shape 是 circle/ellipse/rect/text 且确实没给坐标时才用画布中心兜底
        if ((shapeType === 'circle' || shapeType === 'ellipse' || shapeType === 'rect' || shapeType === 'text') && props.x === undefined && props.y === undefined) {
            const offsetX = (Math.random() - 0.5) * 60; // 偏移范围 -30 到 30
            const offsetY = (Math.random() - 0.5) * 60;
            props.x = (this.stage.width() / 2) + offsetX;
            props.y = (this.stage.height() / 2) + offsetY;
        }

        this.drawShape(shapeType, props);
    }

    /**
     * 处理修改动作
     */
    handleModify(cmd) {
        let targets = this.getTargetShape(cmd.target);
        if (!targets) {
            console.warn("[DrawingExecutor] 找不到可修改的目标图形");
            return;
        }
        if (!Array.isArray(targets)) targets = [targets];

        const props = cmd.props || {};
        targets.forEach(targetShape => {
            if (props.color) {
                if (targetShape.getClassName() === 'Line' || targetShape.getClassName() === 'Text') {
                    if (targetShape.getClassName() === 'Line' && !targetShape.closed()) {
                        targetShape.stroke(props.color);
                    } else {
                        targetShape.fill(props.color);
                    }
                } else {
                    targetShape.fill(props.color);
                }
            }
            
            if (props.radius && targetShape.getClassName() === 'Circle') {
                targetShape.radius(props.radius);
            }
            if (props.width && targetShape.getClassName() === 'Rect') {
                targetShape.width(props.width);
            }
            if (props.height && targetShape.getClassName() === 'Rect') {
                targetShape.height(props.height);
            }
            
            // 支持大模型可能给出的 scale 相对缩放
            if (props.scale !== undefined) {
                targetShape.scale({ x: props.scale, y: props.scale });
            } else if (props.scaleX !== undefined || props.scaleY !== undefined) {
                targetShape.scale({
                    x: props.scaleX !== undefined ? props.scaleX : targetShape.scaleX(),
                    y: props.scaleY !== undefined ? props.scaleY : targetShape.scaleY()
                });
            }

            this.highlightShape(targetShape);
        });
    }

    /**
     * 处理删除动作
     */
    handleDelete(cmd) {
        let targets = this.getTargetShape(cmd.target);
        if (!targets) {
            console.warn("[DrawingExecutor] 找不到可删除的目标图形");
            return;
        }
        if (!Array.isArray(targets)) targets = [targets];

        targets.forEach(targetShape => {
            targetShape.destroy();
            this.shapes = this.shapes.filter(s => s !== targetShape);
        });
    }

    /**
     * 处理移动动作
     */
    handleMove(cmd) {
        let targets = this.getTargetShape(cmd.target);
        if (!targets) {
            console.warn("[DrawingExecutor] 找不到可移动的目标图形");
            return;
        }
        if (!Array.isArray(targets)) targets = [targets];

        const props = cmd.props || {};
        const dx = props.dx || 0;
        const dy = props.dy || 0;

        targets.forEach(targetShape => {
            targetShape.x(targetShape.x() + dx);
            targetShape.y(targetShape.y() + dy);
            this.highlightShape(targetShape);
        });
    }

    /**
     * 短暂高亮被操作的目标图形
     */
    highlightShape(shape) {
        const originalStroke = shape.stroke();
        const originalStrokeWidth = shape.strokeWidth();
        const originalShadowColor = shape.shadowColor();
        const originalShadowBlur = shape.shadowBlur();

        shape.stroke('#FFD700'); // 金色描边
        shape.strokeWidth((originalStrokeWidth || 0) + 2);
        shape.shadowColor('#FFD700');
        shape.shadowBlur(15);
        this.layer.draw();

        setTimeout(() => {
            shape.stroke(originalStroke);
            shape.strokeWidth(originalStrokeWidth);
            shape.shadowColor(originalShadowColor);
            shape.shadowBlur(originalShadowBlur);
            this.layer.draw();
        }, 500);
    }

    /**
     * 获取目标图形
     */
    getTargetShape(targetDef) {
        if (this.shapes.length === 0) return null;
        
        if (!targetDef || targetDef === 'last') {
            return this.shapes[this.shapes.length - 1];
        }
        if (targetDef === 'selected') {
            return this.selectedShape || this.shapes[this.shapes.length - 1];
        }
        if (targetDef === 'all') {
            return [...this.shapes];
        }
        
        // 字符串描述含颜色/形状
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            const className = shape.getClassName().toLowerCase();
            const textDef = targetDef.toLowerCase();
            if (textDef.includes('圆') && className === 'circle') return shape;
            if ((textDef.includes('方') || textDef.includes('矩形')) && className === 'rect') return shape;
            if (textDef.includes('线') && className === 'line') return shape;
            if (textDef.includes('角') && className === 'line' && shape.points().length === 6) return shape; // triangle
            if (textDef.includes('字') && className === 'text') return shape;
            if (textDef.includes('椭圆') && className === 'ellipse') return shape;
        }

        return this.shapes[this.shapes.length - 1];
    }

    /**
     * 处理选中动作
     */
    handleSelect(cmd) {
        const targetShape = this.getTargetShape(cmd.target);
        if (!targetShape) {
            console.warn("[DrawingExecutor] 找不到可选中的目标图形");
            return;
        }
        const shape = Array.isArray(targetShape) ? targetShape[targetShape.length - 1] : targetShape;
        this.selectedShape = shape;
        this.highlightShape(shape);
    }

    /**
     * 基础图形绘制（供内部与 Console 测试调用）
     */
    drawShape(shapeType, props) {
        let shape;
        const commonProps = { draggable: true };

        switch(shapeType) {
            case 'circle':
                shape = new Konva.Circle({
                    x: props.x, y: props.y, radius: props.radius || 40,
                    fill: props.color || '#3B82F6', ...commonProps
                });
                break;
            case 'rect':
                shape = new Konva.Rect({
                    x: props.x, y: props.y,
                    width: props.width || 80, height: props.height || 80,
                    fill: props.color || '#10B981', ...commonProps
                });
                break;
            case 'line':
                let points = [];
                if (props.x1 !== undefined && props.y1 !== undefined && props.x2 !== undefined && props.y2 !== undefined) {
                    points = [props.x1, props.y1, props.x2, props.y2];
                } else if (props.points) {
                    points = props.points;
                } else {
                    points = [props.x || 0, props.y || 0, (props.x || 0) + 100, props.y || 0];
                }
                shape = new Konva.Line({
                    points: points,
                    stroke: props.color || '#000000', strokeWidth: props.strokeWidth || 4, ...commonProps
                });
                break;
            case 'triangle':
                let triPoints = [];
                if (props.points && props.points.length >= 6) {
                    triPoints = props.points;
                } else {
                    const cx = props.x || 100;
                    const cy = props.y || 100;
                    const size = props.size || 80;
                    triPoints = [
                        cx, cy - size / 2,
                        cx - size / 2, cy + size / 2,
                        cx + size / 2, cy + size / 2
                    ];
                }
                shape = new Konva.Line({
                    points: triPoints,
                    fill: props.color || '#F59E0B',
                    closed: true,
                    stroke: '#000000',
                    strokeWidth: props.strokeWidth || 2,
                    ...commonProps
                });
                break;
            case 'text':
                shape = new Konva.Text({
                    x: props.x || 100, y: props.y || 100,
                    text: props.text || '文本',
                    fontSize: props.fontSize || 24,
                    fill: props.color || '#000000',
                    ...commonProps
                });
                break;
            case 'ellipse':
                shape = new Konva.Ellipse({
                    x: props.x || 100, y: props.y || 100,
                    radiusX: props.radiusX || 50, radiusY: props.radiusY || 30,
                    fill: props.color || '#8B5CF6',
                    ...commonProps
                });
                break;
            default:
                console.warn(`[DrawingExecutor] 未知图形: ${shapeType}`);
                return;
        }

        shape.on('mouseenter', () => this.stage.container().style.cursor = 'pointer');
        shape.on('mouseleave', () => this.stage.container().style.cursor = 'default');

        this.layer.add(shape);
        this.shapes.push(shape);
        console.log(`[DrawingExecutor] 绘制成功: ${shapeType}`);
    }
    
    clearCanvas() {
        this.layer.destroyChildren();
        this.shapes = [];
        this.layer.draw();
        console.log(`[DrawingExecutor] 画布已清空`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.executor = new DrawingExecutor('canvas-container');
    window.drawShape = window.executor.drawShape.bind(window.executor);
    window.clearCanvas = window.executor.clearCanvas.bind(window.executor);
    console.log("[DrawingExecutor] 引擎实例 window.executor 已挂载");
});

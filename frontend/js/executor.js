// frontend/js/executor.js

class DrawingExecutor {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.shapes = []; // 存储所有的图形对象
        this.undoStack = [];
        this.redoStack = [];
        
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

    saveSnapshot() {
        // 保存当前画布中所有图形的 JSON 快照
        const snapshot = this.shapes.map(shape => shape.toJSON());
        this.undoStack.push(snapshot);
        if (this.undoStack.length > 30) {
            this.undoStack.shift(); // 限制栈深度防内存膨胀
        }
        this.redoStack = []; // 发生新操作时，清空重做栈
    }

    restoreSnapshot(snapshot) {
        this.layer.destroyChildren();
        this.shapes = [];
        this.selectedShape = null;

        snapshot.forEach(jsonStr => {
            const shape = Konva.Node.create(jsonStr);
            // 重新绑定事件
            shape.on('mouseenter', () => this.stage.container().style.cursor = 'pointer');
            shape.on('mouseleave', () => this.stage.container().style.cursor = 'default');
            this.layer.add(shape);
            this.shapes.push(shape);
        });
        
        this.layer.draw();
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

        const modifyActions = [
            window.ParserConfig.ACTIONS.DRAW,
            window.ParserConfig.ACTIONS.MODIFY,
            window.ParserConfig.ACTIONS.DELETE,
            window.ParserConfig.ACTIONS.MOVE,
            window.ParserConfig.ACTIONS.CLEAR
        ];
        
        const hasModification = commands.some(cmd => modifyActions.includes(cmd.action));
        if (hasModification) {
            this.saveSnapshot();
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
                this.handleUndo();
                break;
            case window.ParserConfig.ACTIONS.REDO:
                this.handleRedo();
                break;
            case 'select':
            case window.ParserConfig.ACTIONS.SELECT:
                this.handleSelect(cmd);
                break;
            case window.ParserConfig.ACTIONS.CLARIFY:
                console.log(`[DrawingExecutor] 收到澄清请求 (Clarify)，停止执行绘制操作`);
                const statusText = document.getElementById('status-text');
                if (statusText) {
                    statusText.textContent = "🤔 需要补充细节 (请看回复)";
                    statusText.style.color = "orange";
                }
                break;
            default:
                console.warn(`[DrawingExecutor] 尚未支持的 Action: ${cmd.action}`);
        }
    }

    handleUndo() {
        if (this.undoStack.length === 0) {
            console.log("[DrawingExecutor] 撤销栈为空，无法撤销");
            return;
        }
        const currentSnapshot = this.shapes.map(shape => shape.toJSON());
        this.redoStack.push(currentSnapshot);
        
        const previousSnapshot = this.undoStack.pop();
        this.restoreSnapshot(previousSnapshot);
        console.log(`[DrawingExecutor] 撤销成功`);
    }

    handleRedo() {
        if (this.redoStack.length === 0) {
            console.log("[DrawingExecutor] 重做栈为空，无法重做");
            return;
        }
        const currentSnapshot = this.shapes.map(shape => shape.toJSON());
        this.undoStack.push(currentSnapshot);
        
        const nextSnapshot = this.redoStack.pop();
        this.restoreSnapshot(nextSnapshot);
        console.log(`[DrawingExecutor] 重做成功`);
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
        if (targetDef === 'it') {
            // 智能指代：优先选中的，没有才用最后的
            return this.selectedShape || this.shapes[this.shapes.length - 1];
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

            // 颜色匹配辅助函数
            const matchColor = () => {
                const fill = shape.fill() || shape.stroke();
                if (!fill) return true; // 无颜色信息时忽略颜色匹配
                const fillLower = fill.toLowerCase();
                // 简化匹配：常见颜色关键词
                if (textDef.includes('红') && (fillLower.includes('f4') || fillLower.includes('e4') || fillLower.includes('ff0'))) return true;
                if (textDef.includes('蓝') && (fillLower.includes('3b8') || fillLower.includes('82f6') || fillLower.includes('00f'))) return true;
                if (textDef.includes('绿') && (fillLower.includes('10b') || fillLower.includes('b981') || fillLower.includes('0f0'))) return true;
                if (textDef.includes('黄') && (fillLower.includes('f59') || fillLower.includes('ffa5') || fillLower.includes('9e0b') || fillLower.includes('ff0'))) return true;
                if (textDef.includes('黑') && (fillLower.includes('000') || fillLower.includes('1e2'))) return true;
                if (textDef.includes('白') && fillLower.includes('fff')) return true;
                if (textDef.includes('紫') && (fillLower.includes('8b5') || fillLower.includes('5cf6'))) return true;
                return !(/红|蓝|绿|黄|黑|白|紫/.test(textDef)); // 描述无颜色词时忽略
            };

            if (textDef.includes('圆') && className === 'circle' && matchColor()) return shape;
            if ((textDef.includes('方') || textDef.includes('矩形')) && className === 'rect' && matchColor()) return shape;
            if (textDef.includes('椭圆') && className === 'ellipse' && matchColor()) return shape;
            // 线和文字保持原样
            if (textDef.includes('线') && className === 'line') return shape;
            if (textDef.includes('角') && className === 'line' && shape.points().length === 6) return shape; // triangle
            if (textDef.includes('字') && className === 'text') return shape;
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

    /**
     * 获取画布当前状态，供LLM上下文使用
     * @returns {Object} 画布状态摘要
     */
    getCanvasContext() {
        const context = {
            totalShapes: this.shapes.length,
            shapes: this.shapes.map((shape, index) => {
                const info = {
                    index: index + 1,
                    type: shape.getClassName().toLowerCase(),
                    color: shape.fill() || shape.stroke() || 'unknown'
                };

                // 标记选中状态
                if (this.selectedShape === shape) {
                    info.isSelected = true;
                }

                // 标记最后一个
                if (index === this.shapes.length - 1) {
                    info.isLast = true;
                }

                return info;
            }),
            hasSelected: !!this.selectedShape
        };

        return context;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.executor = new DrawingExecutor('canvas-container');
    window.drawShape = window.executor.drawShape.bind(window.executor);
    window.clearCanvas = window.executor.clearCanvas.bind(window.executor);
    console.log("[DrawingExecutor] 引擎实例 window.executor 已挂载");
});

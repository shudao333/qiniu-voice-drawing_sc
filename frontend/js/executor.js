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

    /**
     * 处理绘制动作
     */
    handleDraw(cmd) {
        const shapeType = cmd.shape;
        const props = cmd.props || {};
        
        // 默认坐标为画布中心，并加上轻微随机偏移量以防重叠
        if (props.x === undefined || props.y === undefined) {
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
        const targetShape = this.getTargetShape(cmd.target);
        if (!targetShape) {
            console.warn("[DrawingExecutor] 找不到可修改的目标图形");
            return;
        }

        const props = cmd.props || {};
        if (props.color) {
            if (targetShape.getClassName() === 'Line') {
                targetShape.stroke(props.color);
            } else {
                targetShape.fill(props.color);
            }
        }
    }

    /**
     * 处理删除动作
     */
    handleDelete(cmd) {
        const targetShape = this.getTargetShape(cmd.target);
        if (!targetShape) {
            console.warn("[DrawingExecutor] 找不到可删除的目标图形");
            return;
        }

        targetShape.destroy();
        this.shapes = this.shapes.filter(s => s !== targetShape);
    }

    /**
     * 处理移动动作
     */
    handleMove(cmd) {
        const targetShape = this.getTargetShape(cmd.target);
        if (!targetShape) {
            console.warn("[DrawingExecutor] 找不到可移动的目标图形");
            return;
        }

        const props = cmd.props || {};
        const dx = props.dx || 0;
        const dy = props.dy || 0;

        targetShape.x(targetShape.x() + dx);
        targetShape.y(targetShape.y() + dy);
    }

    /**
     * 获取目标图形
     */
    getTargetShape(targetDef) {
        if (this.shapes.length === 0) return null;
        
        // 简化版：当前统一当做 'last'（最后绘制的图形）处理
        return this.shapes[this.shapes.length - 1];
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
                    x: props.x - (props.width || 80) / 2, y: props.y - (props.height || 80) / 2,
                    width: props.width || 80, height: props.height || 80,
                    fill: props.color || '#10B981', ...commonProps
                });
                break;
            case 'line':
                shape = new Konva.Line({
                    points: props.points || [props.x, props.y, props.x + 100, props.y],
                    stroke: props.color || '#000000', strokeWidth: 4, ...commonProps
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

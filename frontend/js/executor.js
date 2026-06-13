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
     * 测试函数，供 Console 直接调用
     * 示例: drawShape('circle', {x: 200, y: 200, radius: 50, color: 'red'})
     */
    drawShape(shapeType, props) {
        let shape;
        const commonProps = {
            draggable: true,
        };

        if (!props.x || !props.y) {
            props.x = this.stage.width() / 2;
            props.y = this.stage.height() / 2;
        }

        switch(shapeType) {
            case 'circle':
                shape = new Konva.Circle({
                    x: props.x,
                    y: props.y,
                    radius: props.radius || 40,
                    fill: props.color || '#3B82F6',
                    ...commonProps
                });
                break;
            case 'rect':
                shape = new Konva.Rect({
                    x: props.x - (props.width || 80) / 2,
                    y: props.y - (props.height || 80) / 2,
                    width: props.width || 80,
                    height: props.height || 80,
                    fill: props.color || '#10B981',
                    ...commonProps
                });
                break;
            case 'line':
                shape = new Konva.Line({
                    points: props.points || [props.x, props.y, props.x + 100, props.y],
                    stroke: props.color || '#000000',
                    strokeWidth: 4,
                    ...commonProps
                });
                break;
            default:
                console.warn(`[DrawingExecutor] 未知图形: ${shapeType}`);
                return;
        }

        // 添加悬浮交互，符合 ui-ux-pro-max: "cursor-pointer on all clickable elements"
        shape.on('mouseenter', () => {
            this.stage.container().style.cursor = 'pointer';
        });
        shape.on('mouseleave', () => {
            this.stage.container().style.cursor = 'default';
        });

        this.layer.add(shape);
        this.shapes.push(shape);
        this.layer.draw();
        console.log(`[DrawingExecutor] 绘制成功: ${shapeType}`, props);
    }
    
    clearCanvas() {
        this.layer.destroyChildren();
        this.shapes = [];
        this.layer.draw();
        console.log(`[DrawingExecutor] 画布已清空`);
    }
}

// 暴露到全局供调试
let executor;
document.addEventListener('DOMContentLoaded', () => {
    executor = new DrawingExecutor('canvas-container');
    window.drawShape = executor.drawShape.bind(executor);
    window.clearCanvas = executor.clearCanvas.bind(executor);
    console.log("[DrawingExecutor] 全局测试方法 window.drawShape 已挂载");
});

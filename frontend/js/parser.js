// frontend/js/parser.js

/**
 * 统一指令契约常量与 JSDoc 类型定义
 * 保证前后端数据结构一致性 (依据实施方案 3.1)
 */

/**
 * 支持的 Action 动作枚举
 * @enum {string}
 */
const ACTIONS = {
    DRAW: 'draw',
    MODIFY: 'modify',
    MOVE: 'move',
    DELETE: 'delete',
    UNDO: 'undo',
    REDO: 'redo',
    CLEAR: 'clear',
    SELECT: 'select',
    GROUP: 'group',
    CLARIFY: 'clarify' // 容错时用于反问
};

/**
 * 支持的目标对象枚举
 * @enum {string}
 */
const TARGETS = {
    LAST: 'last',
    SELECTED: 'selected',
    ALL: 'all',
    IT: 'it'
};

/**
 * @typedef {Object} CommandProps
 * @property {number} [x] - 中心点 X 坐标
 * @property {number} [y] - 中心点 Y 坐标
 * @property {number} [dx] - X 方向位移量
 * @property {number} [dy] - Y 方向位移量
 * @property {number} [radius] - 半径 (圆)
 * @property {number} [width] - 宽度 (矩形)
 * @property {number} [height] - 高度 (矩形)
 * @property {string} [color] - 颜色 (Hex 格式)
 * @property {number[]} [points] - 坐标点集合 (线)
 */

/**
 * @typedef {Object} CommandItem
 * @property {string} action - 动作名称, 参考 ACTIONS
 * @property {string} [shape] - 图形类型 ('circle', 'rect', 'line' 等)
 * @property {string} [target] - 操作目标 ('last', 'selected', 'all' 或具体描述)
 * @property {CommandProps} [props] - 具体的属性参数
 */

/**
 * @typedef {Object} CommandResponse
 * @property {CommandItem[]} commands - 需要按序执行的指令序列
 * @property {string} reply - 给用户的文本/语音反馈
 */

// 供后续 parser 模块使用的基础空对象
window.ParserConfig = {
    ACTIONS,
    TARGETS
};

/**
 * 纯本地规则解析器
 * 基于关键词和正则表达式，实现低延迟的指令转换。
 * 无法处理的复杂语句将返回 null，以便由大模型兜底。
 */
class LocalParser {
    constructor() {
        this.synonyms = {
            shape: {
                '圆': 'circle', '圆形': 'circle', '圈': 'circle',
                '方块': 'rect', '方形': 'rect', '矩形': 'rect', '长方形': 'rect', '正方形': 'rect',
                '线': 'line', '直线': 'line', '线条': 'line'
            },
            color: {
                '红': '#EF4444', '红色': '#EF4444',
                '蓝': '#3B82F6', '蓝色': '#3B82F6',
                '绿': '#10B981', '绿色': '#10B981',
                '黄': '#F59E0B', '黄色': '#F59E0B',
                '黑': '#1E293B', '黑色': '#1E293B',
                '白': '#FFFFFF', '白色': '#FFFFFF',
                '紫': '#8B5CF6', '紫色': '#8B5CF6'
            }
        };
    }

    /**
     * 将自然语言转化为结构化指令 (Local 优先)
     * @param {string} text 
     * @returns {CommandItem|null}
     */
    parse(text) {
        if (!text || typeof text !== 'string') return null;
        // 去除所有的中英文标点符号以及两端空格
        text = text.replace(/[。，！？.,!?]/g, '').trim();

        try {
            // 1. 拦截完全无法处理的极短文本或防呆
            if (text.length < 1) return null;
            
            // 1.5 限制本地解析的‘贪心拦截’：长难句和相对位置指令强制降级给大模型
            if (text.length > 15) {
                console.log("[LocalParser] 文本超过 15 字符，强制降级 LLM");
                return null;
            }
            // 【强制拦截规则】如果包含复杂的连词或介词，直接交给大模型处理
            const complexKeywords = ['然后', '最后', '里面', '旁边', '和'];
            if (complexKeywords.some(keyword => text.includes(keyword))) {
                console.log("[LocalParser] 包含复杂位置或逻辑词汇，强制降级 LLM");
                return null;
            }

            // 2. 匹配"清空"
            if (/清空|重置/.test(text)) {
                return { action: ACTIONS.CLEAR };
            }

            // 3. 匹配"撤销"和"重做"
            if (/撤销|上一步/.test(text)) {
                return { action: ACTIONS.UNDO };
            }
            if (/重做|下一步|恢复/.test(text)) {
                return { action: ACTIONS.REDO };
            }

            // 4. 匹配画图 "画一个红色的圆" 或 "画一个圈"
            // 支持模式: (画|来|搞)一个(颜色)的(形状)
            let drawMatch = text.match(/(画|来|搞|弄)一个?(.*)?(红|蓝|绿|黄|黑|白|紫)色的?(圆|圆形|圈|方块|方形|矩形|长方形|正方形|线|直线)/);
            if (!drawMatch) {
                // 如果没有颜色匹配，尝试单纯匹配形状
                drawMatch = text.match(/(画|来|搞|弄)一个?(圆|圆形|圈|方块|方形|矩形|长方形|正方形|线|直线)/);
                if (drawMatch) {
                    const shapeKey = drawMatch[2];
                    return {
                        action: ACTIONS.DRAW,
                        shape: this.synonyms.shape[shapeKey],
                        props: {}
                    };
                }
            } else {
                const colorKey = drawMatch[3];
                const shapeKey = drawMatch[4];
                return {
                    action: ACTIONS.DRAW,
                    shape: this.synonyms.shape[shapeKey],
                    props: { color: this.synonyms.color[colorKey] }
                };
            }

            // 5. 匹配修改颜色 "涂成红色" / "把它变成蓝色"
            const modifyMatch = text.match(/(把它)?(涂成|改成|变成|修改成?为?)(红|蓝|绿|黄|黑|白|紫)色?/);
            if (modifyMatch) {
                const hasIt = modifyMatch[1];
                const colorKey = modifyMatch[3];
                return {
                    action: ACTIONS.MODIFY,
                    target: hasIt ? TARGETS.IT : TARGETS.LAST,
                    props: { color: this.synonyms.color[colorKey] }
                };
            }
            
            // 6. 匹配删除 "把它删了" / "删除"（仅简单指令，带描述词的交给LLM）
            const deleteMatch = text.match(/^(把它)?(删除|删了?|去掉|清除)$/);
            if (deleteMatch) {
                const hasIt = deleteMatch[1];
                return {
                    action: ACTIONS.DELETE,
                    target: hasIt ? TARGETS.IT : TARGETS.LAST
                };
            }

            // 7. 匹配移动 "向右移动一点" 或 "把它移到左边"
            const moveMatch = text.match(/(把它)?(向|移到)(上|下|左|右)(边|面|移动|移)?/);
            if (moveMatch) {
                const hasIt = moveMatch[1];
                const direction = moveMatch[3];
                let dx = 0, dy = 0;
                const step = 50; // 默认移动像素
                if (direction === '上') dy = -step;
                if (direction === '下') dy = step;
                if (direction === '左') dx = -step;
                if (direction === '右') dx = step;

                return {
                    action: ACTIONS.MOVE,
                    target: hasIt ? TARGETS.IT : TARGETS.LAST,
                    props: { dx, dy }
                };
            }

            // 无法进行本地解析，优雅返回 null，留给后续 LLM 兜底处理
            console.log(`[LocalParser] 无法匹配本地规则，返回 null 降级: "${text}"`);
            return null;

        } catch (e) {
            // 异常捕获，确保不阻断后续的大模型调用流程
            console.error("[LocalParser] 解析异常，安全返回 null:", e);
            return null;
        }
    }
}

// 暴露到全局供测试与后续组件调用
window.localParser = new LocalParser();
window.parse = window.localParser.parse.bind(window.localParser); // 便于控制台直接测试

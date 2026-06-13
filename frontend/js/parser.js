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
    ALL: 'all'
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

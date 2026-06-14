# AI 语音绘图工具 (Voice Draw)

> 七牛云 × XEngineer 暑期实训营 · 题目二
> 一个**纯语音控制**的网页绘图工具：不碰鼠标键盘，只靠说话完成画图、改色、移动、删除、撤销、画组合图形。

---

## ✨ 简介

对着麦克风说话，AI 就能听懂并在画布上作画：

- 说「画一个红色的圆」→ 瞬间画出（本地解析，零延迟）
- 说「画一只老虎」→ AI 拆解成几十个图元，一笔一笔流式画出
- 说「把它变成蓝色」「向右移动一点」→ 实时编辑
- 说「画那个」（信息不足）→ AI 反问「你想画什么形状？」，支持多轮对话补充
- 每次操作都有文字气泡 + 语音朗读反馈，形成「说话 → 看到画 → 听到确认」的闭环

核心是**两级解析架构**：常见指令走前端本地规则（零延迟零成本），复杂指令才升级到云端大模型（高覆盖）。

---

## 🛠 技术栈与依赖

| 层 | 技术 | 类型 |
| --- | --- | --- |
| 前端 | 原生 HTML / CSS / JavaScript | 原创 |
| 画布 | [Konva.js](https://konvajs.org/) 9.3.6 (CDN) | 第三方 |
| 语音识别 | Web Speech API (浏览器原生) | 原生 |
| 语音合成 | SpeechSynthesis (浏览器原生) | 原生 |
| 后端 | Python [FastAPI](https://fastapi.tiangolo.com/) + uvicorn | 第三方 |
| 大模型 | [DeepSeek](https://www.deepseek.com/)（OpenAI 兼容接口） | 第三方 |
| 模型 SDK | openai (Python) | 第三方 |
| 配置 | python-dotenv | 第三方 |

> 原创部分：全部前端逻辑（语音路由、本地解析器、执行引擎、流式作画、状态机 UI）、后端 API 与 Prompt 工程、两级解析架构与 #N 索引寻址机制。

---

## 🚀 安装与运行

### 1. 创建环境并安装依赖

```bash
conda create -n voice-draw python=3.11 -y
conda activate voice-draw
pip install -r backend/requirements.txt
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env`，填入你的 DeepSeek API Key：

```bash
cp .env.example .env
```

`.env` 内容：

```
DEEPSEEK_API_KEY=你的_deepseek_api_key
```

> ⚠️ `.env` 已被 `.gitignore` 忽略，**切勿提交真实密钥**。

### 3. 启动服务

```bash
uvicorn backend.main:app --reload
```

### 4. 打开浏览器

访问 **http://127.0.0.1:8000/**，使用 **Chrome 或 Edge**（对 Web Speech API 支持最好）。

点击麦克风按钮，允许麦克风权限，开始说话。

---

## 🎙 指令示例

| 类别 | 示例语音指令 |
| --- | --- |
| **基础绘图** | "画一个红色的圆"、"画一个蓝色的矩形"、"画一条绿色的线"、"画一个黄色的三角形" |
| **组合图案** | "画一个房子"、"画一个笑脸"、"画一只老虎"、"画一只牛"、"画一条鱼"、"画一朵花"、"画一个人" |
| **修改与移动** | "把它变成蓝色"、"向右移动一点"、"把房子往上移"、"把鱼变成红色" |
| **选中与删除** | "选中那个红色的圆"、"把圆变成绿色"、"删除"、"把它删了"、"清空画布" |
| **撤销与重做** | "撤销"、"上一步"、"重做"、"恢复" |
| **多步指令** | "画个红圆，旁边画个蓝方块"、"画三个从小到大的圆"、"画个圆，再把它变成绿色" |
| **智能容错** | "搞个蓝色方块"（口语）、"画那个"（系统会反问） |

> 界面左侧「我能听懂哪些话」面板内置了分类指令清单，可随时展开查看。

---

## 📁 目录结构

```
qiniu-voice-drawing_sc/
├── README.md              # 本文件
├── DESIGN.md              # 设计文档（能力对照、架构、决策与权衡）
├── 视频脚本.md            # Demo 录制脚本
├── .env.example           # 环境变量示例（不含真实密钥）
├── .gitignore
├── backend/
│   ├── main.py            # FastAPI 入口：路由 + 静态托管 + JSON 容错
│   ├── llm.py             # DeepSeek 封装 + Prompt 工程
│   ├── schemas.py         # Pydantic 指令结构校验
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js         # 入口：语音路由、状态机、澄清上下文
│       ├── speech.js      # 语音识别层 (Web Speech API)
│       ├── parser.js      # 本地规则解析器（低延迟）
│       ├── executor.js    # 执行引擎（操作 Konva 画布、流式作画、撤销栈）
│       ├── feedback.js    # 语音/文字反馈 (TTS)
│       └── api.js         # 调后端 LLM
└── docs/
    └── 语音绘图工具-实施方案.md
```

---

## 🎬 Demo 视频

> 待补充（录制脚本见 `视频脚本.md`）

---

## 🔒 安全说明

- API Key 仅存于本地 `.env`，已被 `.gitignore` 忽略，不进入仓库。
- 后端对大模型输出做 JSON 清洗 + Pydantic 强校验，防止非法结构。
- 用户语音文本作为数据传入，prompt 设计避免越权指令。

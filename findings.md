# Findings & Decisions

## Requirements
- 纯语音控制网页绘图工具
- 单人参赛，开发时间：2026-06-12 00:00 ～ 2026-06-14 23:59
- 评分关注：指令准确性与容错性、响应延迟、复杂指令拆解与执行能力
- 需具备自动化 Git 工作流

## Research Findings
- 七牛云平台：提供兼容 OpenAI 格式的 API (`https://api.qnaigc.com/v1`)，支持 `deepseek-v3` 等模型。
- 前端技术栈：原生 HTML/JS/CSS，Konva.js 处理 Canvas，Web Speech API 和 MediaRecorder。
- 后端技术栈：Python FastAPI + uvicorn。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 使用 FastAPI 提供后端与静态资源服务 | 减少技术栈层数，后端用最熟的 Python，快速响应前端需求 |
| 定义统一的 JSON 指令结构作为前后端契约 | 隔离前后端依赖，使两者可完全解耦开发 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- 七牛云大模型接口文档：https://developer.qiniu.com/aitokenapi

## Visual/Browser Findings
- （暂无，待后续开发时补充）

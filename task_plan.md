# Task Plan: AI 语音绘图工具开发

## Goal
做一个纯语音控制的网页绘图工具，支持通过语音指令画图、修改、撤销等，以低延迟和高容错性应对限时黑客松评选。

## Current Phase
Phase 1

## Phases

### Phase 1: 环境与基础架构 (Day 1 上午-下午)
- [x] PR0: `chore/init` - 仓库脚手架 + .gitignore + README 骨架
- [x] PR1: `feat/backend-skeleton` - FastAPI 起服务 + 健康检查 + 静态托管
- [x] PR2: `feat/speech-input` - 前端麦克风 + Web Speech 实时转文字
- [x] PR3: `feat/canvas-base` - Konva 画布 + 基础图形渲染
- **Status:** complete

### Phase 2: 核心链路闭环 (Day 1 晚 - Day 2 上午)
- [ ] PR4: `feat/command-schema` - 指令数据结构(前后端契约)
- **Status:** in_progress
- [ ] PR5: `feat/local-parser` - 本地规则解析器(画圆/方/线 + 颜色)
- [ ] PR6: `feat/executor` - 指令执行引擎(draw 落到画布)
- **Status:** pending

### Phase 3: 大模型接入与复杂交互 (Day 2 下午 - 晚)
- [ ] PR7: `feat/llm-parse` - 后端接七牛云 LLM,自然语言→指令序列
- [ ] PR8: `feat/parser-router` - 本地优先 + LLM 兜底的路由
- [ ] PR9: `feat/modify-move` - 修改属性 / 移动 / 选中图形
- [ ] PR10: `feat/undo-delete` - 撤销/重做/删除/清空
- **Status:** pending

### Phase 4: 容错与高阶功能 (Day 3 上午 - 下午)
- [ ] PR11: `feat/error-tolerance` - 容错:同义词归一 + 澄清式反问
- [ ] PR12: `feat/complex-commands` - 复杂指令拆解(组合图形/多步)
- [ ] PR13: `feat/voice-feedback` - 语音/文字反馈(TTS 可选)
- [ ] PR14: `feat/ui-polish` - 界面美化 + 指令帮助 + 状态提示
- **Status:** pending

### Phase 5: 交付与文档 (Day 3 晚)
- [ ] PR15: `docs/design-readme` - DESIGN.md + README + demo 视频链接
- **Status:** pending

## Key Questions
1. Web Speech API 在国内网络环境下是否稳定？（需在 PR2 时实测确认）
2. 怎样平衡大模型调用的延迟和正确率？（通过本地规则兜底及设置模型参数优化）

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 不使用 Node 工具链，采用纯静态前端 + FastAPI 托管 | 减少单人黑客松的环境配置负担，快速启动和部署 |
| 双通道语音解析（本地优先，LLM兜底） | 降低延迟和 API 调用成本，同时保证容错性和复杂指令支持 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       |         |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

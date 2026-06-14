// frontend/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-btn');
    const micLabel = micBtn ? micBtn.querySelector('.mic-label') : null;
    const statusText = document.getElementById('status-text');
    const resultBox = document.getElementById('result-box');
    const speechControls = document.getElementById('speech-controls');
    const canvasHint = document.getElementById('canvas-hint');

    /**
     * 更新麦克风按钮文字，但保留内部 SVG 图标（不能用 textContent 整体覆盖）。
     */
    const setMicLabel = (text) => {
        if (micLabel) micLabel.textContent = text;
    };

    /**
     * 画布空状态提示：一旦画布有内容就隐藏，避免遮挡。
     */
    const hideCanvasHint = () => {
        if (canvasHint) canvasHint.classList.add('hidden');
    };

    /**
     * 切换语音控制区的状态机视觉（待命/聆听/思考/执行/异常）。
     * 通过给容器加 state-* 类，由 CSS 驱动边框、背景、状态点、波纹动效。
     */
    const setVisualState = (state) => {
        if (!speechControls) return;
        speechControls.classList.remove(
            'state-listening', 'state-thinking', 'state-error', 'state-drawing'
        );
        if (state) speechControls.classList.add(`state-${state}`);
    };

    let speechService = null;
    let allFinalText = ""; // 记录所有最终识别的文本用于页面显示
    let pendingClarifyContext = null; // 用于容错澄清的状态机
    const feedbackService = new window.FeedbackService(); // 语音/文字反馈

    /**
     * 为本地极速指令生成简短的口语反馈，
     * 让本地命中的指令也有"听到确认"的对话感（与 LLM 的 reply 对齐）。
     */
    const generateLocalReply = (command) => {
        const A = window.ParserConfig.ACTIONS;
        const shapeNames = {
            circle: '圆', rect: '矩形', line: '线条',
            triangle: '三角形', text: '文字', ellipse: '椭圆'
        };
        switch (command.action) {
            case A.DRAW:
                return `好的，画了一个${shapeNames[command.shape] || '图形'}`;
            case A.MODIFY:
                return '好的，颜色改好了';
            case A.MOVE:
                return '好的，移动好了';
            case A.DELETE:
                return '好的，删除了';
            case A.CLEAR:
                return '好的，已清空画布';
            case A.UNDO:
                return '好的，已撤销';
            case A.REDO:
                return '好的，已重做';
            default:
                return '好的';
        }
    };

    const updateStatus = (status) => {
        switch(status) {
            case 'ready':
                statusText.textContent = "点击麦克风开始说话";
                statusText.style.color = "black";
                setMicLabel("开始聆听");
                micBtn.disabled = false;
                setVisualState(null); // 待命
                break;
            case 'listening':
                statusText.textContent = "收音中...请说话";
                statusText.style.color = "green";
                setMicLabel("停止聆听");
                allFinalText = ""; // 每次重新开始时清空记录
                setVisualState('listening');
                break;
            case 'unsupported':
                statusText.textContent = "当前浏览器不支持语音识别，请使用 Chrome/Edge";
                statusText.style.color = "red";
                micBtn.disabled = true;
                setVisualState('error');
                break;
            case 'unauthorized':
                statusText.textContent = "未获取麦克风权限，请在浏览器地址栏允许";
                statusText.style.color = "red";
                setMicLabel("权限被拒");
                setVisualState('error');
                break;
            case 'error':
                statusText.textContent = "识别发生错误，请重试（或检查网络连接）";
                statusText.style.color = "red";
                setMicLabel("重试");
                setVisualState('error');
                break;
        }
    };

    /**
     * 处理语音文本，进行智能路由（本地极速 -> LLM 兜底）
     * @param {string} text 
     */
    const processSpeechText = async (text) => {
        if (!text || text.trim() === '') return; // 忽略空文本

        let finalTextToSend = text;

        if (pendingClarifyContext) {
            // 处于等待补充状态，拼接上下文发给大模型
            finalTextToSend = `${pendingClarifyContext.originalText}\n助理问：${pendingClarifyContext.clarifyMsg}\n用户补充说：${text}`;
            console.log("[Router] 存在待澄清上下文，拼接后发给大模型:", finalTextToSend);
        } else {
            // 1. 本地极速解析尝试
            const localCommand = window.parse(text);
            
            if (localCommand) {
                console.log("[Router] 本地解析命中，极速执行:", localCommand);
                // 本地 parse 返回的是单个对象，包装为数组
                if (window.executor) {
                    window.executor.executeCommands([localCommand]);
                    hideCanvasHint();
                }
                // 本地命中也给一个简短反馈（文字气泡 + TTS），形成对话感
                feedbackService.speak(generateLocalReply(localCommand), speechService);
                // 执行成功后恢复默认收音状态，清除可能存在的 clarify 提示
                if (speechService && speechService.isListening) {
                    statusText.textContent = "收音中...请说话";
                    statusText.style.color = "green";
                }
                return;
            }
        }

        // 2. 本地未命中或处于澄清状态，走 LLM 兜底路由
        console.log(`[Router] 准备交由 LLM 处理: "${finalTextToSend}"`);
        
        // 触发大模型请求前，更新 UI 状态为“思考中…”
        statusText.textContent = "思考中...";
        statusText.style.color = "blue";
        micBtn.disabled = true;
        setVisualState('thinking');

        let isClarify = false;
        let clarifyMsg = "";

        try {
            // 获取当前画布状态作为上下文
            const canvasContext = window.executor ? window.executor.getCanvasContext() : null;
            const llmData = await window.ApiService.fetchLLMParse(finalTextToSend, canvasContext);
            console.log("[Router] LLM 解析成功:", llmData);
            
            // 检查是否是大模型发出的 clarify 反问
            if (llmData.commands && llmData.commands.some(c => c.action === 'clarify')) {
                isClarify = true;
                clarifyMsg = llmData.reply || "能再说具体一点吗？";
                // 记住待澄清上下文
                pendingClarifyContext = {
                    originalText: finalTextToSend,
                    clarifyMsg: clarifyMsg
                };
            } else {
                // 成功执行了指令，清除 pending 状态
                pendingClarifyContext = null;
            }
            
            if (window.executor && llmData.commands && !isClarify) {
                hideCanvasHint(); // 画布即将有内容，隐藏空状态提示
                // 复杂图形（多个图元）用流式逐个绘制，给"AI 正在作画"的过程感
                if (llmData.commands.length > 1) {
                    statusText.textContent = "正在绘制...";
                    statusText.style.color = "#4F46E5";
                    setVisualState('drawing');
                    await window.executor.executeCommandsStreaming(llmData.commands);
                } else {
                    window.executor.executeCommands(llmData.commands);
                }
            } else if (window.executor && llmData.commands) {
                // clarify 等情况仍走普通执行（内部会跳过绘制）
                window.executor.executeCommands(llmData.commands);
            }

            // 执行完成后，用 LLM 给出的自然语言 reply 做文字气泡 + TTS 朗读
            // clarify 反问同样朗读，形成"听到追问"的对话感
            if (llmData.reply) {
                feedbackService.speak(llmData.reply, speechService);
            }
        } catch (error) {
            console.error("[Router] LLM 处理失败:", error);
            statusText.textContent = "未听清或网络波动，请再试一次"; // 友好降级提示
            statusText.style.color = "red";
            // 短暂保留错误提示后再恢复
            await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
            // 请求结束后恢复状态
            micBtn.disabled = false;
            if (speechService && speechService.isListening) {
                if (isClarify) {
                    statusText.textContent = "🤔 " + clarifyMsg;
                    statusText.style.color = "orange";
                } else {
                    statusText.textContent = "收音中...请说话";
                    statusText.style.color = "green";
                }
                // 思考结束，恢复聆听态视觉
                setVisualState('listening');
            } else {
                if (isClarify) {
                    statusText.textContent = "🤔 " + clarifyMsg;
                    statusText.style.color = "orange";
                } else {
                    updateStatus('ready');
                }
                setVisualState(null);
            }
        }
    };

    const handleResult = (newFinal, interim) => {
        // speech.js 传过来的 newFinal 是新产生的最终识别文本
        if (newFinal) {
            allFinalText += newFinal;
            // 只要有新的确定句子，就交给解析器处理
            processSpeechText(newFinal);
        }
        
        // 页面累加展示所有的最终结果，并拼上当前的临时结果
        resultBox.innerHTML = `<strong>${allFinalText}</strong> <span style="color:gray;">${interim}</span>`;
    };

    speechService = new window.SpeechService(handleResult, updateStatus);

    micBtn.addEventListener('click', () => {
        if (speechService.isListening) {
            speechService.stop();
        } else {
            speechService.start();
        }
    });

    // 帮助面板折叠/展开：让评委不看文档也知道能说什么
    const helpToggle = document.getElementById('help-toggle');
    const helpContent = document.getElementById('help-content');
    const helpArrow = document.getElementById('help-arrow');
    if (helpToggle && helpContent) {
        helpToggle.addEventListener('click', () => {
            const collapsed = helpContent.classList.toggle('collapsed');
            helpToggle.setAttribute('aria-expanded', String(!collapsed));
            if (helpArrow) helpArrow.textContent = collapsed ? '▸' : '▾';
        });
    }
});

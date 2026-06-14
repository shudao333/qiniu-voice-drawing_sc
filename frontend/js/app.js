// frontend/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-btn');
    const statusText = document.getElementById('status-text');
    const resultBox = document.getElementById('result-box');
    
    let speechService = null;
    let allFinalText = ""; // 记录所有最终识别的文本用于页面显示
    let pendingClarifyContext = null; // 用于容错澄清的状态机

    const updateStatus = (status) => {
        switch(status) {
            case 'ready':
                statusText.textContent = "点击麦克风开始说话";
                statusText.style.color = "black";
                micBtn.textContent = "🎤 开始聆听";
                micBtn.disabled = false;
                break;
            case 'listening':
                statusText.textContent = "收音中...请说话";
                statusText.style.color = "green";
                micBtn.textContent = "⏹️ 停止";
                allFinalText = ""; // 每次重新开始时清空记录
                break;
            case 'unsupported':
                statusText.textContent = "当前浏览器不支持语音识别，请使用 Chrome/Edge";
                statusText.style.color = "red";
                micBtn.disabled = true;
                break;
            case 'unauthorized':
                statusText.textContent = "未获取麦克风权限，请在浏览器地址栏允许";
                statusText.style.color = "red";
                micBtn.textContent = "🎤 权限被拒";
                break;
            case 'error':
                statusText.textContent = "识别发生错误，请重试（或检查网络连接）";
                statusText.style.color = "red";
                micBtn.textContent = "🎤 重试";
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
                }
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
            
            if (window.executor && llmData.commands) {
                window.executor.executeCommands(llmData.commands);
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
            } else {
                if (isClarify) {
                    statusText.textContent = "🤔 " + clarifyMsg;
                    statusText.style.color = "orange";
                } else {
                    updateStatus('ready');
                }
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
});

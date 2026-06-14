// frontend/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-btn');
    const statusText = document.getElementById('status-text');
    const resultBox = document.getElementById('result-box');
    
    let speechService = null;
    let allFinalText = ""; // 记录所有最终识别的文本用于页面显示

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
        // 1. 本地极速解析尝试
        const localCommand = window.parse(text);
        
        if (localCommand) {
            console.log("[Router] 本地解析命中，极速执行:", localCommand);
            if (window.executor) {
                window.executor.executeCommands([localCommand]);
            }
            if (speechService && speechService.isListening) {
                statusText.textContent = "收音中...请说话";
                statusText.style.color = "green";
            }
            return;
        }

        // 2. 本地未命中，走 LLM 兜底路由
        console.log(`[Router] 本地解析未命中，升级为 LLM 处理: "${text}"`);
        
        statusText.textContent = "思考中...";
        statusText.style.color = "blue";
        micBtn.disabled = true;

        let isClarify = false;
        let clarifyMsg = "";

        try {
            const llmData = await window.ApiService.fetchLLMParse(text);
            console.log("[Router] LLM 解析成功:", llmData);
            
            if (llmData.commands && llmData.commands.some(c => c.action === 'clarify')) {
                isClarify = true;
                clarifyMsg = llmData.reply || "能再说具体一点吗？";
            }
            
            if (window.executor && llmData.commands) {
                window.executor.executeCommands(llmData.commands);
            }
        } catch (error) {
            console.error("[Router] LLM 处理失败:", error);
            statusText.textContent = "解析失败: " + error.message;
            statusText.style.color = "red";
            await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
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

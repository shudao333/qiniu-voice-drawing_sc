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
     * 处理语音文本，进行解析和执行
     * @param {string} text 
     */
    const processSpeechText = (text) => {
        // 1. 调用本地解析器
        const commandData = window.parse(text);
        
        if (commandData) {
            console.log("[App] 本地解析成功:", commandData);
            // 2. 调用执行引擎渲染画面
            if (window.executor) {
                // parse 当前返回单个 CommandItem 对象，用数组包裹传入
                window.executor.executeCommands([commandData]);
            }
        } else {
            console.log(`[App] 本地解析未命中，待后续接入 LLM 处理: "${text}"`);
            // TODO: 后续 PR7 将发送至后端 API 走大模型解析
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

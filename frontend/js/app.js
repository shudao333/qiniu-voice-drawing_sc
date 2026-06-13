// frontend/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-btn');
    const statusText = document.getElementById('status-text');
    const resultBox = document.getElementById('result-box');
    
    let speechService = null;

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

    const handleResult = (final, interim) => {
        // 展示识别结果，加粗显示 final，灰色显示 interim
        resultBox.innerHTML = `<strong>${final}</strong> <span style="color:gray;">${interim}</span>`;
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

// frontend/js/speech.js
class SpeechService {
    constructor(onResult, onStatusChange) {
        this.onResult = onResult;
        this.onStatusChange = onStatusChange; // 状态回调：'ready', 'listening', 'error', 'unsupported', 'unauthorized'
        this.recognition = null;
        this.isListening = false;

        this.init();
    }

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("[SpeechService] 当前浏览器不支持 Web Speech API");
            this.onStatusChange('unsupported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true; // 连续识别
        this.recognition.interimResults = true; // 实时返回临时结果
        this.recognition.lang = 'zh-CN';

        this.recognition.onstart = () => {
            console.log("[SpeechService] 麦克风已激活，开始收音...");
            this.isListening = true;
            this.onStatusChange('listening');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            console.log(`[SpeechService] 识别中: 最终=[${finalTranscript}], 临时=[${interimTranscript}]`);
            this.onResult(finalTranscript, interimTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error("[SpeechService] 识别错误:", event.error);
            if (event.error === 'not-allowed') {
                this.onStatusChange('unauthorized');
            } else {
                this.onStatusChange('error');
            }
            this.isListening = false;
        };

        this.recognition.onend = () => {
            console.log("[SpeechService] 识别停止");
            this.isListening = false;
            this.onStatusChange('ready');
        };
        
        console.log("[SpeechService] 初始化完成");
        this.onStatusChange('ready');
    }

    start() {
        if (this.recognition && !this.isListening) {
            console.log("[SpeechService] 请求启动...");
            try {
                this.recognition.start();
            } catch (e) {
                console.error("[SpeechService] 启动异常:", e);
            }
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            console.log("[SpeechService] 请求停止...");
            this.recognition.stop();
        }
    }
}
window.SpeechService = SpeechService;

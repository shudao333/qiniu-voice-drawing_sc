// frontend/js/feedback.js

/**
 * 语音/文字反馈模块
 * 形成"说话 → 看到画 → 听到确认"的完整语音交互闭环。
 * ① 文字气泡显示 reply
 * ② 浏览器原生 SpeechSynthesis 朗读 reply（中文）
 * ③ 朗读时暂停语音识别，避免麦克风自我触发
 */
class FeedbackService {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.bubble = null;
        this.bubbleTimer = null;
        // 朗读时需要暂停的语音识别实例（由外部注入）
        this.speechService = null;

        this.initBubble();

        if (!this.synth) {
            console.warn("[FeedbackService] 当前浏览器不支持 SpeechSynthesis，将仅显示文字反馈");
        }
        console.log("[FeedbackService] 初始化完成");
    }

    /**
     * 注入语音识别实例，用于朗读时暂停识别
     */
    bindSpeechService(speechService) {
        this.speechService = speechService;
    }

    /**
     * 创建悬浮的文字气泡容器（挂在画布右下角）
     */
    initBubble() {
        const bubble = document.createElement('div');
        bubble.id = 'feedback-bubble';
        bubble.className = 'feedback-bubble hidden';
        document.body.appendChild(bubble);
        this.bubble = bubble;
    }

    /**
     * 反馈入口：显示文字气泡 + 朗读
     * @param {string} reply 给用户的反馈文本
     * @param {SpeechService} [speechService] 语音识别实例，朗读时暂停它防止自我触发
     */
    speak(reply, speechService) {
        if (!reply || typeof reply !== 'string') return;

        // 每次朗读时更新识别实例引用（app.js 在 speechService 创建后才有实例）
        if (speechService) {
            this.speechService = speechService;
        }

        this.showBubble(reply);
        this.speakAloud(reply);
    }

    /**
     * 文字气泡显示，数秒后自动淡出
     */
    showBubble(reply) {
        if (!this.bubble) return;

        this.bubble.textContent = reply;
        this.bubble.classList.remove('hidden');

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
        // 气泡停留时长随文本长度浮动，至少 3 秒
        const duration = Math.max(3000, reply.length * 150);
        this.bubbleTimer = setTimeout(() => {
            this.bubble.classList.add('hidden');
        }, duration);
    }

    /**
     * 浏览器原生 TTS 朗读，朗读期间暂停语音识别防止自我触发
     */
    speakAloud(reply) {
        if (!this.synth) return;

        // 打断上一段未读完的朗读，避免堆积
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.05; // 略快一点更自然
        utterance.pitch = 1.0;

        // 记录朗读前的识别状态：仅当识别正在进行时才需要恢复
        const wasListening = !!(this.speechService && this.speechService.isListening);

        utterance.onstart = () => {
            // 朗读开始：暂停识别，避免把自己的声音当成用户指令
            if (wasListening && this.speechService) {
                console.log("[FeedbackService] 朗读开始，暂停语音识别");
                this.speechService.stop();
            }
        };

        const resumeListening = () => {
            // 朗读结束：若之前在识别，则恢复识别
            if (wasListening && this.speechService && !this.speechService.isListening) {
                console.log("[FeedbackService] 朗读结束，恢复语音识别");
                // 稍作延时，确保 TTS 音频尾音不会被立刻识别
                setTimeout(() => {
                    this.speechService.start();
                }, 300);
            }
        };

        utterance.onend = resumeListening;
        utterance.onerror = (e) => {
            console.warn("[FeedbackService] TTS 朗读异常:", e.error);
            resumeListening();
        };

        this.synth.speak(utterance);
    }
}

// 暴露到全局
window.FeedbackService = FeedbackService;

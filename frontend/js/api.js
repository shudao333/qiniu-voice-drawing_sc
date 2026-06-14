// frontend/js/api.js

/**
 * 后端 API 交互服务
 */
class ApiService {
    /**
     * 将文本发送给后端 LLM 进行兜底解析
     * @param {string} text 用户的语音文本
     * @returns {Promise<Object>} 后端返回的 CommandResponse 对象
     */
    static async fetchLLMParse(text) {
        try {
            const response = await fetch('/api/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                let errorMsg = "请求大模型接口失败";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorMsg;
                } catch (e) {
                    // ignore JSON parse error for error responses
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("[ApiService] LLM 解析请求发生异常:", error);
            throw error; // 向上抛出以供 UI 层捕获
        }
    }
}

// 暴露到全局
window.ApiService = ApiService;

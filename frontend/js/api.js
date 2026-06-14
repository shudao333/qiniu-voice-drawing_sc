// frontend/js/api.js

class ApiService {
    static async fetchLLMParse(text) {
        try {
            // Using absolute URL as requested by user fallback
            const response = await fetch('http://127.0.0.1:8000/api/parse', {
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
                } catch (e) {}
                throw new Error(errorMsg);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("[ApiService] LLM 解析请求发生异常:", error);
            throw error;
        }
    }
}

window.ApiService = ApiService;

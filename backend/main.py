from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

from backend.schemas import CommandResponse
from backend.llm import parse_text_to_commands

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseRequest(BaseModel):
    text: str

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/parse", response_model=CommandResponse)
async def parse_command(request: ParseRequest):
    try:
        raw_json_str = parse_text_to_commands(request.text)
        
        # Code Reviewer 安全性处理：清理大模型可能擅自添加的 Markdown 代码块
        raw_json_str = raw_json_str.strip()
        if raw_json_str.startswith("```json"):
            raw_json_str = raw_json_str[7:]
        elif raw_json_str.startswith("```"):
            raw_json_str = raw_json_str[3:]
        if raw_json_str.endswith("```"):
            raw_json_str = raw_json_str[:-3]
        raw_json_str = raw_json_str.strip()

        # 解析为字典
        parsed_dict = json.loads(raw_json_str)
        
        # 利用 Pydantic 进行强校验
        response_obj = CommandResponse(**parsed_dict)
        return response_obj

    except json.JSONDecodeError as e:
        print(f"[Parse Error] JSON 解析失败: {raw_json_str}")
        raise HTTPException(status_code=500, detail=f"模型返回了无效的 JSON 格式: {str(e)}")
    except ValueError as e:
        # Pydantic 校验错误或其他异常
        print(f"[Parse Error] 数据结构校验失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"模型返回的指令结构不符合要求: {str(e)}")
    except Exception as e:
        print(f"[Parse Error] 调用大模型或处理异常: {str(e)}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

# 挂载前端静态页面
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

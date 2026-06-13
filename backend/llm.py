import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# 确保加载 .env 文件中的环境变量
load_dotenv()

API_KEY = os.getenv("QINIU_API_KEY")

def get_openai_client():
    if not API_KEY:
        raise ValueError("环境配置错误：未找到 QINIU_API_KEY，请确保在 .env 中设置了该环境变量。")
    return OpenAI(
        base_url="https://api.qnaigc.com/v1",
        api_key=API_KEY
    )

SYSTEM_PROMPT = """你是一个专业的“网页绘图指令解析引擎”。你的唯一任务是将用户的自然语言指令（例如绘图、修改、移动、删除等组合复杂动作）解析成严谨的 JSON 格式。

你必须严格遵守以下 JSON Schema 输出数据，不要包含任何 Markdown 代码块包裹（即不要带 ```json），不要输出任何解释性的废话，只输出纯 JSON 字符串！

支持的 action: ["draw", "modify", "move", "delete", "undo", "redo", "clear", "select", "group", "clarify"]
支持的 shape: ["circle", "rect", "line", "text"]
支持的 target: ["last", "selected", "all"] 或者具体描述（如 "红色的圆"）

JSON 结构示例：
{
  "commands": [
    { "action": "draw", "shape": "circle", "props": { "x": 300, "y": 200, "radius": 50, "color": "#ff0000" } },
    { "action": "draw", "shape": "rect",   "props": { "x": 100, "y": 100, "width": 120, "height": 80, "color": "#0000ff" } },
    { "action": "modify", "target": "last", "props": { "color": "#00ff00" } },
    { "action": "move",   "target": "last", "props": { "dx": 50, "dy": 0 } }
  ],
  "reply": "好的，我画了一个红色的圆和一个蓝色的矩形，并将其变成了绿色然后向右移动了。"
}

提示规则：
1. 对于“组合图形”（比如画一个房子/笑脸），你需要将其拆解为多个基础形状（例如墙壁矩形、屋顶三角形/线条、门矩形）并以多个 command 按序输出。
2. 相对位置移动（比如“往上移动一点”），使用 move 动作，并设置合理的 dx 和 dy。
3. 请尽可能猜测合理的颜色 HEX 代码和坐标。
4. "reply" 字段必须存在，作为操作后的语音/文本回馈给用户。
5. 当用户的指令不明确或缺乏要素时，使用 "action": "clarify"，并在 reply 中反问用户（例如："你是想要什么颜色的圆？"）。
"""

def parse_text_to_commands(text: str) -> str:
    """调用七牛云大模型解析文本为指令 JSON 字符串"""
    client = get_openai_client()
    response = client.chat.completions.create(
        model="deepseek/deepseek-v4-pro", # 换回 v4-pro
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ],
        temperature=0.1,  # 使用低温度保证输出格式的稳定性
        response_format={"type": "json_object"},
        extra_body={"thinking": {"type": "disabled"}} # 根据官方文档精准关闭深度思考
    )
    
    content = response.choices[0].message.content
    return content

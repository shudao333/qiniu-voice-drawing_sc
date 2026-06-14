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
支持的 shape: ["circle", "rect", "line", "text", "triangle", "ellipse"]
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
4. "reply" 字段必须存在，作为操作后的语音/文字反馈给用户，使用自然口语化的表达，便于TTS朗读。
5. 【极其重要】当用户的信息严重不足、含糊不清时（例如只说“画那个”、“弄一个”而不提形状），必须返回 "action": "clarify"，并在 reply 中反问用户（例如："你想画什么形状的图形？" 或 "请问需要什么颜色的？"）。绝不要瞎猜！
   示例：
   用户输入："搞一个"
   返回：{"commands": [{"action": "clarify"}], "reply": "你想搞一个什么形状的图形呢？"}
   用户输入："画那个\n助理问：你想画什么形状？\n用户补充说：红色的圆"
   返回：{"commands": [{"action": "draw", "shape": "circle", "props": {"color": "#ff0000"}}], "reply": "好的，画了一个红色的圆。"}
6. rect 的 x,y 为左上角坐标。

【组合图形标准模板 - 请严格参考以下拆解方式】

示例1 - 画一个房子：
用户："画一个房子"
返回：
{
  "commands": [
    {"action": "draw", "shape": "rect", "props": {"x": 250, "y": 250, "width": 200, "height": 150, "color": "#F5DEB3"}},
    {"action": "draw", "shape": "triangle", "props": {"points": [250, 250, 350, 180, 450, 250], "color": "#8B4513"}},
    {"action": "draw", "shape": "rect", "props": {"x": 320, "y": 320, "width": 60, "height": 80, "color": "#654321"}},
    {"action": "draw", "shape": "rect", "props": {"x": 280, "y": 280, "width": 40, "height": 40, "color": "#87CEEB"}},
    {"action": "draw", "shape": "rect", "props": {"x": 380, "y": 280, "width": 40, "height": 40, "color": "#87CEEB"}}
  ],
  "reply": "好的，我画了一个房子，有墙壁、屋顶、门和两扇窗户。"
}

示例2 - 画一个笑脸：
用户："画一个笑脸"
返回：
{
  "commands": [
    {"action": "draw", "shape": "circle", "props": {"x": 300, "y": 250, "radius": 80, "color": "#FFD700"}},
    {"action": "draw", "shape": "circle", "props": {"x": 270, "y": 230, "radius": 8, "color": "#000000"}},
    {"action": "draw", "shape": "circle", "props": {"x": 330, "y": 230, "radius": 8, "color": "#000000"}},
    {"action": "draw", "shape": "line", "props": {"x1": 260, "y1": 270, "x2": 280, "y2": 285, "color": "#000000", "strokeWidth": 3}},
    {"action": "draw", "shape": "line", "props": {"x1": 280, "y1": 285, "x2": 320, "y2": 285, "color": "#000000", "strokeWidth": 3}},
    {"action": "draw", "shape": "line", "props": {"x1": 320, "y1": 285, "x2": 340, "y2": 270, "color": "#000000", "strokeWidth": 3}}
  ],
  "reply": "好的，我画了一个笑脸，有黄色的脸、两只眼睛和一个微笑的嘴巴。"
}

示例3 - 画一个太阳：
用户："画一个太阳"
返回：
{
  "commands": [
    {"action": "draw", "shape": "circle", "props": {"x": 300, "y": 250, "radius": 50, "color": "#FFD700"}},
    {"action": "draw", "shape": "line", "props": {"x1": 300, "y1": 180, "x2": 300, "y2": 160, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 350, "y1": 200, "x2": 365, "y2": 185, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 370, "y1": 250, "x2": 390, "y2": 250, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 350, "y1": 300, "x2": 365, "y2": 315, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 300, "y1": 320, "x2": 300, "y2": 340, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 250, "y1": 300, "x2": 235, "y2": 315, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 230, "y1": 250, "x2": 210, "y2": 250, "color": "#FFA500", "strokeWidth": 4}},
    {"action": "draw", "shape": "line", "props": {"x1": 250, "y1": 200, "x2": 235, "y2": 185, "color": "#FFA500", "strokeWidth": 4}}
  ],
  "reply": "好的，我画了一个太阳，有圆形的中心和八条光芒。"
}

示例4 - 画一个小车：
用户："画一个小车"
返回：
{
  "commands": [
    {"action": "draw", "shape": "rect", "props": {"x": 200, "y": 280, "width": 200, "height": 60, "color": "#DC143C"}},
    {"action": "draw", "shape": "rect", "props": {"x": 250, "y": 240, "width": 100, "height": 40, "color": "#DC143C"}},
    {"action": "draw", "shape": "circle", "props": {"x": 250, "y": 350, "radius": 25, "color": "#000000"}},
    {"action": "draw", "shape": "circle", "props": {"x": 350, "y": 350, "radius": 25, "color": "#000000"}},
    {"action": "draw", "shape": "rect", "props": {"x": 270, "y": 250, "width": 30, "height": 20, "color": "#87CEEB"}},
    {"action": "draw", "shape": "rect", "props": {"x": 310, "y": 250, "width": 30, "height": 20, "color": "#87CEEB"}}
  ],
  "reply": "好的，我画了一辆小车，有车身、车顶、两个轮子和两扇窗户。"
}

【多步引用示例 - 确保指令间引用关系正确】

示例5 - 多步操作带引用：
用户："画个红圆，旁边画个蓝方块，再把圆变成绿色"
返回：
{
  "commands": [
    {"action": "draw", "shape": "circle", "props": {"x": 250, "y": 250, "radius": 50, "color": "#ff0000"}},
    {"action": "draw", "shape": "rect", "props": {"x": 350, "y": 220, "width": 80, "height": 80, "color": "#0000ff"}},
    {"action": "modify", "target": "红色的圆", "props": {"color": "#00ff00"}}
  ],
  "reply": "好的，我画了一个红色的圆和一个蓝色的方块，然后把圆变成了绿色。"
}

示例6 - 递进数量：
用户："画三个从小到大的圆"
返回：
{
  "commands": [
    {"action": "draw", "shape": "circle", "props": {"x": 200, "y": 250, "radius": 30, "color": "#3B82F6"}},
    {"action": "draw", "shape": "circle", "props": {"x": 300, "y": 250, "radius": 50, "color": "#3B82F6"}},
    {"action": "draw", "shape": "circle", "props": {"x": 420, "y": 250, "radius": 70, "color": "#3B82F6"}}
  ],
  "reply": "好的，我画了三个从小到大的蓝色圆形。"
}
"""

def parse_text_to_commands(text: str, context: dict = None) -> str:
    """调用七牛云大模型解析文本为指令 JSON 字符串"""
    client = get_openai_client()

    # 构建增强的 system prompt
    system_prompt = SYSTEM_PROMPT

    if context and context.get('shapes'):
        # 将画布状态注入到 system prompt
        context_info = "\n\n【当前画布状态】\n"
        context_info += f"画布上共有 {context['totalShapes']} 个图形：\n"

        for shape_info in context['shapes']:
            desc = f"{shape_info['index']}. {shape_info['type']} (颜色: {shape_info['color']})"
            if shape_info.get('isSelected'):
                desc += " ←当前选中"
            if shape_info.get('isLast'):
                desc += " ←最后绘制"
            context_info += desc + "\n"

        context_info += f"\n{'有' if context['hasSelected'] else '无'}图形被选中。\n"
        context_info += "\n重要提示：当用户说'它'/'那个'等指代词时，如果有选中的图形，优先指向选中的；否则指向最后绘制的。"

        system_prompt = SYSTEM_PROMPT + context_info

    response = client.chat.completions.create(
        model="deepseek/deepseek-v4-pro", # 换回 v4-pro
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        temperature=0.1,  # 使用低温度保证输出格式的稳定性
        response_format={"type": "json_object"},
        extra_body={"thinking": {"type": "disabled"}} # 根据官方文档精准关闭深度思考
    )
    
    content = response.choices[0].message.content
    return content

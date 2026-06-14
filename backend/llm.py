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
1. 对于”组合图形”（比如画一个房子/笑脸），你需要将其拆解为多个基础形状（例如墙壁矩形、屋顶三角形/线条、门矩形）并以多个 command 按序输出。
2. 相对位置移动（比如”往上移动一点”），使用 move 动作，并设置合理的 dx 和 dy。
3. 请尽可能猜测合理的颜色 HEX 代码和坐标。
4. “reply” 字段必须存在，作为操作后的语音/文字反馈给用户，使用自然口语化的表达，便于TTS朗读。
5. 【极其重要】当用户的信息严重不足、含糊不清时（例如只说”画那个”、”弄一个”而不提形状），必须返回 “action”: “clarify”，并在 reply 中反问用户（例如：”你想画什么形状的图形？” 或 “请问需要什么颜色的？”）。绝不要瞎猜！
   示例：
   用户输入：”搞一个”
   返回：{“commands”: [{“action”: “clarify”}], “reply”: “你想搞一个什么形状的图形呢？”}
   用户输入：”画那个\n助理问：你想画什么形状？\n用户补充说：红色的圆”
   返回：{“commands”: [{“action”: “draw”, “shape”: “circle”, “props”: {“color”: “#ff0000”}}], “reply”: “好的，画了一个红色的圆。”}
6. rect 的 x,y 为左上角坐标。

【关键】当提供了画布状态上下文时，必须遵守以下target匹配规则：

7. **Target精确匹配原则**（当画布状态存在时）：
   用户描述的形状词必须与画布上的实际type精确匹配：
   - “圆” / “圆形” → type: “circle”
   - “方块” / “矩形” / “正方形” / “长方形” → type: “rect”
   - “线” / “直线” / “线条” → type: “line”
   - “三角” / “三角形” → type: “triangle”（注意：triangle用Line绘制，closed=true）
   - “椭圆” → type: “ellipse”
   - “文字” / “字” → type: “text”

   **错误示例**：
   画布状态：[{type: “rect”, color: “#ff0000”}, {type: “circle”, color: “#000”, isLast: true}]
   用户：”把正方形变成绿色”
   ❌ 错误：返回 target: “last” （会修改circle而不是rect！）
   ✅ 正确：返回 target: “正方形” 或直接用描述匹配找到rect

   **正确示例**：
   画布状态：[{type: “rect”, color: “#ff0000”}, {type: “circle”, color: “#000”, isLast: true}]
   用户：”把正方形变成绿色”
   思考过程：
   - 用户说”正方形” = rect类型
   - 画布上index 1是rect
   - index 2是circle（虽然是last）
   - 应该修改rect，不是last
   返回：{“action”: “modify”, “target”: “正方形”, “props”: {“color”: “#00ff00”}}

8. **组合图形的整体操作**（关键！）：
   当用户要对组合图形整体操作（如”把人往上移”、”把鱼变红色”、”删除房子”），必须识别哪些图形属于这个整体，并为每个部分生成独立的指令。

   **识别规则**：
   - 最近连续画的一组图形（连续index，且在画布末尾）通常属于同一个整体
   - 如果用户刚画了一个组合图形，”它”/”这个”指向整组

   **操作展开策略（必须用 #序号 精确寻址）**：

   画布状态里每个图形都有唯一的 index 序号（如 #1、#2、#3…）。对组合图形整体操作时，
   **必须为每个图形生成一条独立指令，target 用 "#序号" 精确定位每个图形**。

   ⚠️ 绝对不要用”颜色+形状描述”（如”黑色的圆”）来定位组合图形的部件！
   因为人的眼睛有2个”黑色的圆”、手臂有2条”蓝色的线”，描述会重复命中同一个图形，
   导致只移动了一部分。**唯一可靠的方式是用画布状态里给出的 index 序号。**

   move / modify 一律用 #序号 列出整组：
   ```json
   画布状态：#1浅肤色circle(头) #2蓝色ellipse(身) #3蓝色line(臂) #4蓝色line(臂) #5黑色line(腿) #6黑色line(腿) #7黑色circle(眼) #8黑色circle(眼) #9红色line(嘴)，共9个图形是一个人
   用户：”把人往上移”
   返回：
   {“commands”: [
     {“action”: “move”, “target”: “#1”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#2”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#3”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#4”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#5”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#6”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#7”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#8”, “props”: {“dy”: -50}},
     {“action”: “move”, “target”: “#9”, “props”: {“dy”: -50}}
   ]}
   ```
   （务必覆盖整组的每一个 index，一个都不能漏，否则人会被撕裂。）

   delete 同样用 #序号，但**必须从大到小倒序**（因为删除会使后面的序号前移）：
   ```json
   画布状态：#1~#5 共5个图形是房子
   用户：”删除房子”
   返回：
   {“commands”: [
     {“action”: “delete”, “target”: “#5”},
     {“action”: “delete”, “target”: “#4”},
     {“action”: “delete”, “target”: “#3”},
     {“action”: “delete”, “target”: “#2”},
     {“action”: “delete”, “target”: “#1”}
   ]}
   ```

   单个图形操作仍可用 last / selected / “红色的圆” 等描述；
   只有”整组操作”才必须展开成多条 #序号 指令。

【组合图形设计思维 - 遇到新物体时的拆解方法】

当用户要求画一个你没见过示例的组合图形时（如"画一只小鸡"、"画一条鱼"、"画一朵花"），请按以下思维步骤拆解：

步骤1 - 结构分析：
这个物体由哪些主要部分组成？
例如：老虎 = 脸（椭圆）+ 眼睛×2（小圆）+鼻子（三角）+ 嘴（线）+ 耳朵×2（三角）+胡须（多条线）+ 身体（椭圆）+ 条纹（线）

步骤2 - 形状映射：
每个部分用哪个基础图形最合适？
- 圆润的部分 →circle 或 ellipse
- 方正的部分 →rect
- 尖锐的部分 →triangle
- 细长的部分 →line
- 文字标注 →text

步骤3 - 颜色选择：
符合物体的真实或卡通配色，用合理的HEX代码。
例如：老虎=橙色身体(#FFA500) + 黑色条纹(#000000) + 白色肚子(#FFFFFF)

步骤4 - 比例与布局（重要！）：
- 主体图形放在画布中心（约 x:300, y:250）
- 重要部件的尺寸要协调（眼睛不要比脸还大）
- 部件之间的相对位置要合理（眼睛在脸的上半部分，嘴在下半部分）
- 画布尺寸约600x500，避免图形超出边界

【关键】环形排列的几何计算：
对于需要环绕中心排列的元素（如花瓣、光芒、轮子等），必须使用圆周分布公式，而不是简单的上下左右：
- 设中心点为(cx, cy)，半径为r，元素数量为n
- 第i个元素的位置 = (cx + r*cos(2πi/n), cy + r*sin(2πi/n))
- 例如：5片花瓣围绕花蕊，半径50，角度依次为0°(0), 72°(0.4π), 144°(0.8π), 216°(1.2π), 288°(1.6π)
  花蕊中心(300,250)时，花瓣中心近似为：
  花瓣1: (350, 250)         // 0° 右侧
  花瓣2: (315, 203)         // 72° 右上
  花瓣3: (270, 220)         // 144° 左上
  花瓣4: (270, 280)         // 216° 左下
  花瓣5: (315, 297)         // 288° 右下
- 对称物体（眼睛、耳朵、轮子等）使用左右对称计算，不要用固定偏移量

步骤5 - 层次与细节：
- 先画大轮廓（身体、脸），再画细节（眼睛、嘴）
- 适当简化：用基础图形抽象表达，不追求写实细节
- 关键特征突出：老虎的条纹、兔子的长耳朵、鱼的鳍等

【设计思维应用示例】

用户："画一只老虎"

思考过程：
1. 结构：脸(大圆) + 耳朵×2(小三角)+ 眼睛×2(小圆)+ 鼻子(小三角) + 嘴(线) + 胡须(线×6)+ 身体(椭圆) + 条纹(线×4)
2. 形状映射：脸用circle，身体用ellipse，耳朵和鼻子用triangle，条纹和胡须用line
3. 颜色：主体橙色#FFA500，条纹黑色#000000，眼睛白色+黑色，鼻子粉色#FFC0CB
4. 布局：脸在中上部(300,200)，身体在中下部(300,320)，耳朵在脸顶部左右
5. 尺寸协调：脸半径60，眼睛半径8，鼻子小三角size:15，身体radiusX:70 radiusY:50

返回：
{
  "commands": [
    {"action": "draw", "shape": "circle", "props": {"x": 300, "y": 200, "radius": 60, "color": "#FFA500"}},
    {"action": "draw", "shape": "triangle", "props": {"x": 270, "y": 150, "size": 20, "color": "#FFA500"}},
    {"action": "draw", "shape": "triangle", "props": {"x": 330, "y": 150, "size": 20, "color": "#FFA500"}},
    {"action": "draw", "shape": "circle", "props": {"x": 280, "y": 190, "radius": 8, "color": "#FFFFFF"}},
    {"action": "draw", "shape": "circle", "props": {"x": 285, "y": 190, "radius": 4, "color": "#000000"}},
    {"action": "draw", "shape": "circle", "props": {"x": 320, "y": 190, "radius": 8, "color": "#FFFFFF"}},
    {"action": "draw", "shape": "circle", "props": {"x": 315, "y": 190, "radius": 4, "color": "#000000"}},
    {"action": "draw", "shape": "triangle", "props": {"x": 300, "y": 205, "size": 12, "color": "#FFC0CB"}},
    {"action": "draw", "shape": "line", "props": {"x1": 300, "y1": 215, "x2": 300, "y2": 225, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 250, "y1": 195, "x2": 230, "y2": 190, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 250, "y1": 200, "x2": 230, "y2": 200, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 250, "y1": 205, "x2": 230, "y2": 210, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 350, "y1": 195, "x2": 370, "y2": 190, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 350, "y1": 200, "x2": 370, "y2": 200, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "line", "props": {"x1": 350, "y1": 205, "x2": 370, "y2": 210, "color": "#000000", "strokeWidth": 2}},
    {"action": "draw", "shape": "ellipse", "props": {"x": 300, "y": 320, "radiusX": 70, "radiusY": 50, "color": "#FFA500"}},
    {"action": "draw", "shape": "line", "props": {"x1": 260, "y1": 310, "x2": 260, "y2": 330, "color": "#000000", "strokeWidth": 3}},
    {"action": "draw", "shape": "line", "props": {"x1": 280, "y1": 305, "x2": 280, "y2": 335, "color": "#000000", "strokeWidth": 3}},
    {"action": "draw", "shape": "line", "props": {"x1": 320, "y1": 305, "x2": 320, "y2": 335, "color": "#000000", "strokeWidth": 3}},
    {"action": "draw", "shape": "line", "props": {"x1": 340, "y1": 310, "x2": 340, "y2": 330, "color": "#000000", "strokeWidth": 3}}
  ],
  "reply": "好的，我画了一只卡通老虎，有橙色的脸和身体、两只耳朵、眼睛、鼻子、胡须和黑色的条纹。"
}

关键原则：
- 遇到新物体时，**先在脑海中分解结构，再逐一映射到基础图形**
- 保持简笔画/卡通风格，不追求写实细节
- 注重特征识别度：用户看到后能认出"这是个老虎/小鸡/鱼"即可
- 颜色和比例协调，部件相对位置合理

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

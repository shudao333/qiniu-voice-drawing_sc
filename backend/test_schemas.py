import pytest
from pydantic import ValidationError
from backend.schemas import CommandResponse

def test_valid_schema():
    """测试合法的 JSON 解析"""
    valid_data = {
        "commands": [
            { "action": "draw", "shape": "circle", "props": { "x": 300, "y": 200, "radius": 50, "color": "#ff0000" } },
            { "action": "modify", "target": "last", "props": { "color": "#00ff00" } },
            { "action": "undo" }
        ],
        "reply": "好的,我画了一个红色的圆和一个蓝色的方块"
    }
    obj = CommandResponse(**valid_data)
    assert len(obj.commands) == 3
    assert obj.commands[0].action == "draw"
    assert obj.reply.startswith("好的")

def test_invalid_schema():
    """测试非法的 JSON 解析（无效的 action 或缺少必需字段）"""
    invalid_data = {
        "commands": [
            { "action": "unknown_action" } # action 不在 Literal 定义中
        ]
        # 缺少必需的 reply 字段
    }
    with pytest.raises(ValidationError) as exc_info:
        CommandResponse(**invalid_data)
    
    errors = exc_info.value.errors()
    assert len(errors) >= 2 # 预期会有 action 错误和 missing reply 错误

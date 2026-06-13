from pydantic import BaseModel, Field
from typing import List, Optional, Literal

ActionType = Literal["draw", "modify", "move", "delete", "undo", "redo", "clear", "select", "group", "clarify"]

class CommandProps(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    dx: Optional[float] = None
    dy: Optional[float] = None
    radius: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    points: Optional[List[float]] = None
    
    model_config = {
        "extra": "allow" # 允许容纳其他灵活属性
    }

class CommandItem(BaseModel):
    action: ActionType = Field(..., description="The action to perform")
    shape: Optional[str] = Field(None, description="Shape type, e.g., 'circle', 'rect', 'line', 'text'")
    target: Optional[str] = Field(None, description="Target object identifier, e.g., 'last', 'selected', 'all' or description")
    props: Optional[CommandProps] = Field(None, description="Properties for the action/shape")

class CommandResponse(BaseModel):
    commands: List[CommandItem] = Field(..., description="List of commands to execute sequentially")
    reply: str = Field(..., description="Text feedback to return to the user")

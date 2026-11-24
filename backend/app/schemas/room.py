from enum import Enum
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class RoomStatus(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"


class GameMode(str, Enum):
    CLASSIC = "classic"


class DeckSize(int, Enum):
    SMALL = 36
    LARGE = 52


class AnimMode(str, Enum):
    CLASSIC = "classic"
    FAST = "fast"


class RoomCreate(BaseModel):
    title: str = Field(min_length=1, max_length=64)

    deck_size: DeckSize = DeckSize.SMALL

    max_players: int = Field(default=2, ge=2, le=4)

    anim_mode: AnimMode = AnimMode.CLASSIC

    is_private: bool = False

    @model_validator(mode="after")
    def validate_max_players(self):
        if self.max_players not in (2, 3, 4):
            raise ValueError("max_players must be 2, 3 or 4")
        return self


class JoinRoomRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class RoomPlayerResponse(BaseModel):
    id: str
    username: str
    avatar_url: str
    is_bot: bool
    is_ready: bool


class RoomResponse(BaseModel):
    id: str
    code: str
    title: str
    mode: GameMode
    deck_size: DeckSize
    max_players: int
    anim_mode: AnimMode
    is_private: bool
    host_name: str
    status: RoomStatus
    players: list[RoomPlayerResponse]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

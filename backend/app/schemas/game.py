from enum import Enum

from pydantic import BaseModel


class GameOutcome(str, Enum):
    PLAYER_WIN = "player_win"
    BOT_WIN = "bot_win"
    DRAW = "draw"


class GameResultRequest(BaseModel):
    outcome: GameOutcome


class CardSuit(str, Enum):
    SPADES = "spades"
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"


class CardResponse(BaseModel):
    id: str
    suit: CardSuit
    rank: int


class TablePairResponse(BaseModel):
    attack: CardResponse
    defense: CardResponse | None = None

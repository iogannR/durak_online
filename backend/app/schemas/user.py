from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=32
    )

    avatar_url: str | None = Field(
        default=None,
        max_length=2048
    )


class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    avatar_url: str
    games_played: int
    wins: int
    losses: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

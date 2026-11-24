from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

from app.db.session import close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

    await close_db()


app = FastAPI(
    title="Durak Online API",
    lifespan=lifespan
)


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
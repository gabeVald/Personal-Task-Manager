from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated
from fastapi import FastAPI, APIRouter, Path
from enum import Enum
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from db.db_context import init_database

from fastapi.middleware.cors import CORSMiddleware

from routers.task_router import task_router
from routers.user_router import user_router
from routers.file_router import file_router
from routers.log_router import log_router

# to auto load the database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # upon startup event
    print("Application Starts...")
    await init_database()
    # on shutdown
    yield
    print("Application Shuts down")  # not currently implemented


app = FastAPI(Title="", version="2.0.0", lifespan=lifespan)

# Add CORS middleware with proper configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(task_router, tags=["Todos"], prefix="/todos")
app.include_router(user_router, tags=["Users"], prefix="/users")
app.include_router(file_router, tags=["Files"], prefix="/todos/files")
app.include_router(log_router, tags=["Logs"], prefix="/logs")


@app.get("/")
async def welcome() -> dict:
    """My document summary"""
    return {"message": "Hello World!"}


app.mount("/", StaticFiles(directory="../src"), name="assets")

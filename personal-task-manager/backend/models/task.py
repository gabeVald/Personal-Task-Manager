from datetime import datetime
from pydantic import BaseModel
from beanie import Document


class Task(Document):
    title: str = "New Task"
    description: str
    tags: list[str] = []
    completed: bool = False
    # When the task was initially created
    created_date: datetime
    # When the task moves up to the next level (task -> todo -> gottado)
    expired_date: datetime
    # When the completed boolean flips from 0 -> 1, ides of march as placeholder
    completed_date: datetime = datetime(year=44, month=3, day=15)
    high_priority: bool = False
    level: str = "task"
    username: str
    has_image: bool = False

    class Settings:
        name = "tasks"


# This is for the creating a task
class TaskRequest(BaseModel):
    title: str = "New Task"
    description: str
    tags: list[str] = []
    completed: bool = False
    # When the task was initially created
    created_date: datetime
    # When the completed boolean flips from 0 -> 1, ides of march as placeholder
    completed_date: datetime = datetime(year=44, month=3, day=15)
    high_priority: bool = False
    level: str = "task"
    has_image: bool = False

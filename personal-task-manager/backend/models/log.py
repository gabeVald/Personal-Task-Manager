# MODEL FOR LOGGING

from beanie import Document
from datetime import datetime


class Log(Document):
    username: str
    endpoint: str
    time: datetime
    details: dict

    class Settings:
        name = "logs"

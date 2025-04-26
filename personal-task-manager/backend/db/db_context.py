from beanie import init_beanie

from models.my_config import get_settings
from models.task import Task
from models.user import User
from models.log import Log
from models.file import File

from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import ssl
import logging

logger = logging.getLogger("__name__")


async def init_database():
    my_config = get_settings()
    # Create an SSL context with the certificates from certifi
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    # Use the SSL context in the MongoDB client
    client = AsyncIOMotorClient(my_config.connection_string, tlsCAFile=certifi.where())
    db = client["gottaDo_app"]
    await init_beanie(database=db, document_models=[User, Task, Log, File])
    logger.info("database started")

from beanie import init_beanie
from urllib.parse import urlparse

from models.my_config import get_settings
from models.task import Task
from models.user import User
from models.log import Log
from models.file import File
from models.ofx_file import OFXFile, Transaction
from models.budget_target import BudgetTarget
from models.merchant_category_rule import MerchantCategoryRule

from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import logging

logger = logging.getLogger("__name__")


async def init_database():
    my_config = get_settings()
    connection_host = urlparse(my_config.connection_string).hostname
    client_options = {}
    # Local development MongoDB usually runs without TLS; retain CA validation for remote databases.
    if connection_host not in {"localhost", "127.0.0.1", "::1"}:
        client_options["tlsCAFile"] = certifi.where()

    client = AsyncIOMotorClient(my_config.connection_string, **client_options)
    db = client["gottaDo_app"]
    await init_beanie(
        database=db,
        document_models=[
            User,
            Task,
            Log,
            File,
            OFXFile,
            Transaction,
            BudgetTarget,
            MerchantCategoryRule,
        ],
    )
    logger.info("database started")

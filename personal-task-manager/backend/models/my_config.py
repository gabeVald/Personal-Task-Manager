from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_FRONTEND_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:3001",
)


class MyConfig(BaseSettings):
    connection_string : str
    secret_key : str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class FrontendConfig(BaseSettings):
    frontend_origins: str = ",".join(DEFAULT_FRONTEND_ORIGINS)

    # Ignore database and other settings present in the same .env file.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings():
    return MyConfig()


@lru_cache
def get_frontend_origins() -> tuple[str, ...]:
    configured_origins = FrontendConfig().frontend_origins
    origins = (*DEFAULT_FRONTEND_ORIGINS, *(origin.strip() for origin in configured_origins.split(",")))
    return tuple(dict.fromkeys(origin for origin in origins if origin and "*" not in origin))

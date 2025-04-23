from datetime import datetime, timedelta, timezone
import jwt
from pydantic import BaseModel

from models.my_config import get_settings


# Follow these naming conventions for token stuff \/
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    exp_datetime: datetime


ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=60)):
    payload = data.copy()
    # if we have anything for expires_delta, set the expire time to be now + delta
    expire = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expire})
    key = get_settings().secret_key
    encoded = jwt.encode(payload, key, algorithm=ALGORITHM)
    return encoded


# Takes token (presumably from the frontend, and reads to our python class TokenData)
def decode_jwt_token(token: str) -> TokenData | None:
    try:
        key = get_settings().secret_key
        payload = jwt.decode(token, key, algorithms=[ALGORITHM])
        username: str = payload.get("username")
        exp: int = payload.get("exp")
        return TokenData(username=username, exp_datetime=datetime.fromtimestamp(exp))
    except jwt.InvalidTokenError:
        print("Invalid JWT Token.")

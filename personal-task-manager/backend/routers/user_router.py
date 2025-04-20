# GET FROM HIS DEMO
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext

from auth.jwt_auth import Token, TokenData, create_access_token, decode_jwt_token
from models.user import User, UserRequest

pwd_context = CryptContext(schemes=["bcrypt"])


class HashPassword:
    def create_hash(self, password: str):
        return pwd_context.hash(password)

    def verify_hash(self, input_password: str, hashed_password: str):
        return pwd_context.verify(input_password, hashed_password)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/sign-in")
hash_password = HashPassword()


def get_user(token: Annotated[str, Depends(oauth2_scheme)]) -> TokenData:
    print(token)
    return decode_jwt_token(token)


user_router = APIRouter()


@user_router.post("/signup")
async def sign_up(user: UserRequest):
    existing_user = await User.find_one(User.username == user.username)

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists.")

    hashed_password = hash_password.create_hash(user.password)
    if user.username == "gabe":
        new_user = User(
            username=user.username,
            password=hashed_password,
            email=user.email,
            role="admin",
        )
    else:
        new_user = User(
            username=user.username,
            password=hashed_password,
            email=user.email,
            role="user",
        )
    await new_user.create()
    return {"message": "User created successfully", "user": new_user}


@user_router.post("/sign-in")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    ## Authenticate user by verifying the user in DB
    username = (
        form_data.username
    )  # might need trim() or sanitization for trailing whitespace
    existing_user = await User.find_one(User.username == username)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username or Password is not valid.",
        )

    authenticated = hash_password.verify_hash(
        form_data.password, existing_user.password
    )
    if authenticated:
        access_token = create_access_token({"username": username})
        return Token(access_token=access_token)

    return HTTPException(status_code=401, detail="Username or Password is not valid.")

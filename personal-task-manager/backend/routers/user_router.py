# GET FROM HIS DEMO
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext

from auth.jwt_auth import Token, TokenData, create_access_token, decode_jwt_token
from models.user import User, UserRequest
from models.log import Log
from datetime import datetime

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
    token_data = decode_jwt_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_data


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

    # Log the signup action
    now = datetime.now()
    newLog = Log(
        username=user.username,
        endpoint="signup",
        time=now,
        details={"email": user.email, "role": new_user.role},
    )
    await Log.insert_one(newLog)

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
        role = existing_user.role
        access_token = create_access_token({"username": username, "role": role})
        # Log the successful login
        now = datetime.now()
        newLog = Log(
            username=username,
            endpoint="sign-in",
            time=now,
            details={"action": "successful_login"},
        )
        await Log.insert_one(newLog)
        return Token(access_token=access_token)

    # Log the failed login attempt
    now = datetime.now()
    newLog = Log(
        username=username,
        endpoint="sign-in",
        time=now,
        details={"action": "failed_login_attempt"},
    )
    await Log.insert_one(newLog)

    return HTTPException(status_code=401, detail="Username or Password is not valid.")


@user_router.post("/logout")
async def logout(current_user: Annotated[TokenData, Depends(get_user)]):
    # Log the logout action for auditing purposes

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="logout",
        time=now,
        details={"action": "user_logout"},
    )
    await Log.insert_one(newLog)

    return {"message": "Logged out successfully"}


# Admin-only endpoints for user management
@user_router.get("/all")
async def get_all_users(current_user: Annotated[TokenData, Depends(get_user)]):
    # Verify the user is an admin
    user = await User.find_one(User.username == current_user.username)
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Log the admin action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_all_users",
        time=now,
        details={"action": "admin_view_all_users"},
    )
    await Log.insert_one(newLog)

    # Fetch all users without returning password hashes
    all_users = await User.find_all().to_list()
    # Remove password field from response
    users_response = []
    for user in all_users:
        user_dict = user.dict()
        del user_dict["password"]
        users_response.append(user_dict)

    return users_response


@user_router.patch("/{username}/role")
async def update_user_role(
    username: str,
    role: str,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    # Verify the user is an admin
    admin = await User.find_one(User.username == current_user.username)
    if not admin or admin.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Validate role
    if role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'user' or 'admin'",
        )

    # Find the user to update
    user_to_update = await User.find_one(User.username == username)
    if not user_to_update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Don't allow admins to downgrade themselves
    if username == current_user.username and role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot downgrade their own role",
        )

    # Update the role
    user_to_update.role = role
    await user_to_update.save()

    # Log the admin action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_user_role",
        time=now,
        details={
            "target_user": username,
            "new_role": role,
        },
    )
    await Log.insert_one(newLog)

    return {"message": f"User {username} role updated to {role}"}


@user_router.delete("/{username}")
async def delete_user(
    username: str,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    # Verify the user is an admin
    admin = await User.find_one(User.username == current_user.username)
    if not admin or admin.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Find the user to delete
    user_to_delete = await User.find_one(User.username == username)
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await user_to_delete.delete()

    # Log the admin action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="delete_user_role",
        time=now,
        details={
            "target_user": username,
        },
    )
    await Log.insert_one(newLog)

    return {"message": f"User {username} deleted."}

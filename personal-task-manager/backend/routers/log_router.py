from typing import Annotated, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from datetime import datetime, timedelta

from models.log import Log
from models.user import User
from auth.jwt_auth import TokenData
from routers.user_router import get_user

log_router = APIRouter()


# Get all logs (admin only)
@log_router.get("/all", status_code=status.HTTP_200_OK)
async def get_all_logs(
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 50,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    # Verify the user is an admin
    user = await User.find_one(User.username == current_user.username)
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Build query filters
    query_filter = {}
    if start_date and end_date:
        query_filter["time"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query_filter["time"] = {"$gte": start_date}
    elif end_date:
        query_filter["time"] = {"$lte": end_date}

    # Get logs with pagination
    logs = (
        await Log.find(query_filter).sort(-Log.time).skip(skip).limit(limit).to_list()
    )

    # Log this admin action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_all_logs",
        time=now,
        details={
            "action": "admin_view_all_logs",
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        },
    )
    await Log.insert_one(newLog)

    return logs


# Get logs for a specific user (admin only)
@log_router.get("/user/{username}", status_code=status.HTTP_200_OK)
async def get_user_logs(
    username: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 50,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    # Verify the user is an admin
    user = await User.find_one(User.username == current_user.username)
    if not user or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Verify the target user exists
    target_user = await User.find_one(User.username == username)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{username}' not found",
        )

    # Build query filters
    query_filter = {"username": username}
    if start_date and end_date:
        query_filter["time"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query_filter["time"] = {"$gte": start_date}
    elif end_date:
        query_filter["time"] = {"$lte": end_date}

    # Get logs with pagination
    logs = (
        await Log.find(query_filter).sort(-Log.time).skip(skip).limit(limit).to_list()
    )

    # Log this admin action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_user_logs",
        time=now,
        details={
            "action": "admin_view_user_logs",
            "target_user": username,
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        },
    )
    await Log.insert_one(newLog)

    return logs


# Get logs for the authenticated user
@log_router.get("/me", status_code=status.HTTP_200_OK)
async def get_my_logs(
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 50,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    # Build query filters
    query_filter = {"username": current_user.username}
    if start_date and end_date:
        query_filter["time"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query_filter["time"] = {"$gte": start_date}
    elif end_date:
        query_filter["time"] = {"$lte": end_date}

    # Get logs with pagination
    logs = (
        await Log.find(query_filter).sort(-Log.time).skip(skip).limit(limit).to_list()
    )

    # Log this action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_my_logs",
        time=now,
        details={
            "action": "user_view_own_logs",
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        },
    )
    await Log.insert_one(newLog)

    return logs

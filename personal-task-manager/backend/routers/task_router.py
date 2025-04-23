from datetime import datetime, timedelta
from time import strftime
from typing import Annotated, Literal
from beanie import PydanticObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Path, status
from fastapi.encoders import isoformat
from models.task import Task, TaskRequest
from models.log import Log
from auth.jwt_auth import TokenData
from routers.user_router import get_user
from datetime import datetime

task_router = APIRouter()

# levels = ["task", "todo", "gottado"]


# GET Operations
# Get all task types
@task_router.get("/all", status_code=status.HTTP_200_OK)
async def get_all(current_user: Annotated[TokenData, Depends(get_user)]) -> list:
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_all",
        time=now,
        details={"action": "get_all_tasks"},
    )
    await Log.insert_one(newLog)
    return await Task.find(
        Task.username == current_user.username, Task.completed == False
    ).to_list()


# Get tasks
@task_router.get("/tasks", status_code=status.HTTP_200_OK)
async def get_tasks(current_user: Annotated[TokenData, Depends(get_user)]) -> list:
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_tasks",
        time=now,
        details={"level": "task"},
    )
    await Log.insert_one(newLog)
    return await Task.find(
        Task.level == "task",
        Task.username == current_user.username,
        Task.completed == False,
    ).to_list()


# Get todos
@task_router.get("/todos", status_code=status.HTTP_200_OK)
async def get_todos(current_user: Annotated[TokenData, Depends(get_user)]) -> list:
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_todos",
        time=now,
        details={"level": "todo"},
    )
    await Log.insert_one(newLog)
    return await Task.find(
        Task.level == "todo",
        Task.username == current_user.username,
        Task.completed == False,
    ).to_list()


# Get gottados
@task_router.get("/gottados", status_code=status.HTTP_200_OK)
async def get_gottados(current_user: Annotated[TokenData, Depends(get_user)]) -> list:
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_gottados",
        time=now,
        details={"level": "gottado"},
    )
    await Log.insert_one(newLog)
    return await Task.find(
        Task.level == "gottado",
        Task.username == current_user.username,
        Task.completed == False,
    ).to_list()


# Get completed
@task_router.get("/completed", status_code=status.HTTP_200_OK)
async def get_completed(current_user: Annotated[TokenData, Depends(get_user)]) -> dict:
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_completed",
        time=now,
        details={"completed": True},
    )
    await Log.insert_one(newLog)

    completed_items = await Task.find(
        Task.completed == True, Task.username == current_user.username
    ).to_list()

    if completed_items:
        return {"items": completed_items}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No completed tasks"
        )


# POST
# Create a task
@task_router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskRequest, current_user: Annotated[TokenData, Depends(get_user)]
) -> Task:

    # Depending on type of task, set the expired_date (when you would need to re-evaluate its category)
    if not task.expired_date:
        if task.level == "task":
            expired_date = task.created_date + timedelta(days=1)
        elif task.level == "todo":
            expired_date = task.created_date + timedelta(days=7)
        elif task.level == "gottado":
            expired_date = task.created_date + timedelta(days=30)
    else:
        expired_date = task.expired_date

    newTask = Task(
        description=task.description,
        title=task.title,
        tags=task.tags,
        completed=task.completed,
        created_date=task.created_date,
        expired_date=expired_date,
        completed_date=task.completed_date,
        high_priority=task.high_priority,
        level=task.level,
        username=current_user.username,
        has_image=task.has_image,
    )
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="create_task",
        time=now,
        details={"title": task.title, "level": task.level},
    )

    await Task.insert_one(newTask)
    await Log.insert_one(newLog)
    return newTask


# DELETE
# Delete by ID
@task_router.delete("/{id}")
async def delete_task_by_id(
    id: PydanticObjectId, current_user: Annotated[TokenData, Depends(get_user)]
) -> dict:
    task = await Task.get(id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="delete_task",
        time=now,
        details={"id": str(id), "title": task.title},
    )

    await task.delete()
    await Log.insert_one(newLog)
    return {"message": f"The todo with ID={id} has been deleted."}


# PATCH
# Update title
@task_router.patch("/title/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_title(
    id: PydanticObjectId,
    title: Annotated[str, Body(..., min_length=3, max_length=50)],
    current_user: Annotated[TokenData, Depends(get_user)],
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_title",
        time=now,
        details={"id": str(id), "old_title": existing_task.title, "new_title": title},
    )

    existing_task.title = title
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


# Update description
@task_router.patch("/desc/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_desc(
    id: PydanticObjectId,
    desc: Annotated[str, Body(..., min_length=0, max_length=1000000)],
    current_user: Annotated[TokenData, Depends(get_user)],
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_desc",
        time=now,
        details={"id": str(id), "title": existing_task.title},
    )

    existing_task.description = desc
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


# Update expire date (used for keeping the task within its current bucket upon expiration)
@task_router.patch("/expired_date/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_expired_date(
    id: PydanticObjectId,
    expired_date: Annotated[
        datetime,
        Body(
            description="The updated duedate, in datetime format",
            example="0044-03-15T00:00:00",
        ),
    ],
    current_user: Annotated[TokenData, Depends(get_user)],
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_expired_date",
        time=now,
        details={
            "id": str(id),
            "title": existing_task.title,
            "old_expired_date": existing_task.expired_date.isoformat(),
            "new_expired_date": expired_date.isoformat(),
        },
    )

    existing_task.expired_date = expired_date
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


# Update the completed date (when the boolean flips from 0 -> 1)
@task_router.patch("/completed_date/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_completed_date(
    id: PydanticObjectId, current_user: Annotated[TokenData, Depends(get_user)]
) -> Task:
    # Get the current time and make it the completed_date.
    completed_date = datetime.now()
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_completed_date",
        time=now,
        details={
            "id": str(id),
            "title": existing_task.title,
            "old_completed_date": existing_task.completed_date.isoformat(),
            "new_completed_date": completed_date.isoformat(),
        },
    )

    existing_task.completed_date = completed_date
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


@task_router.patch("/high_priority/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_priority(
    id: PydanticObjectId, current_user: Annotated[TokenData, Depends(get_user)]
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    new_priority = not existing_task.high_priority

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_priority",
        time=now,
        details={
            "id": str(id),
            "title": existing_task.title,
            "old_priority": existing_task.high_priority,
            "new_priority": new_priority,
        },
    )

    existing_task.high_priority = new_priority
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


@task_router.patch("/completed/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_completion(
    id: PydanticObjectId, current_user: Annotated[TokenData, Depends(get_user)]
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    new_completion = not existing_task.completed

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_completion",
        time=now,
        details={
            "id": str(id),
            "title": existing_task.title,
            "old_completed": existing_task.completed,
            "new_completed": new_completion,
        },
    )

    existing_task.completed = new_completion
    # Update completed_date if task is being marked as completed
    if new_completion:
        existing_task.completed_date = datetime.now()

    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task


@task_router.patch("/level/{id}", status_code=status.HTTP_202_ACCEPTED)
async def update_task_level(
    id: PydanticObjectId,
    level: Literal["task", "todo", "gottado"],
    current_user: Annotated[TokenData, Depends(get_user)],
) -> Task:
    existing_task = await Task.get(id)
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with ID={id} not found"
        )

    # Check if the task belongs to the current user
    if existing_task.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )

    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="update_task_level",
        time=now,
        details={
            "id": str(id),
            "title": existing_task.title,
            "old_level": existing_task.level,
            "new_level": level,
        },
    )

    # Update expired_date based on new level
    if level == "task":
        expired_date = now + timedelta(days=1)
    elif level == "todo":
        expired_date = now + timedelta(days=7)
    elif level == "gottado":
        expired_date = now + timedelta(days=30)

    existing_task.level = level
    existing_task.expired_date = expired_date
    await existing_task.save()
    await Log.insert_one(newLog)
    return existing_task

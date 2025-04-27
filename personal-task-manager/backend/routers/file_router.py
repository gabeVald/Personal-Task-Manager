from datetime import datetime, timedelta
from time import strftime
from typing import Annotated, Literal, Optional
from beanie import PydanticObjectId
from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Path,
    status,
    UploadFile,
    File as FastAPIFile,
    Form,
)
from fastapi.encoders import isoformat
from models.file import File, FileRequest, FileWithoutData
from models.log import Log
from models.task import Task
from auth.jwt_auth import TokenData
from routers.user_router import get_user
from datetime import datetime
import base64
import logging

# Set up logger
logger = logging.getLogger(__name__)

file_router = APIRouter()


# GET Operations
# Get all files
@file_router.get("/all", status_code=status.HTTP_200_OK)
async def get_all(
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 20,
    include_data: bool = False,
) -> list:
    logger.info(
        f"User {current_user.username} retrieving all files (include_data: {include_data})"
    )
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_all",
        time=now,
        details={"action": "get_all_files", "include_data": include_data},
    )
    await Log.insert_one(newLog)

    # Use find_many instead which has cleaner handling of projections
    if include_data:
        # Include all fields if we need the data
        files = (
            await File.find_many(File.username == current_user.username)
            .sort(-File.upload_date)
            .skip(skip)
            .limit(limit)
            .to_list()
        )
    else:
        # Exclude the data field to reduce response size
        files = (
            await File.find_many(
                File.username == current_user.username, projection_model=FileWithoutData
            )
            .sort(-File.upload_date)
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    # If including data, convert binary data to base64 for direct rendering in frontend
    if include_data:
        for file in files:
            # Convert bytes to base64 string for direct embedding in HTML/CSS
            if hasattr(file, "data") and file.data:
                base64_data = base64.b64encode(file.data).decode("utf-8")
                # Create a data URL that can be used in img src
                file.data = f"data:{file.content_type};base64,{base64_data}"

    logger.info(f"Retrieved {len(files)} files for user {current_user.username}")
    return files


# Get files for a specific task
@file_router.get("/task/{task_id}", status_code=status.HTTP_200_OK)
async def get_files_by_task(
    task_id: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
    include_data: bool = False,
) -> list:
    logger.info(
        f"User {current_user.username} retrieving files for task {task_id} (include_data: {include_data})"
    )
    # Convert string ID to PydanticObjectId
    task_obj_id = PydanticObjectId(task_id)

    # Verify the task exists and belongs to the user
    task = await Task.get(task_obj_id)
    if not task or task.username != current_user.username:
        logger.warning(
            f"Task not found or unauthorized access: {task_id} for user {current_user.username}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or you don't have permission to access it",
        )

    # Log the action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="get_files_by_task",
        time=now,
        details={"task_id": task_id, "include_data": include_data},
    )
    await Log.insert_one(newLog)

    # Use different approaches based on whether we need the data
    if include_data:
        # Include all fields if we need the data
        files = await File.find_many(
            {"task_id": task_obj_id, "username": current_user.username}
        ).to_list()
    else:
        # Exclude the data field to reduce response size
        files = await File.find_many(
            {"task_id": task_obj_id, "username": current_user.username},
            projection_model=FileWithoutData,
        ).to_list()

    # If including data, convert binary data to base64 for direct rendering
    if include_data:
        for file in files:
            if hasattr(file, "data") and file.data:
                base64_data = base64.b64encode(file.data).decode("utf-8")
                file.data = f"data:{file.content_type};base64,{base64_data}"

    logger.info(f"Retrieved {len(files)} files for task {task_id}")
    return files


# Upload a file
@file_router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, FastAPIFile()],
    current_user: Annotated[TokenData, Depends(get_user)],
    description: Optional[str] = Form(None),
    task_id: Optional[str] = Form(None),
):
    logger.info(f"User {current_user.username} uploading file: {file.filename}")
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)

    # Set up the file document
    file_doc = File(
        filename=file.filename,
        content_type=file.content_type,
        data=file_content,
        size=file_size,
        description=description,
        upload_date=datetime.now(),
        username=current_user.username,
    )

    # If task_id is provided, verify it exists and belongs to the user
    if task_id:
        logger.info(f"Associating file with task: {task_id}")
        try:
            task_obj_id = PydanticObjectId(task_id)
            task = await Task.get(task_obj_id)

            if not task:
                logger.warning(f"Task not found: {task_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
                )

            if task.username != current_user.username:
                logger.warning(
                    f"User {current_user.username} attempted to access task {task_id} belonging to {task.username}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to add files to this task",
                )

            # Set the task_id in the file document
            file_doc.task_id = task_obj_id

        except ValueError:
            logger.error(f"Invalid task ID format: {task_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task ID format"
            )

    # Save the file to the database
    await file_doc.insert()
    logger.info(f"File uploaded successfully: ID={file_doc.id}, size={file_size} bytes")

    # Log the action
    now = datetime.now()
    newLog = Log(
        username=current_user.username,
        endpoint="upload_file",
        time=now,
        details={
            "filename": file.filename,
            "size": file_size,
            "task_id": task_id if task_id else None,
        },
    )
    await Log.insert_one(newLog)

    # Return the file ID and metadata (without the binary data)
    return {
        "id": str(file_doc.id),
        "filename": file_doc.filename,
        "size": file_doc.size,
        "content_type": file_doc.content_type,
        "description": file_doc.description,
        "upload_date": file_doc.upload_date,
        "task_id": str(file_doc.task_id) if file_doc.task_id else None,
    }


# Delete a file by id
@file_router.delete("/{file_id}", status_code=status.HTTP_200_OK)
async def delete_file(
    file_id: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
):
    logger.info(f"User {current_user.username} attempting to delete file: {file_id}")
    try:
        # Convert string ID to PydanticObjectId
        file_obj_id = PydanticObjectId(file_id)

        # Find the file first to check ownership
        file = await File.get(file_obj_id)

        if not file:
            logger.warning(f"File not found: {file_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
            )

        # Verify the file belongs to the user
        if file.username != current_user.username:
            logger.warning(
                f"User {current_user.username} attempted to delete file {file_id} belonging to {file.username}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this file",
            )

        # Delete the file
        await file.delete()
        logger.info(f"File deleted successfully: {file_id}, filename: {file.filename}")

        # Log the action
        now = datetime.now()
        newLog = Log(
            username=current_user.username,
            endpoint="delete_file",
            time=now,
            details={"file_id": file_id, "filename": file.filename},
        )
        await Log.insert_one(newLog)

        return {"message": "File deleted successfully", "id": file_id}

    except ValueError:
        logger.error(f"Invalid file ID format: {file_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file ID format"
        )

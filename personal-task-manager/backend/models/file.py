# MODEL FOR ACCEPTING AND DEFINING FILES

from datetime import datetime
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field
from beanie import Document, PydanticObjectId


class File(Document):
    filename: str
    content_type: str
    data: bytes
    size: int
    description: Optional[str] = None
    upload_date: datetime
    username: str  # The user who uploaded the file
    task_id: Optional[PydanticObjectId] = None  # Reference to the associated task

    class Settings:
        name = "files"


class FileWithoutData(BaseModel):
    """Projection model for File without the data field"""

    id: PydanticObjectId = Field(alias="_id")
    filename: str
    content_type: str
    size: int
    description: Optional[str] = None
    upload_date: datetime
    username: str
    task_id: Optional[PydanticObjectId] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {PydanticObjectId: str},
    }


class FileRequest(BaseModel):
    """
    Model for file metadata when uploading
    (The actual file data will be handled separately through form data)
    """

    description: Optional[str] = None
    task_id: Optional[str] = None  # String version of task ID

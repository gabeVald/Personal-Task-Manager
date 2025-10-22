from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field


class OFXFile(Document):
    """Model for uploaded OFX files"""

    filename: str
    original_filename: str
    file_size: int
    upload_date: datetime
    parsed_status: str = "pending"  # pending, success, error
    parse_error: Optional[str] = None
    username: str  # The user who uploaded the file
    transaction_count: int = 0  # Number of transactions parsed

    class Settings:
        name = "ofx_files"


class Transaction(Document):
    """Model for individual transactions from OFX files"""

    ofx_file_id: PydanticObjectId  # Reference to the OFX file
    transaction_date: datetime
    merchant_payee: str
    amount: float  # Positive for credits, negative for debits
    transaction_type: str  # debit, credit
    description: Optional[str] = None
    category: str = "Uncategorized"  # Default category
    username: str  # The user who owns this transaction

    class Settings:
        name = "transactions"


class OFXFileRequest(BaseModel):
    """Model for OFX file upload request"""

    description: Optional[str] = None


class TransactionUpdate(BaseModel):
    """Model for updating transaction category"""

    category: str


class CategorySummary(BaseModel):
    """Model for category spending summary"""

    category: str
    total_amount: float
    transaction_count: int
    percentage: float


class MonthlySummary(BaseModel):
    """Model for monthly spending summary"""

    month: str
    total_spent: float
    total_income: float
    categories: list[CategorySummary]

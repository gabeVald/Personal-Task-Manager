from datetime import datetime, timedelta
from typing import Annotated, Optional
from beanie import PydanticObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    status,
    UploadFile,
    File as FastAPIFile,
    Form,
)
from fastapi.responses import JSONResponse
from models.ofx_file import (
    OFXFile,
    Transaction,
    OFXFileRequest,
    TransactionUpdate,
    CategorySummary,
    MonthlySummary,
)
from models.log import Log
from auth.jwt_auth import TokenData
from routers.user_router import get_user
from ofxparse import OfxParser
import logging
import io

# Set up logger
logger = logging.getLogger(__name__)

ofx_router = APIRouter()

# Define spending categories
SPENDING_CATEGORIES = [
    "Food, Dining & Entertainment",
    "Auto, Commute & Travel",
    "Shopping",
    "Bills & Subscriptions",
    "Family & Pets",
    "Other Expenses",
    "Health & Personal Care",
]


@ofx_router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_ofx_file(
    file: Annotated[UploadFile, FastAPIFile()],
    current_user: Annotated[TokenData, Depends(get_user)],
    description: Optional[str] = Form(None),
):
    """Upload and parse an OFX file"""
    logger.info(f"User {current_user.username} uploading OFX file: {file.filename}")

    # Validate file type
    if not file.filename.lower().endswith((".ofx", ".qfx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only OFX and QFX files are supported",
        )

    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        # Create OFX file record
        ofx_file = OFXFile(
            filename=f"{current_user.username}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}",
            original_filename=file.filename,
            file_size=file_size,
            upload_date=datetime.now(),
            parsed_status="pending",
            username=current_user.username,
        )

        # Save OFX file record
        await ofx_file.insert()

        # Parse OFX content
        try:
            ofx_content = file_content.decode("utf-8")
            parsed_data = OfxParser.parse(io.StringIO(ofx_content))

            transaction_count = 0

            # Extract transactions from parsed data
            if hasattr(parsed_data, "account") and parsed_data.account:
                account = parsed_data.account
                if hasattr(account, "statement") and account.statement:
                    statement = account.statement
                    if hasattr(statement, "transactions") and statement.transactions:
                        for tx in statement.transactions:
                            # Create transaction record
                            transaction = Transaction(
                                ofx_file_id=ofx_file.id,
                                transaction_date=tx.date,
                                merchant_payee=tx.payee or "Unknown",
                                amount=float(tx.amount),
                                transaction_type=(
                                    "debit" if float(tx.amount) < 0 else "credit"
                                ),
                                description=tx.memo or "",
                                category="Uncategorized",
                                username=current_user.username,
                            )
                            await transaction.insert()
                            transaction_count += 1

            # Update OFX file with success status
            ofx_file.parsed_status = "success"
            ofx_file.transaction_count = transaction_count
            await ofx_file.save()

            logger.info(
                f"Successfully parsed {transaction_count} transactions from {file.filename}"
            )

        except Exception as parse_error:
            logger.error(f"Error parsing OFX file {file.filename}: {str(parse_error)}")
            ofx_file.parsed_status = "error"
            ofx_file.parse_error = str(parse_error)
            await ofx_file.save()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse OFX file: {str(parse_error)}",
            )

        # Log the action
        now = datetime.now()
        log_entry = Log(
            username=current_user.username,
            endpoint="upload_ofx_file",
            time=now,
            details={
                "filename": file.filename,
                "file_size": file_size,
                "transaction_count": transaction_count,
                "status": ofx_file.parsed_status,
            },
        )
        await Log.insert_one(log_entry)

        return {
            "message": "OFX file uploaded and parsed successfully",
            "file_id": str(ofx_file.id),
            "transaction_count": transaction_count,
            "status": ofx_file.parsed_status,
        }

    except Exception as e:
        logger.error(f"Error uploading OFX file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


@ofx_router.get("/files", status_code=status.HTTP_200_OK)
async def get_ofx_files(
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 20,
):
    """Get all OFX files for the current user"""
    logger.info(f"User {current_user.username} retrieving OFX files")

    files = (
        await OFXFile.find(OFXFile.username == current_user.username)
        .sort(-OFXFile.upload_date)
        .skip(skip)
        .limit(limit)
        .to_list()
    )

    # Log the action
    now = datetime.now()
    log_entry = Log(
        username=current_user.username,
        endpoint="get_ofx_files",
        time=now,
        details={"count": len(files)},
    )
    await Log.insert_one(log_entry)

    return files


@ofx_router.get("/files/{file_id}", status_code=status.HTTP_200_OK)
async def get_ofx_file(
    file_id: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Get a specific OFX file and its transactions"""
    logger.info(f"User {current_user.username} retrieving OFX file {file_id}")

    try:
        file_obj_id = PydanticObjectId(file_id)

        # Get OFX file
        ofx_file = await OFXFile.get(file_obj_id)
        if not ofx_file or ofx_file.username != current_user.username:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OFX file not found or access denied",
            )

        # Get transactions for this file
        transactions = (
            await Transaction.find(Transaction.ofx_file_id == file_obj_id)
            .sort(-Transaction.transaction_date)
            .to_list()
        )

        return {
            "file": ofx_file,
            "transactions": transactions,
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file ID format"
        )


@ofx_router.delete("/files/{file_id}", status_code=status.HTTP_200_OK)
async def delete_ofx_file(
    file_id: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Delete an OFX file and all its transactions"""
    logger.info(f"User {current_user.username} deleting OFX file {file_id}")

    try:
        file_obj_id = PydanticObjectId(file_id)

        # Get OFX file
        ofx_file = await OFXFile.get(file_obj_id)
        if not ofx_file or ofx_file.username != current_user.username:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OFX file not found or access denied",
            )

        # Delete all transactions for this file
        await Transaction.find(Transaction.ofx_file_id == file_obj_id).delete()

        # Delete the OFX file
        await ofx_file.delete()

        # Log the action
        now = datetime.now()
        log_entry = Log(
            username=current_user.username,
            endpoint="delete_ofx_file",
            time=now,
            details={"file_id": file_id, "filename": ofx_file.original_filename},
        )
        await Log.insert_one(log_entry)

        return {"message": "OFX file and transactions deleted successfully"}

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file ID format"
        )


@ofx_router.get("/transactions", status_code=status.HTTP_200_OK)
async def get_transactions(
    current_user: Annotated[TokenData, Depends(get_user)],
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    transaction_type: Optional[str] = "debit",  # Default to debit (spending)
):
    """Get transactions for the current user with optional filtering"""
    logger.info(f"User {current_user.username} retrieving transactions")

    # Build query
    query = {"username": current_user.username}

    if category:
        query["category"] = category

    if transaction_type:
        query["transaction_type"] = transaction_type

    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["transaction_date"] = date_query

    transactions = (
        await Transaction.find(query)
        .sort(-Transaction.transaction_date)
        .skip(skip)
        .limit(limit)
        .to_list()
    )

    return transactions


@ofx_router.patch(
    "/transactions/{transaction_id}/category", status_code=status.HTTP_200_OK
)
async def update_transaction_category(
    transaction_id: Annotated[str, Path()],
    category_update: TransactionUpdate,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Update the category of a specific transaction"""
    logger.info(
        f"User {current_user.username} updating transaction {transaction_id} category"
    )

    try:
        tx_obj_id = PydanticObjectId(transaction_id)

        # Get transaction
        transaction = await Transaction.get(tx_obj_id)
        if not transaction or transaction.username != current_user.username:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found or access denied",
            )

        # Update category
        transaction.category = category_update.category
        await transaction.save()

        # Log the action
        now = datetime.now()
        log_entry = Log(
            username=current_user.username,
            endpoint="update_transaction_category",
            time=now,
            details={
                "transaction_id": transaction_id,
                "old_category": transaction.category,
                "new_category": category_update.category,
            },
        )
        await Log.insert_one(log_entry)

        return {"message": "Transaction category updated successfully"}

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction ID format",
        )


@ofx_router.get("/categories", status_code=status.HTTP_200_OK)
async def get_categories():
    """Get available spending categories"""
    return {"categories": SPENDING_CATEGORIES}


@ofx_router.get("/summary", status_code=status.HTTP_200_OK)
async def get_spending_summary(
    current_user: Annotated[TokenData, Depends(get_user)],
    month: Optional[str] = None,
):
    """Get spending summary by category"""
    logger.info(f"User {current_user.username} retrieving spending summary")

    # Calculate date range for the month
    if month:
        try:
            # month format: YYYY-MM
            year, month_num = map(int, month.split("-"))
            start_date = datetime(year, month_num, 1)
            if month_num == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month_num + 1, 1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid month format. Use YYYY-MM",
            )
    else:
        # Default to current month
        now = datetime.now()
        start_date = datetime(now.year, now.month, 1)
        if now.month == 12:
            end_date = datetime(now.year + 1, 1, 1)
        else:
            end_date = datetime(now.year, now.month + 1, 1)

    # Get transactions for the month (only debits - spending)
    transactions = await Transaction.find(
        {
            "username": current_user.username,
            "transaction_date": {"$gte": start_date, "$lt": end_date},
            "transaction_type": "debit",  # Only count debits (spending)
        }
    ).to_list()

    # Calculate category summaries
    category_totals = {}
    total_spent = 0

    for tx in transactions:
        category = tx.category
        amount = abs(tx.amount)  # Convert to positive for spending

        if category not in category_totals:
            category_totals[category] = {"amount": 0, "count": 0}

        category_totals[category]["amount"] += amount
        category_totals[category]["count"] += 1
        total_spent += amount

    # Create category summaries
    categories = []
    for category, data in category_totals.items():
        percentage = (data["amount"] / total_spent * 100) if total_spent > 0 else 0
        categories.append(
            CategorySummary(
                category=category,
                total_amount=data["amount"],
                transaction_count=data["count"],
                percentage=round(percentage, 2),
            )
        )

    # Sort by amount descending
    categories.sort(key=lambda x: x.total_amount, reverse=True)

    # Log the action
    now = datetime.now()
    log_entry = Log(
        username=current_user.username,
        endpoint="get_spending_summary",
        time=now,
        details={
            "month": month,
            "total_spent": total_spent,
            "category_count": len(categories),
        },
    )
    await Log.insert_one(log_entry)

    return {
        "month": month or f"{now.year}-{now.month:02d}",
        "total_spent": round(total_spent, 2),
        "categories": categories,
    }


@ofx_router.get("/summary/multi-month", status_code=status.HTTP_200_OK)
async def get_multi_month_summary(
    current_user: Annotated[TokenData, Depends(get_user)],
    start_month: str,  # YYYY-MM format
    end_month: str,  # YYYY-MM format
):
    """Get spending summary across multiple months"""
    logger.info(f"User {current_user.username} retrieving multi-month spending summary")

    try:
        # Parse start and end months
        start_year, start_month_num = map(int, start_month.split("-"))
        end_year, end_month_num = map(int, end_month.split("-"))

        # Calculate date range
        start_date = datetime(start_year, start_month_num, 1)
        if end_month_num == 12:
            end_date = datetime(end_year + 1, 1, 1)
        else:
            end_date = datetime(end_year, end_month_num + 1, 1)

        # Get transactions for the date range (only debits - spending)
        transactions = await Transaction.find(
            {
                "username": current_user.username,
                "transaction_date": {"$gte": start_date, "$lt": end_date},
                "transaction_type": "debit",  # Only count debits (spending)
            }
        ).to_list()

        # Calculate category summaries
        category_totals = {}
        total_spent = 0
        monthly_totals = {}

        for tx in transactions:
            category = tx.category
            amount = abs(tx.amount)  # Convert to positive for spending
            month_key = tx.transaction_date.strftime("%Y-%m")

            # Category totals
            if category not in category_totals:
                category_totals[category] = {"amount": 0, "count": 0}
            category_totals[category]["amount"] += amount
            category_totals[category]["count"] += 1
            total_spent += amount

            # Monthly totals
            if month_key not in monthly_totals:
                monthly_totals[month_key] = {"amount": 0, "count": 0}
            monthly_totals[month_key]["amount"] += amount
            monthly_totals[month_key]["count"] += 1

        # Create category summaries
        categories = []
        for category, data in category_totals.items():
            percentage = (data["amount"] / total_spent * 100) if total_spent > 0 else 0
            categories.append(
                CategorySummary(
                    category=category,
                    total_amount=data["amount"],
                    transaction_count=data["count"],
                    percentage=round(percentage, 2),
                )
            )

        # Sort by amount descending
        categories.sort(key=lambda x: x.total_amount, reverse=True)

        # Log the action
        now = datetime.now()
        log_entry = Log(
            username=current_user.username,
            endpoint="get_multi_month_summary",
            time=now,
            details={
                "start_month": start_month,
                "end_month": end_month,
                "total_spent": total_spent,
                "category_count": len(categories),
                "month_count": len(monthly_totals),
            },
        )
        await Log.insert_one(log_entry)

        return {
            "start_month": start_month,
            "end_month": end_month,
            "total_spent": round(total_spent, 2),
            "categories": categories,
            "monthly_totals": monthly_totals,
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month format. Use YYYY-MM",
        )

from datetime import datetime
from typing import Annotated, Literal, Optional
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
from models.ofx_file import (
    OFXFile,
    Transaction,
    TransactionUpdate,
    CategorySummary,
)
from models.budget_target import (
    BudgetTarget,
    BudgetTargetRequest,
    is_valid_month,
)
from models.merchant_category_rule import (
    MerchantCategoryRule,
    MerchantCategoryRuleRequest,
)
from models.log import Log
from auth.jwt_auth import TokenData
from routers.user_router import get_user
from ofxparse import OfxParser
from csv_transaction_parser import (
    CSVFormatError,
    SPENDING_CATEGORIES,
    is_pending_status,
    parse_csv_transactions,
)
from merchant_category_rules import category_for_merchant
import logging
import io

# Set up logger
logger = logging.getLogger(__name__)

ofx_router = APIRouter()


def _month_date_range(month: str) -> tuple[datetime, datetime]:
    if not is_valid_month(month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month format. Use YYYY-MM",
        )
    year, month_number = map(int, month.split("-"))
    start_date = datetime(year, month_number, 1)
    if month_number == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month_number + 1, 1)
    return start_date, end_date


@ofx_router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_ofx_file(
    file: Annotated[UploadFile, FastAPIFile()],
    current_user: Annotated[TokenData, Depends(get_user)],
    description: Optional[str] = Form(None),
):
    """Upload and parse an OFX, QFX, or CSV transaction export."""
    filename = file.filename or ""
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    logger.info(f"User {current_user.username} uploading budget file: {filename}")

    if extension not in {"ofx", "qfx", "csv"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only OFX, QFX, and CSV files are supported",
        )

    try:
        file_content = await file.read()
        file_size = len(file_content)
        now = datetime.now()
        ofx_file = OFXFile(
            filename=f"{current_user.username}_{now.strftime('%Y%m%d_%H%M%S')}_{filename}",
            original_filename=filename,
            file_size=file_size,
            upload_date=now,
            parsed_status="pending",
            username=current_user.username,
        )
        await ofx_file.insert()

        transaction_count = 0
        duplicate_count = 0
        invalid_rows = []
        category_rules = await MerchantCategoryRule.find(
            MerchantCategoryRule.username == current_user.username
        ).to_list()

        if extension == "csv":
            try:
                parsed_csv = parse_csv_transactions(file_content)
            except CSVFormatError as parse_error:
                ofx_file.parsed_status = "error"
                ofx_file.parse_error = str(parse_error)
                await ofx_file.save()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to parse CSV file: {parse_error}",
                ) from parse_error

            duplicate_count = parsed_csv.duplicate_count
            invalid_rows = parsed_csv.invalid_rows
            source_ids = {
                transaction.source_transaction_id
                for transaction in parsed_csv.transactions
                if transaction.source_transaction_id
            }
            existing_source_ids = set()
            if source_ids:
                existing_transactions = await Transaction.find(
                    {
                        "username": current_user.username,
                        "source_transaction_id": {"$in": list(source_ids)},
                    }
                ).to_list()
                existing_source_ids = {
                    transaction.source_transaction_id
                    for transaction in existing_transactions
                }

            for parsed_transaction in parsed_csv.transactions:
                source_id = parsed_transaction.source_transaction_id
                if source_id and source_id in existing_source_ids:
                    duplicate_count += 1
                    continue
                transaction = Transaction(
                    ofx_file_id=ofx_file.id,
                    transaction_date=parsed_transaction.transaction_date,
                    merchant_payee=parsed_transaction.merchant_payee,
                    amount=parsed_transaction.amount,
                    transaction_type=parsed_transaction.transaction_type,
                    description=parsed_transaction.description,
                    category=category_for_merchant(
                        parsed_transaction.merchant_payee,
                        category_rules,
                        parsed_transaction.category,
                    ),
                    source_category=parsed_transaction.source_category,
                    source_transaction_id=source_id,
                    posting_status=parsed_transaction.posting_status,
                    username=current_user.username,
                )
                await transaction.insert()
                transaction_count += 1
        else:
            try:
                ofx_content = file_content.decode("utf-8")
                parsed_data = OfxParser.parse(io.StringIO(ofx_content))
                account = getattr(parsed_data, "account", None)
                statement = getattr(account, "statement", None) if account else None
                transactions = getattr(statement, "transactions", []) if statement else []

                for tx in transactions or []:
                    amount = float(tx.amount)
                    transaction = Transaction(
                        ofx_file_id=ofx_file.id,
                        transaction_date=tx.date,
                        merchant_payee=tx.payee or "Unknown",
                        amount=amount,
                        transaction_type="debit" if amount < 0 else "credit",
                        description=tx.memo or "",
                        category=category_for_merchant(
                            tx.payee or "Unknown", category_rules, "Uncategorized"
                        ),
                        username=current_user.username,
                    )
                    await transaction.insert()
                    transaction_count += 1
            except Exception as parse_error:
                logger.error(f"Error parsing OFX file {filename}: {parse_error}")
                ofx_file.parsed_status = "error"
                ofx_file.parse_error = str(parse_error)
                await ofx_file.save()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to parse OFX file: {parse_error}",
                ) from parse_error

        ofx_file.parsed_status = "success"
        ofx_file.transaction_count = transaction_count
        await ofx_file.save()

        log_entry = Log(
            username=current_user.username,
            endpoint="upload_ofx_file",
            time=datetime.now(),
            details={
                "filename": filename,
                "file_size": file_size,
                "transaction_count": transaction_count,
                "duplicate_count": duplicate_count,
                "invalid_row_count": len(invalid_rows),
                "status": ofx_file.parsed_status,
            },
        )
        await Log.insert_one(log_entry)

        response = {
            "message": (
                "CSV file uploaded and parsed successfully"
                if extension == "csv"
                else "OFX file uploaded and parsed successfully"
            ),
            "file_id": str(ofx_file.id),
            "transaction_count": transaction_count,
            "status": ofx_file.parsed_status,
        }
        if extension == "csv":
            response["duplicate_count"] = duplicate_count
            response["invalid_rows"] = invalid_rows
        return response
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error uploading budget file {filename}: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {error}",
        ) from error


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
    month: Optional[str] = None,
    transaction_type: Optional[str] = "debit",  # Default to debit (spending)
    sort_by: Literal["date", "merchant", "amount"] = "date",
    sort_order: Literal["asc", "desc"] = "desc",
):
    """Get transactions for the current user with optional filtering"""
    logger.info(f"User {current_user.username} retrieving transactions")

    # Build query
    query = {"username": current_user.username}

    if category:
        query["category"] = category

    if transaction_type:
        query["transaction_type"] = transaction_type

    if month:
        month_start, month_end = _month_date_range(month)
        date_query = {"$gte": month_start, "$lt": month_end}
        if start_date:
            date_query["$gte"] = max(month_start, start_date)
        if end_date:
            date_query["$lte"] = end_date
        query["transaction_date"] = date_query
    elif start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["transaction_date"] = date_query

    sort_fields = {
        "date": Transaction.transaction_date,
        "merchant": Transaction.merchant_payee,
        "amount": Transaction.amount,
    }
    sort_direction = 1 if sort_order == "asc" else -1
    # Debits are stored as negative values but displayed as positive spending amounts.
    if sort_by == "amount" and transaction_type == "debit":
        sort_direction *= -1
    sort_field = sort_fields[sort_by]
    sort_expression = sort_field if sort_direction == 1 else -sort_field

    transactions = (
        await Transaction.find(query)
        .sort(sort_expression)
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


def _category_rule_response(rule: MerchantCategoryRule) -> dict:
    return {
        "id": str(rule.id),
        "merchant_match": rule.merchant_match,
        "category": rule.category,
    }


def _validate_rule_category(category: str) -> None:
    if category not in (*SPENDING_CATEGORIES, "Uncategorized"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose one of the available spending categories",
        )


@ofx_router.get("/category-rules", status_code=status.HTTP_200_OK)
async def get_merchant_category_rules(
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Get merchant category rules belonging to the authenticated user."""
    rules = await MerchantCategoryRule.find(
        MerchantCategoryRule.username == current_user.username
    ).to_list()
    rules.sort(key=lambda rule: rule.merchant_match.casefold())
    return [_category_rule_response(rule) for rule in rules]


@ofx_router.post("/category-rules", status_code=status.HTTP_200_OK)
async def create_or_update_merchant_category_rule(
    rule_request: MerchantCategoryRuleRequest,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Create or update a case-insensitive merchant text matching rule."""
    _validate_rule_category(rule_request.category)
    rules = await MerchantCategoryRule.find(
        MerchantCategoryRule.username == current_user.username
    ).to_list()
    matching_rule = next(
        (
            rule
            for rule in rules
            if rule.merchant_match.casefold()
            == rule_request.merchant_match.casefold()
        ),
        None,
    )
    if matching_rule:
        matching_rule.merchant_match = rule_request.merchant_match
        matching_rule.category = rule_request.category
        await matching_rule.save()
        rule = matching_rule
    else:
        rule = MerchantCategoryRule(
            username=current_user.username,
            merchant_match=rule_request.merchant_match,
            category=rule_request.category,
        )
        await rule.insert()
    return _category_rule_response(rule)


@ofx_router.put("/category-rules/{rule_id}", status_code=status.HTTP_200_OK)
async def update_merchant_category_rule(
    rule_id: Annotated[str, Path()],
    rule_request: MerchantCategoryRuleRequest,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Edit an authenticated user's merchant category rule."""
    _validate_rule_category(rule_request.category)
    try:
        rule = await MerchantCategoryRule.get(PydanticObjectId(rule_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule ID format"
        )
    if not rule or rule.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category rule not found or access denied",
        )

    existing_rules = await MerchantCategoryRule.find(
        MerchantCategoryRule.username == current_user.username
    ).to_list()
    if any(
        existing.id != rule.id
        and existing.merchant_match.casefold() == rule_request.merchant_match.casefold()
        for existing in existing_rules
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A rule for this merchant text already exists",
        )

    rule.merchant_match = rule_request.merchant_match
    rule.category = rule_request.category
    await rule.save()
    return _category_rule_response(rule)


@ofx_router.delete("/category-rules/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_merchant_category_rule(
    rule_id: Annotated[str, Path()],
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Delete an authenticated user's merchant category rule."""
    try:
        rule = await MerchantCategoryRule.get(PydanticObjectId(rule_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid rule ID format"
        )
    if not rule or rule.username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category rule not found or access denied",
        )
    await rule.delete()
    return {"message": "Category rule deleted successfully"}


@ofx_router.get("/categories", status_code=status.HTTP_200_OK)
async def get_categories():
    """Get available spending categories"""
    return {"categories": SPENDING_CATEGORIES}


@ofx_router.get("/targets", status_code=status.HTTP_200_OK)
async def get_budget_targets(
    current_user: Annotated[TokenData, Depends(get_user)],
    month: str,
):
    """Get monthly category targets belonging to the authenticated user."""
    _month_date_range(month)
    target_document = await BudgetTarget.find_one(
        {"username": current_user.username, "month": month}
    )
    targets = target_document.targets if target_document else []
    return {
        "month": month,
        "targets": [
            {"category": target.category, "amount": target.amount}
            for target in targets
        ],
    }


@ofx_router.put("/targets", status_code=status.HTTP_200_OK)
async def save_budget_targets(
    request: BudgetTargetRequest,
    current_user: Annotated[TokenData, Depends(get_user)],
):
    """Replace the authenticated user's category targets for one month."""
    categories = [target.category.casefold() for target in request.targets]
    if len(categories) != len(set(categories)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Each category can only have one target per month",
        )

    target_document = await BudgetTarget.find_one(
        {"username": current_user.username, "month": request.month}
    )
    if target_document:
        target_document.targets = request.targets
        await target_document.save()
    else:
        target_document = BudgetTarget(
            username=current_user.username,
            month=request.month,
            targets=request.targets,
        )
        await target_document.insert()

    return {
        "month": request.month,
        "targets": [
            {"category": target.category, "amount": target.amount}
            for target in request.targets
        ],
    }


@ofx_router.get("/summary", status_code=status.HTTP_200_OK)
async def get_spending_summary(
    current_user: Annotated[TokenData, Depends(get_user)],
    month: Optional[str] = None,
):
    """Get spending summary by category"""
    logger.info(f"User {current_user.username} retrieving spending summary")

    now = datetime.now()
    effective_month = month or f"{now.year}-{now.month:02d}"
    start_date, end_date = _month_date_range(effective_month)

    transactions = await Transaction.find(
        {
            "username": current_user.username,
            "transaction_date": {"$gte": start_date, "$lt": end_date},
        }
    ).to_list()

    category_totals = {}
    daily_totals_by_category = {}
    total_spent = 0.0
    total_income = 0.0
    pending_count = 0

    for tx in transactions:
        if is_pending_status(tx.posting_status):
            pending_count += 1
            continue
        if tx.transaction_type == "credit":
            total_income += abs(tx.amount)
            continue
        if tx.transaction_type != "debit":
            continue

        category = tx.category
        amount = abs(tx.amount)  # Convert to positive for spending

        if category not in category_totals:
            category_totals[category] = {"amount": 0, "count": 0}

        category_totals[category]["amount"] += amount
        category_totals[category]["count"] += 1
        day = tx.transaction_date.strftime("%Y-%m-%d")
        day_categories = daily_totals_by_category.setdefault(day, {})
        if category not in day_categories:
            day_categories[category] = {"amount": 0, "count": 0}
        day_categories[category]["amount"] += amount
        day_categories[category]["count"] += 1
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
            "month": effective_month,
            "total_spent": round(total_spent, 2),
            "total_income": round(total_income, 2),
            "pending_count": pending_count,
            "category_count": len(categories),
        },
    )
    await Log.insert_one(log_entry)

    return {
        "month": effective_month,
        "total_spent": round(total_spent, 2),
        "total_income": round(total_income, 2),
        "net_cash_flow": round(total_income - total_spent, 2),
        "pending_count": pending_count,
        "categories": categories,
        "daily_totals_by_category": {
            day: {
                category: {"amount": round(data["amount"], 2), "count": data["count"]}
                for category, data in day_categories.items()
            }
            for day, day_categories in daily_totals_by_category.items()
        },
    }


@ofx_router.get("/summary/multi-month", status_code=status.HTTP_200_OK)
async def get_multi_month_summary(
    current_user: Annotated[TokenData, Depends(get_user)],
    start_month: str,  # YYYY-MM format
    end_month: str,  # YYYY-MM format
):
    """Get spending summary across multiple months"""
    logger.info(f"User {current_user.username} retrieving multi-month spending summary")

    start_date, _ = _month_date_range(start_month)
    end_month_start, end_date = _month_date_range(end_month)
    if start_date > end_month_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_month must be on or before end_month",
        )

    transactions = await Transaction.find(
        {
            "username": current_user.username,
            "transaction_date": {"$gte": start_date, "$lt": end_date},
        }
    ).to_list()

    category_totals = {}
    monthly_totals = {}
    monthly_categories = {}
    cursor = start_date
    while cursor <= end_month_start:
        month_key = cursor.strftime("%Y-%m")
        monthly_totals[month_key] = {"amount": 0.0, "count": 0}
        monthly_categories[month_key] = {}
        if cursor.month == 12:
            cursor = datetime(cursor.year + 1, 1, 1)
        else:
            cursor = datetime(cursor.year, cursor.month + 1, 1)

    total_spent = 0.0
    total_income = 0.0
    pending_count = 0
    for tx in transactions:
        if is_pending_status(tx.posting_status):
            pending_count += 1
            continue
        if tx.transaction_type == "credit":
            total_income += abs(tx.amount)
            continue
        if tx.transaction_type != "debit":
            continue

        category = tx.category
        amount = abs(tx.amount)
        month_key = tx.transaction_date.strftime("%Y-%m")

        if category not in category_totals:
            category_totals[category] = {"amount": 0.0, "count": 0}
        category_totals[category]["amount"] += amount
        category_totals[category]["count"] += 1
        total_spent += amount

        monthly_totals[month_key]["amount"] += amount
        monthly_totals[month_key]["count"] += 1
        monthly_categories[month_key][category] = (
            monthly_categories[month_key].get(category, 0.0) + amount
        )

    categories = []
    for category, data in category_totals.items():
        percentage = (data["amount"] / total_spent * 100) if total_spent > 0 else 0
        categories.append(
            CategorySummary(
                category=category,
                total_amount=round(data["amount"], 2),
                transaction_count=data["count"],
                percentage=round(percentage, 2),
            )
        )
    categories.sort(key=lambda item: item.total_amount, reverse=True)

    for totals in monthly_totals.values():
        totals["amount"] = round(totals["amount"], 2)
    for category_totals_by_month in monthly_categories.values():
        for category, amount in category_totals_by_month.items():
            category_totals_by_month[category] = round(amount, 2)

    log_entry = Log(
        username=current_user.username,
        endpoint="get_multi_month_summary",
        time=datetime.now(),
        details={
            "start_month": start_month,
            "end_month": end_month,
            "total_spent": round(total_spent, 2),
            "total_income": round(total_income, 2),
            "pending_count": pending_count,
            "category_count": len(categories),
            "month_count": len(monthly_totals),
        },
    )
    await Log.insert_one(log_entry)

    return {
        "start_month": start_month,
        "end_month": end_month,
        "total_spent": round(total_spent, 2),
        "total_income": round(total_income, 2),
        "net_cash_flow": round(total_income - total_spent, 2),
        "pending_count": pending_count,
        "categories": categories,
        "monthly_totals": monthly_totals,
        "monthly_categories": monthly_categories,
    }

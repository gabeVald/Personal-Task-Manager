"""Pure CSV transaction parsing helpers for budget imports."""

import csv
import io
import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional


SPENDING_CATEGORIES = (
    "Food, Dining & Entertainment",
    "Auto, Commute & Travel",
    "Shopping",
    "Bills & Subscriptions",
    "Family & Pets",
    "Other Expenses",
    "Health & Personal Care",
)
KNOWN_CATEGORIES = SPENDING_CATEGORIES + ("Uncategorized",)

PENDING_STATUSES = {
    "authorization",
    "authorized",
    "hold",
    "on hold",
    "pending",
    "processing",
    "queued",
    "unsettled",
}


class CSVFormatError(ValueError):
    """Raised when a CSV cannot be interpreted as a transaction export."""


@dataclass(frozen=True)
class ParsedCSVTransaction:
    transaction_date: datetime
    merchant_payee: str
    amount: float
    transaction_type: str
    description: str
    category: str
    source_category: Optional[str]
    source_transaction_id: Optional[str]
    posting_status: str


@dataclass
class CSVParseResult:
    transactions: list[ParsedCSVTransaction]
    duplicate_count: int
    invalid_rows: list[dict]


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _parse_date(value: str) -> datetime:
    value = value.strip()
    if not value:
        raise ValueError("Posting Date is required")

    iso_value = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(iso_value)
    except ValueError:
        parsed = None

    if parsed is None:
        for date_format in (
            "%m/%d/%Y",
            "%m/%d/%y",
            "%Y/%m/%d",
            "%m-%d-%Y",
            "%m-%d-%y",
        ):
            try:
                parsed = datetime.strptime(value, date_format)
                break
            except ValueError:
                continue

    if parsed is None:
        raise ValueError("Posting Date must be a valid date")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _parse_amount(value: str) -> float:
    value = value.strip()
    if not value:
        raise ValueError("Amount is required")

    is_parenthesized_negative = value.startswith("(") and value.endswith(")")
    if is_parenthesized_negative:
        value = value[1:-1].strip()
    value = value.replace(",", "").replace("$", "").strip()

    try:
        amount = Decimal(value)
    except InvalidOperation as error:
        raise ValueError("Amount must be a valid number") from error
    if not amount.is_finite():
        raise ValueError("Amount must be a finite number")
    if is_parenthesized_negative:
        amount = -abs(amount)
    float_amount = float(amount)
    if not math.isfinite(float_amount):
        raise ValueError("Amount must be a finite number")
    return float_amount


def _field_value(row: dict, headers: dict[str, str], *aliases: str) -> str:
    for alias in aliases:
        header = headers.get(alias)
        if header is not None:
            value = row.get(header)
            return value.strip() if isinstance(value, str) else ""
    return ""


def parse_csv_transactions(content: str | bytes) -> CSVParseResult:
    """Parse a bank CSV with required Posting Date and Amount columns.

    Invalid records are returned with their logical CSV row number. Repeated
    source transaction IDs within this file are skipped and counted.
    """
    if isinstance(content, bytes):
        try:
            content = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise CSVFormatError("CSV must be UTF-8 encoded") from error
    content = content.lstrip("\ufeff")

    reader = csv.DictReader(io.StringIO(content, newline=""))
    if not reader.fieldnames:
        raise CSVFormatError("CSV is missing a header row")

    headers: dict[str, str] = {}
    for header in reader.fieldnames:
        if header is not None:
            headers.setdefault(_normalize_header(header.strip()), header)

    if "postingdate" not in headers or "amount" not in headers:
        raise CSVFormatError("CSV must include Posting Date and Amount headers")

    transactions = []
    invalid_rows = []
    seen_ids = set()
    duplicate_count = 0

    try:
        for row_number, row in enumerate(reader, start=2):
            if None in row:
                invalid_rows.append(
                    {"row": row_number, "error": "Row has more fields than the header"}
                )
                continue
            if not any(
                isinstance(value, str) and value.strip() for value in row.values()
            ):
                continue

            try:
                transaction_date = _parse_date(_field_value(row, headers, "postingdate"))
                amount = _parse_amount(_field_value(row, headers, "amount"))
                source_transaction_id = _field_value(
                    row, headers, "transactionid", "sourceid", "fitid"
                ) or None
                source_category = _field_value(
                    row, headers, "category", "transactioncategory"
                ) or None
                category = "Uncategorized"
                if source_category:
                    category = next(
                        (
                            known
                            for known in KNOWN_CATEGORIES
                            if known.casefold() == source_category.casefold()
                        ),
                        "Uncategorized",
                    )

                description = _field_value(
                    row,
                    headers,
                    "description",
                    "transactiondescription",
                    "memo",
                    "details",
                )
                merchant_payee = _field_value(
                    row, headers, "merchant", "payee", "name"
                ) or description or "Unknown"
                posting_status = _field_value(
                    row, headers, "postingstatus", "transactionstatus", "status"
                ) or "settled"

                transaction = ParsedCSVTransaction(
                    transaction_date=transaction_date,
                    merchant_payee=merchant_payee,
                    amount=amount,
                    transaction_type="debit" if amount < 0 else "credit",
                    description=description,
                    category=category,
                    source_category=source_category,
                    source_transaction_id=source_transaction_id,
                    posting_status=posting_status,
                )
            except ValueError as error:
                invalid_rows.append({"row": row_number, "error": str(error)})
                continue

            if source_transaction_id:
                if source_transaction_id in seen_ids:
                    duplicate_count += 1
                    continue
                seen_ids.add(source_transaction_id)
            transactions.append(transaction)
    except csv.Error as error:
        raise CSVFormatError(f"Malformed CSV: {error}") from error

    return CSVParseResult(
        transactions=transactions,
        duplicate_count=duplicate_count,
        invalid_rows=invalid_rows,
    )


def is_pending_status(status: Optional[str]) -> bool:
    normalized = (
        (status or "settled")
        .strip()
        .casefold()
        .replace("_", " ")
        .replace("-", " ")
    )
    return normalized in PENDING_STATUSES or normalized.startswith("pending ")

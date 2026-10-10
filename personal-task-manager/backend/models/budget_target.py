import re

from beanie import Document
from pydantic import BaseModel, Field, field_validator


def is_valid_month(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])", value)) and int(
        value[:4]
    ) > 0


class BudgetTargetAmount(BaseModel):
    category: str = Field(min_length=1)
    amount: float = Field(ge=0, allow_inf_nan=False)

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Category cannot be blank")
        return value


class BudgetTargetRequest(BaseModel):
    month: str
    targets: list[BudgetTargetAmount]

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: str) -> str:
        if not is_valid_month(value):
            raise ValueError("Invalid month format. Use YYYY-MM")
        return value


class BudgetTarget(Document):
    username: str
    month: str
    targets: list[BudgetTargetAmount]

    class Settings:
        name = "budget_targets"

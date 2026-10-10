from beanie import Document
from pydantic import BaseModel, Field, field_validator


class MerchantCategoryRuleRequest(BaseModel):
    merchant_match: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1)

    @field_validator("merchant_match", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class MerchantCategoryRule(Document):
    username: str
    merchant_match: str
    category: str

    class Settings:
        name = "merchant_category_rules"

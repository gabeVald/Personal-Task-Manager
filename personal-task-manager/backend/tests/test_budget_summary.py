import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from routers import ofx_router


class BudgetSummaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_daily_category_totals_include_only_settled_debits(self):
        transactions = [
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 5),
                transaction_type="debit",
                amount=-9.25,
                category="Food, Dining & Entertainment",
                posting_status="settled",
            ),
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 5),
                transaction_type="debit",
                amount=-3.25,
                category="Food, Dining & Entertainment",
                posting_status="settled",
            ),
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 5),
                transaction_type="debit",
                amount=-4.00,
                category="Shopping",
                posting_status="settled",
            ),
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 5),
                transaction_type="credit",
                amount=40.00,
                category="Food, Dining & Entertainment",
                posting_status="settled",
            ),
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 5),
                transaction_type="debit",
                amount=-50.00,
                category="Food, Dining & Entertainment",
                posting_status="pending",
            ),
            SimpleNamespace(
                transaction_date=datetime(2025, 1, 6),
                transaction_type="debit",
                amount=-8.00,
                category="Uncategorized",
                posting_status="settled",
            ),
        ]
        query = SimpleNamespace(to_list=AsyncMock(return_value=transactions))
        log_insert = AsyncMock()

        class LogStub:
            insert_one = log_insert

            def __init__(self, **_):
                pass

        with (
            patch.object(ofx_router.Transaction, "find", return_value=query),
            patch.object(ofx_router, "Log", LogStub),
        ):
            summary = await ofx_router.get_spending_summary(
                SimpleNamespace(username="alice"), month="2025-01"
            )

        self.assertEqual(
            summary["daily_totals_by_category"],
            {
                "2025-01-05": {
                    "Food, Dining & Entertainment": {"amount": 12.5, "count": 2},
                    "Shopping": {"amount": 4.0, "count": 1},
                },
                "2025-01-06": {"Uncategorized": {"amount": 8.0, "count": 1}},
            },
        )
        self.assertEqual(summary["total_spent"], 24.5)
        self.assertEqual(summary["pending_count"], 1)


if __name__ == "__main__":
    unittest.main()

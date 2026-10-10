import unittest
from types import SimpleNamespace

from merchant_category_rules import category_for_merchant


class MerchantCategoryRuleTests(unittest.TestCase):
    def test_matching_is_case_insensitive_and_overrides_imported_category(self):
        rules = [
            SimpleNamespace(
                merchant_match="amark", category="Food, Dining & Entertainment"
            )
        ]

        category = category_for_merchant("AMARK #42", rules, "Shopping")

        self.assertEqual(category, "Food, Dining & Entertainment")

    def test_most_specific_matching_rule_wins(self):
        rules = [
            SimpleNamespace(merchant_match="market", category="Shopping"),
            SimpleNamespace(
                merchant_match="green market", category="Food, Dining & Entertainment"
            ),
        ]

        category = category_for_merchant(
            "Green Market Downtown", rules, "Uncategorized"
        )

        self.assertEqual(category, "Food, Dining & Entertainment")

    def test_unmatched_merchant_keeps_imported_category(self):
        rules = [SimpleNamespace(merchant_match="amark", category="Shopping")]

        category = category_for_merchant("Corner Cafe", rules, "Food, Dining & Entertainment")

        self.assertEqual(category, "Food, Dining & Entertainment")


if __name__ == "__main__":
    unittest.main()

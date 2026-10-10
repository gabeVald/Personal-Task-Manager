import unittest

from csv_transaction_parser import CSVFormatError, parse_csv_transactions


class CSVTransactionParserTests(unittest.TestCase):
    def test_utf8_bom_and_quoted_fields(self):
        content = (
            'Posting Date,Amount,Transaction ID,Description,Category,Status\n'
            '01/15/2025,-12.50,txn-1,"Cafe, ""The Corner""",Shopping,Posted\n'
        ).encode("utf-8-sig")

        result = parse_csv_transactions(content)

        self.assertEqual(len(result.transactions), 1)
        transaction = result.transactions[0]
        self.assertEqual(transaction.merchant_payee, 'Cafe, "The Corner"')
        self.assertEqual(transaction.transaction_date.isoformat(), "2025-01-15T00:00:00")
        self.assertEqual(transaction.amount, -12.5)
        self.assertEqual(transaction.transaction_type, "debit")
        self.assertEqual(transaction.posting_status, "Posted")

    def test_required_headers_are_enforced(self):
        with self.assertRaisesRegex(CSVFormatError, "Posting Date and Amount"):
            parse_csv_transactions("Date,Description\n2025-01-01,Example\n")

    def test_invalid_date_and_amount_rows_are_reported(self):
        result = parse_csv_transactions(
            "Posting Date,Amount\n"
            "not-a-date,12.00\n"
            "2025-01-01,not-money\n"
            "2025-01-02,3.25\n"
        )

        self.assertEqual([row["row"] for row in result.invalid_rows], [2, 3])
        self.assertEqual(len(result.transactions), 1)
        self.assertEqual(result.transactions[0].amount, 3.25)
        self.assertEqual(result.transactions[0].transaction_type, "credit")

    def test_duplicate_source_ids_are_skipped_and_counted(self):
        result = parse_csv_transactions(
            "Posting Date,Amount,Transaction ID\n"
            "2025-01-01,-5.00,repeat-me\n"
            "2025-01-02,-7.00,repeat-me\n"
        )

        self.assertEqual(result.duplicate_count, 1)
        self.assertEqual(len(result.transactions), 1)
        self.assertEqual(result.transactions[0].amount, -5.0)

    def test_unknown_categories_are_preserved_as_source_and_mapped(self):
        result = parse_csv_transactions(
            "Posting Date,Amount,Category\n2025-01-01,-5.00,Unfamiliar Bank Label\n"
        )

        transaction = result.transactions[0]
        self.assertEqual(transaction.source_category, "Unfamiliar Bank Label")
        self.assertEqual(transaction.category, "Uncategorized")

    def test_parenthesized_amount_is_a_debit(self):
        result = parse_csv_transactions(
            'Posting Date,Amount\n2025-01-01,"(1,234.56)"\n'
        )

        self.assertEqual(result.transactions[0].amount, -1234.56)
        self.assertEqual(result.transactions[0].transaction_type, "debit")


if __name__ == "__main__":
    unittest.main()

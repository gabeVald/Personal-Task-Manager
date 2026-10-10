"""Helpers for applying saved merchant category rules during imports."""


def category_for_merchant(merchant: str, rules, fallback: str) -> str:
    """Return the category for the most specific case-insensitive text match."""
    normalized_merchant = (merchant or "").casefold()
    matching_rules = [
        rule
        for rule in rules
        if rule.merchant_match.casefold() in normalized_merchant
    ]
    if not matching_rules:
        return fallback

    matching_rules.sort(
        key=lambda rule: (-len(rule.merchant_match), rule.merchant_match.casefold())
    )
    return matching_rules[0].category

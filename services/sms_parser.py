import re
from dataclasses import dataclass


CATEGORY_KEYWORDS = {
    "Shopping": ["amazon", "flipkart", "myntra", "shopping", "store", "mall"],
    "Food": ["swiggy", "zomato", "restaurant", "cafe", "food", "juice", "lunch", "dinner", "breakfast"],
    "Transport": ["uber", "ola", "metro", "railway", "irctc", "train", "bus", "rapido", "fuel", "petrol"],
    "Subscription": ["netflix", "spotify", "prime video", "hotstar", "youtube premium", "subscription"],
    "Cash Withdrawal": ["atm", "cash withdrawal", "withdrawn from atm"],
}

AMOUNT_PATTERNS = [
    re.compile(r"(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)", re.IGNORECASE),
    re.compile(r"([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr)", re.IGNORECASE),
]

DEBIT_HINTS = ["debited", "spent", "purchase", "paid", "payment", "withdrawn", "dr"]
CREDIT_HINTS = ["credited", "received", "deposit", "refund", "cr"]


@dataclass
class ParsedSMS:
    amount: float | None
    transaction_type: str | None
    merchant: str | None
    category: str
    description: str


def extract_amount(message: str) -> float | None:
    for pattern in AMOUNT_PATTERNS:
        match = pattern.search(message)
        if not match:
            continue
        try:
            return abs(float(match.group(1).replace(",", "")))
        except ValueError:
            return None
    return None


def detect_transaction_type(message: str) -> str | None:
    lowered = message.lower()
    if any(token in lowered for token in DEBIT_HINTS):
        return "expense"
    if any(token in lowered for token in CREDIT_HINTS):
        return "income"
    return None


def _clean_merchant(value: str) -> str:
    cleaned = re.split(r"\b(?:on|via|using|from|avl|bal|info|ref|utr)\b", value, maxsplit=1, flags=re.IGNORECASE)[0]
    cleaned = re.sub(r"[^A-Za-z0-9&./\- ]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    return cleaned[:80].strip()


def extract_merchant(message: str, sender: str = "") -> str | None:
    patterns = [
        r"(?:at|to|for|towards|via)\s+([A-Za-z0-9&./\- ]{2,80})",
        r"(?:merchant|payee)[:\- ]+([A-Za-z0-9&./\- ]{2,80})",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if not match:
            continue
        merchant = _clean_merchant(match.group(1))
        if merchant:
            return merchant.title()
    sender_name = _clean_merchant(sender)
    return sender_name.title() if sender_name else None


def detect_category(message: str, merchant: str | None) -> str:
    combined = f"{message} {merchant or ''}".lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in combined for keyword in keywords):
            return category
    return "Uncategorized"


def parse_sms_message(message: str, sender: str = "") -> ParsedSMS:
    raw_message = (message or "").strip()
    raw_sender = (sender or "").strip()
    amount = extract_amount(raw_message)
    transaction_type = detect_transaction_type(raw_message)
    merchant = extract_merchant(raw_message, raw_sender)
    category = detect_category(raw_message, merchant)

    if merchant:
        description = merchant
    else:
        description = raw_message
        category = "Uncategorized"

    return ParsedSMS(
        amount=round(amount, 2) if amount is not None else None,
        transaction_type=transaction_type,
        merchant=merchant,
        category=category,
        description=description,
    )

from __future__ import annotations

import calendar
import json
import os
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LEGACY_LEDGER_FILE = DATA_DIR / "ledger.json"
USERS_FILE = DATA_DIR / "users.json"

DEFAULT_ACCOUNT_NAME = "Unassigned"
APP_NAME = "DailyMoney"
SESSION_SECRET = os.environ.get("DAILYMONEY_SECRET_KEY", "daily-money-dev-secret")

DEFAULT_FINANCE = {
    "settings": {
        "currency": "INR",
        "monthly_budget": 0.0,
        "monthly_income_target": 0.0,
    },
    "accounts": [],
    "entries": [],
}

DEFAULT_PROFILE = {
    "title": "DailyMoney Member",
    "location": "India",
    "bio": "Tracking income, expenses, and savings with clarity every day.",
    "avatar_seed": "daily-money",
}

DEFAULT_PREFERENCES = {
    "sidebar_state": "open",
    "notifications": {
        "weekly_digest": True,
        "budget_alerts": True,
        "unusual_activity": False,
    },
}

DEFAULT_USERS_PAYLOAD = {"users": []}

CATEGORY_CONFIG = [
    ("Food", "restaurant"),
    ("Travel", "flight"),
    ("Savings", "savings"),
    ("Shopping", "shopping_bag"),
    ("Health", "fitness_center"),
    ("Bills", "receipt_long"),
    ("Income", "payments"),
    ("Other", "grid_view"),
]

CATEGORY_STYLES = {
    "Food": {"color": "#f59e0b", "soft": "rgba(245, 158, 11, 0.18)"},
    "Travel": {"color": "#38bdf8", "soft": "rgba(56, 189, 248, 0.18)"},
    "Savings": {"color": "#39ff14", "soft": "rgba(57, 255, 20, 0.18)"},
    "Shopping": {"color": "#fb7185", "soft": "rgba(251, 113, 133, 0.18)"},
    "Health": {"color": "#22c55e", "soft": "rgba(34, 197, 94, 0.18)"},
    "Bills": {"color": "#a78bfa", "soft": "rgba(167, 139, 250, 0.18)"},
    "Income": {"color": "#14b8a6", "soft": "rgba(20, 184, 166, 0.18)"},
    "Other": {"color": "#94a3b8", "soft": "rgba(148, 163, 184, 0.18)"},
}

TYPE_OPTIONS = ["expense", "income", "saving"]

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = SESSION_SECRET


@dataclass
class Entry:
    id: int
    date: str
    type: str
    category: str
    description: str
    account: str
    amount: float

    @property
    def signed_amount(self) -> float:
        return self.amount if self.type == "income" else -self.amount

    @property
    def display_amount(self) -> str:
        prefix = "+" if self.type == "income" else "-"
        return f"{prefix}{money(self.amount)}"


def ensure_data_files() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not LEGACY_LEDGER_FILE.exists():
        LEGACY_LEDGER_FILE.write_text(json.dumps(DEFAULT_FINANCE, indent=2), encoding="utf-8")
    if not USERS_FILE.exists():
        USERS_FILE.write_text(json.dumps(DEFAULT_USERS_PAYLOAD, indent=2), encoding="utf-8")


def read_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    ensure_data_files()
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, FileNotFoundError):
        return deepcopy(default)


def write_json(path: Path, data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_users_payload() -> dict[str, Any]:
    payload = read_json(USERS_FILE, DEFAULT_USERS_PAYLOAD)
    payload.setdefault("users", [])
    return payload


def save_users_payload(payload: dict[str, Any]) -> None:
    write_json(USERS_FILE, payload)


def load_legacy_finance() -> dict[str, Any]:
    ledger = read_json(LEGACY_LEDGER_FILE, DEFAULT_FINANCE)
    ledger.setdefault("settings", deepcopy(DEFAULT_FINANCE["settings"]))
    ledger.setdefault("accounts", [])
    ledger.setdefault("entries", [])
    return ledger


def blank_finance() -> dict[str, Any]:
    return deepcopy(DEFAULT_FINANCE)


def profile_defaults(name: str) -> dict[str, Any]:
    defaults = deepcopy(DEFAULT_PROFILE)
    defaults["avatar_seed"] = name.lower().replace(" ", "-") or "daily-money"
    return defaults


def finance_from_user(user: dict[str, Any]) -> dict[str, Any]:
    finance = user.setdefault("finance", blank_finance())
    finance.setdefault("settings", deepcopy(DEFAULT_FINANCE["settings"]))
    finance.setdefault("accounts", [])
    finance.setdefault("entries", [])
    return finance


def month_key(value: str) -> str:
    return value[:7]


def year_key(value: str) -> str:
    return value[:4]


def format_indian_number(value: float) -> str:
    sign = "-" if value < 0 else ""
    absolute_value = abs(value)
    integer_part, decimal_part = f"{absolute_value:.2f}".split(".")
    if len(integer_part) <= 3:
        formatted_integer = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        chunks: list[str] = []
        while len(remaining) > 2:
            chunks.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            chunks.insert(0, remaining)
        formatted_integer = ",".join(chunks + [last_three])
    return f"{sign}{formatted_integer}.{decimal_part}"


def money(value: float) -> str:
    return f"₹{format_indian_number(value)}"


def sanitize_entry_date(raw_value: str | None) -> str:
    today_value = date.today()
    if not raw_value:
        return today_value.isoformat()
    try:
        parsed = datetime.strptime(raw_value, "%Y-%m-%d").date()
    except ValueError:
        return today_value.isoformat()
    return min(parsed, today_value).isoformat()


def shift_month(base_date: date, offset: int) -> date:
    year = base_date.year + ((base_date.month - 1 + offset) // 12)
    month = ((base_date.month - 1 + offset) % 12) + 1
    return date(year, month, 1)


def parse_entries(finance: dict[str, Any]) -> list[Entry]:
    parsed = [Entry(**entry) for entry in finance.get("entries", [])]
    return sorted(parsed, key=lambda item: (item.date, item.id), reverse=True)


def serialize_entry(entry: Entry) -> dict[str, Any]:
    return {
        "id": entry.id,
        "date": entry.date,
        "type": entry.type,
        "category": entry.category,
        "description": entry.description,
        "account": entry.account,
        "amount": entry.amount,
        "displayAmount": entry.display_amount,
        "signedAmount": round(entry.signed_amount, 2),
    }


def aggregate_by_period(entries: list[Entry], period: str) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for entry in entries:
        key = month_key(entry.date) if period == "month" else year_key(entry.date)
        if entry.type == "income":
            grouped[key]["income"] += entry.amount
        else:
            grouped[key]["expense"] += entry.amount

    results = []
    for key in sorted(grouped.keys()):
        income = grouped[key]["income"]
        expense = grouped[key]["expense"]
        results.append({"label": key, "income": income, "expense": expense, "net": income - expense})
    return results[-12:]


def build_daily_series(entries: list[Entry], days: int) -> list[dict[str, Any]]:
    end_day = date.today()
    start_day = end_day - timedelta(days=days - 1)
    totals: dict[str, float] = defaultdict(float)

    for entry in entries:
        entry_day = datetime.strptime(entry.date, "%Y-%m-%d").date()
        if start_day <= entry_day <= end_day:
            totals[entry.date] += entry.signed_amount

    series = []
    current = start_day
    while current <= end_day:
        iso_day = current.isoformat()
        series.append(
            {
                "date": iso_day,
                "label": current.strftime("%a"),
                "short_label": current.strftime("%d %b"),
                "amount": round(totals.get(iso_day, 0.0), 2),
            }
        )
        current += timedelta(days=1)
    return series


def build_daily_income_expense_series(entries: list[Entry], days: int) -> list[dict[str, Any]]:
    end_day = date.today()
    start_day = end_day - timedelta(days=days - 1)
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for entry in entries:
        entry_day = datetime.strptime(entry.date, "%Y-%m-%d").date()
        if not (start_day <= entry_day <= end_day):
            continue
        if entry.type == "income":
            grouped[entry.date]["income"] += entry.amount
        else:
            grouped[entry.date]["expense"] += entry.amount

    series = []
    current = start_day
    while current <= end_day:
        iso_day = current.isoformat()
        income = grouped[iso_day]["income"]
        expense = grouped[iso_day]["expense"]
        series.append(
            {
                "label": current.strftime("%d %b"),
                "income": round(income, 2),
                "expense": round(expense, 2),
                "net": round(income - expense, 2),
            }
        )
        current += timedelta(days=1)
    return series


def slice_period_series(series: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    return series[-limit:]


def generate_ai_tips(
    *,
    monthly_categories: list[tuple[str, float]],
    month_income: float,
    month_expenses: float,
    monthly_budget: float,
    savings_rate: float,
) -> list[str]:
    tips: list[str] = []

    if monthly_categories:
        top_category, top_amount = monthly_categories[0]
        share = (top_amount / month_expenses * 100) if month_expenses else 0
        if share >= 35:
            tips.append(
                f"{top_category} is your biggest spend this month at {share:.0f}% of expenses. Review that category first if you want a fast saving win."
            )
        elif top_category.lower() in {"health", "food"}:
            tips.append(
                f"{top_category} is one of your bigger categories. Keep it efficient, but avoid cutting it too hard because it supports daily quality of life."
            )

    if monthly_budget and month_expenses > monthly_budget:
        tips.append("You are above your monthly budget. A short freeze on shopping and travel would help you stabilize quickly.")
    elif monthly_budget and month_expenses > monthly_budget * 0.8:
        tips.append("You have already used most of this month's budget. Keep new expenses focused on essentials.")
    else:
        tips.append("Your spending is still inside budget. This is a good time to move a small amount into savings before more expenses appear.")

    if month_income and savings_rate < 20:
        tips.append("Your savings rate is below 20%. Try routing fixed money into savings as soon as income arrives.")
    elif month_income and savings_rate > 35:
        tips.append("Your savings rate is strong. You may be able to spend a bit more on health, learning, or lifestyle without hurting stability.")

    return tips[:3]


def calculate_metrics(finance: dict[str, Any]) -> dict[str, Any]:
    entries = parse_entries(finance)
    accounts = finance.get("accounts", [])
    finance_settings = finance.get("settings", {})
    monthly_budget = float(finance_settings.get("monthly_budget", 0))
    monthly_income_target = float(finance_settings.get("monthly_income_target", 0))
    total_balance = sum(float(account["balance"]) for account in accounts)

    today_iso = date.today().isoformat()
    current_month_key = date.today().strftime("%Y-%m")
    current_year_key = date.today().strftime("%Y")
    today_entries = [entry for entry in entries if entry.date == today_iso]
    month_entries = [entry for entry in entries if month_key(entry.date) == current_month_key]
    year_entries = [entry for entry in entries if year_key(entry.date) == current_year_key]

    today_income = sum(entry.amount for entry in today_entries if entry.type == "income")
    today_expenses = sum(entry.amount for entry in today_entries if entry.type != "income")
    month_income = sum(entry.amount for entry in month_entries if entry.type == "income")
    month_expenses = sum(entry.amount for entry in month_entries if entry.type != "income")
    year_income = sum(entry.amount for entry in year_entries if entry.type == "income")
    year_expenses = sum(entry.amount for entry in year_entries if entry.type != "income")
    month_savings = month_income - month_expenses
    savings_rate = (month_savings / month_income * 100) if month_income else 0
    budget_used = (month_expenses / monthly_budget * 100) if monthly_budget else 0

    category_totals: dict[str, float] = defaultdict(float)
    category_counts: dict[str, int] = defaultdict(int)
    for entry in month_entries:
        if entry.type != "income":
            category_totals[entry.category] += entry.amount
            category_counts[entry.category] += 1

    monthly_categories = sorted(category_totals.items(), key=lambda item: item[1], reverse=True)

    cash_flow_7 = build_daily_series(entries, 7)
    cash_flow_30 = build_daily_series(entries, 30)
    cash_flow_90 = build_daily_series(entries, 90)
    daily_insight_series = build_daily_income_expense_series(entries, 30)
    monthly_breakdown = aggregate_by_period(entries, "month")

    ai_tips = (
        generate_ai_tips(
            monthly_categories=monthly_categories,
            month_income=month_income,
            month_expenses=month_expenses,
            monthly_budget=monthly_budget,
            savings_rate=savings_rate,
        )
        if entries
        else []
    )

    return {
        "accounts": accounts,
        "entries": entries,
        "recent_entries": entries[:6],
        "total_balance": round(total_balance, 2),
        "today_income": round(today_income, 2),
        "today_expenses": round(today_expenses, 2),
        "today_net": round(today_income - today_expenses, 2),
        "month_income": round(month_income, 2),
        "month_expenses": round(month_expenses, 2),
        "month_savings": round(month_savings, 2),
        "year_income": round(year_income, 2),
        "year_expenses": round(year_expenses, 2),
        "savings_rate": round(savings_rate, 2),
        "budget_used": round(min(budget_used, 100), 2),
        "budget_remaining": round(max(monthly_budget - month_expenses, 0), 2),
        "monthly_budget": round(monthly_budget, 2),
        "monthly_income_target": round(monthly_income_target, 2),
        "monthly_categories": monthly_categories,
        "category_counts": dict(category_counts),
        "cash_flow_ranges": {"7": cash_flow_7, "30": cash_flow_30, "90": cash_flow_90},
        "insight_chart_modes": {"daily": daily_insight_series, "monthly": monthly_breakdown},
        "year_breakdown_ranges": {
            "6": slice_period_series(monthly_breakdown, 6),
            "12": slice_period_series(monthly_breakdown, 12),
        },
        "ai_tips": ai_tips,
        "current_date_label": date.today().strftime("%B %d, %Y"),
        "current_month_label": date.today().strftime("%B %Y"),
        "current_year_label": date.today().strftime("%Y"),
        "today_iso": today_iso,
    }


def serialize_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return {
        **metrics,
        "entries": [serialize_entry(entry) for entry in metrics["entries"]],
        "recent_entries": [serialize_entry(entry) for entry in metrics["recent_entries"]],
        "monthly_categories": [
            {
                "name": category,
                "amount": round(amount, 2),
                "count": metrics["category_counts"].get(category, 0),
                "style": CATEGORY_STYLES.get(category, CATEGORY_STYLES["Other"]),
            }
            for category, amount in metrics["monthly_categories"]
        ],
    }


def build_month_calendar(selected_iso: str, entries: list[Entry]) -> dict[str, Any]:
    selected_day = datetime.strptime(selected_iso, "%Y-%m-%d").date()
    month_start = selected_day.replace(day=1)
    today_value = date.today()
    month_calendar = calendar.Calendar(firstweekday=0)
    entry_dates = {entry.date for entry in entries}
    weeks: list[list[dict[str, Any]]] = []

    for week in month_calendar.monthdatescalendar(month_start.year, month_start.month):
        week_cells = []
        for day_value in week:
            iso_day = day_value.isoformat()
            in_current_month = day_value.month == month_start.month
            is_future = day_value > today_value
            week_cells.append(
                {
                    "iso": iso_day,
                    "day": day_value.day,
                    "inMonth": in_current_month,
                    "isSelected": iso_day == selected_iso,
                    "hasEntries": iso_day in entry_dates,
                    "isFuture": is_future,
                    "isClickable": in_current_month and not is_future,
                }
            )
        weeks.append(week_cells)

    prev_month = shift_month(month_start, -1)
    next_month = shift_month(month_start, 1)

    return {
        "label": month_start.strftime("%B %Y"),
        "weeks": weeks,
        "prevMonthIso": prev_month.isoformat(),
        "nextMonthIso": next_month.isoformat() if next_month <= today_value.replace(day=1) else None,
    }


def build_day_editor_payload(metrics: dict[str, Any], edit_date: str) -> dict[str, Any]:
    selected_entries = [entry for entry in metrics["entries"] if entry.date == edit_date]
    total_income = sum(entry.amount for entry in selected_entries if entry.type == "income")
    total_expenses = sum(entry.amount for entry in selected_entries if entry.type != "income")
    return {
        "editDate": edit_date,
        "calendar": build_month_calendar(edit_date, metrics["entries"]),
        "selectedEntries": [serialize_entry(entry) for entry in selected_entries],
        "summary": {
            "income": round(total_income, 2),
            "expenses": round(total_expenses, 2),
            "net": round(total_income - total_expenses, 2),
        },
    }


def rebuild_accounts_from_entries(finance: dict[str, Any]) -> None:
    balances: dict[str, float] = defaultdict(float)
    for entry in finance.get("entries", []):
        account_name = entry.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
        amount = float(entry.get("amount", 0))
        if entry.get("type") == "income":
            balances[account_name] += amount
        else:
            balances[account_name] -= amount

    finance["accounts"] = [
        {"name": name, "balance": round(balance, 2)}
        for name, balance in sorted(balances.items())
    ]


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    finance = finance_from_user(user)
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "profile": user.get("profile", {}),
        "preferences": user.get("preferences", deepcopy(DEFAULT_PREFERENCES)),
        "settings": finance.get("settings", {}),
    }


def next_user_id(users: list[dict[str, Any]]) -> int:
    return max((user.get("id", 0) for user in users), default=0) + 1


def normalize_email(raw_email: str) -> str:
    return raw_email.strip().lower()


def current_user_id() -> int | None:
    raw_id = session.get("user_id")
    if isinstance(raw_id, int):
        return raw_id
    return None


def current_user_record(payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    payload = payload or load_users_payload()
    user_id = current_user_id()
    if user_id is None:
        return None
    for user in payload.get("users", []):
        if user.get("id") == user_id:
            return user
    return None


def require_user(payload: dict[str, Any] | None = None) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    payload = payload or load_users_payload()
    user = current_user_record(payload)
    if not user:
        return None, payload
    return user, payload


def build_app_state(user: dict[str, Any], edit_date: str | None = None) -> dict[str, Any]:
    finance = finance_from_user(user)
    metrics = calculate_metrics(finance)
    safe_date = sanitize_entry_date(edit_date)
    return {
        "appName": APP_NAME,
        "user": public_user(user),
        "metrics": serialize_metrics(metrics),
        "categories": [
            {
                "name": category,
                "icon": icon,
                "style": CATEGORY_STYLES.get(category, CATEGORY_STYLES["Other"]),
            }
            for category, icon in CATEGORY_CONFIG
        ],
        "typeOptions": TYPE_OPTIONS,
        "dayEditor": build_day_editor_payload(metrics, safe_date),
    }


def create_user(name: str, email: str, password: str, users_payload: dict[str, Any]) -> dict[str, Any]:
    users = users_payload.setdefault("users", [])
    is_first_user = not users
    finance_seed = load_legacy_finance() if is_first_user else blank_finance()
    user = {
        "id": next_user_id(users),
        "name": name.strip(),
        "email": normalize_email(email),
        "password_hash": generate_password_hash(password),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "profile": profile_defaults(name),
        "preferences": deepcopy(DEFAULT_PREFERENCES),
        "finance": finance_seed,
    }
    users.append(user)
    return user


def json_error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def parse_json_body() -> dict[str, Any]:
    return request.get_json(silent=True) or {}


@app.context_processor
def shell_context() -> dict[str, Any]:
    return {"app_name": APP_NAME}


@app.get("/api/auth/session")
def api_auth_session():
    user = current_user_record()
    return jsonify({"ok": True, "authenticated": bool(user), "user": public_user(user) if user else None})


@app.post("/api/auth/register")
def api_register():
    payload = load_users_payload()
    body = parse_json_body()
    name = body.get("name", "").strip()
    email = normalize_email(body.get("email", ""))
    password = body.get("password", "")

    if len(name) < 2:
        return json_error("Please enter your name.")
    if "@" not in email:
        return json_error("Please enter a valid email address.")
    if len(password) < 6:
        return json_error("Password must be at least 6 characters.")
    if any(user.get("email") == email for user in payload.get("users", [])):
        return json_error("An account with this email already exists.", 409)

    user = create_user(name, email, password, payload)
    save_users_payload(payload)
    session["user_id"] = user["id"]
    return jsonify({"ok": True, "user": public_user(user)})


@app.post("/api/auth/login")
def api_login():
    payload = load_users_payload()
    body = parse_json_body()
    email = normalize_email(body.get("email", ""))
    password = body.get("password", "")

    user = next((item for item in payload.get("users", []) if item.get("email") == email), None)
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        return json_error("Invalid email or password.", 401)

    session["user_id"] = user["id"]
    return jsonify({"ok": True, "user": public_user(user)})


@app.post("/api/auth/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/app-state")
def api_app_state():
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)
    return jsonify({"ok": True, "state": build_app_state(user, request.args.get("edit_date"))})


@app.post("/api/entries")
def api_create_entry():
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    body = parse_json_body()
    amount = abs(float(body.get("amount", 0) or 0))
    if amount <= 0:
        return json_error("Amount must be greater than zero.")

    finance = finance_from_user(user)
    category = body.get("customCategory", "").strip() or body.get("category", "Other").strip() or "Other"
    description = body.get("description", "").strip() or category
    account = body.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
    entry_type = body.get("type", "expense")
    entry_date = sanitize_entry_date(body.get("date"))
    next_id = max((entry.get("id", 0) for entry in finance.get("entries", [])), default=0) + 1
    finance.setdefault("entries", []).append(
        {
            "id": next_id,
            "date": entry_date,
            "type": entry_type,
            "category": category,
            "description": description,
            "account": account,
            "amount": amount,
        }
    )
    rebuild_accounts_from_entries(finance)
    save_users_payload(payload)
    return jsonify({"ok": True, "state": build_app_state(user, entry_date)})


@app.put("/api/entries/<int:entry_id>")
def api_update_entry(entry_id: int):
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    body = parse_json_body()
    finance = finance_from_user(user)
    amount = abs(float(body.get("amount", 0) or 0))
    entry_date = sanitize_entry_date(body.get("date"))

    for entry in finance.get("entries", []):
        if entry.get("id") != entry_id:
            continue
        entry["type"] = body.get("type", entry.get("type", "expense"))
        entry["category"] = body.get("customCategory", "").strip() or body.get("category", entry.get("category", "Other")).strip() or "Other"
        entry["description"] = body.get("description", "").strip() or entry["category"]
        entry["account"] = body.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
        entry["date"] = entry_date
        if amount > 0:
            entry["amount"] = amount
        break
    else:
        return json_error("Entry not found.", 404)

    rebuild_accounts_from_entries(finance)
    save_users_payload(payload)
    return jsonify({"ok": True, "state": build_app_state(user, entry_date)})


@app.delete("/api/entries/<int:entry_id>")
def api_delete_entry(entry_id: int):
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    finance = finance_from_user(user)
    edit_date = sanitize_entry_date(request.args.get("edit_date"))
    original_count = len(finance.get("entries", []))
    finance["entries"] = [entry for entry in finance.get("entries", []) if entry.get("id") != entry_id]
    if len(finance["entries"]) == original_count:
        return json_error("Entry not found.", 404)

    rebuild_accounts_from_entries(finance)
    save_users_payload(payload)
    return jsonify({"ok": True, "state": build_app_state(user, edit_date)})


@app.delete("/api/entries")
def api_clear_entries():
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    finance = finance_from_user(user)
    finance["entries"] = []
    finance["accounts"] = []
    save_users_payload(payload)
    return jsonify({"ok": True, "state": build_app_state(user, date.today().isoformat())})


@app.get("/api/profile")
def api_get_profile():
    user, _payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)
    return jsonify({"ok": True, "profile": user.get("profile", {}), "user": public_user(user)})


@app.patch("/api/profile")
def api_update_profile():
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    body = parse_json_body()
    name = body.get("name", "").strip() or user["name"]
    user["name"] = name
    profile = user.setdefault("profile", profile_defaults(name))
    profile["title"] = body.get("title", profile.get("title", "")).strip()
    profile["location"] = body.get("location", profile.get("location", "")).strip()
    profile["bio"] = body.get("bio", profile.get("bio", "")).strip()
    save_users_payload(payload)
    return jsonify({"ok": True, "user": public_user(user)})


@app.get("/api/settings")
def api_get_settings():
    user, _payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)
    finance = finance_from_user(user)
    return jsonify(
        {
            "ok": True,
            "settings": finance.get("settings", {}),
            "preferences": user.get("preferences", deepcopy(DEFAULT_PREFERENCES)),
        }
    )


@app.patch("/api/settings")
def api_update_settings():
    user, payload = require_user()
    if not user:
        return json_error("Authentication required.", 401)

    body = parse_json_body()
    finance = finance_from_user(user)
    settings = finance.setdefault("settings", deepcopy(DEFAULT_FINANCE["settings"]))
    preferences = user.setdefault("preferences", deepcopy(DEFAULT_PREFERENCES))

    settings["currency"] = body.get("currency", settings.get("currency", "INR")) or "INR"
    settings["monthly_budget"] = abs(float(body.get("monthlyBudget", settings.get("monthly_budget", 0)) or 0))
    settings["monthly_income_target"] = abs(float(body.get("monthlyIncomeTarget", settings.get("monthly_income_target", 0)) or 0))
    preferences["sidebar_state"] = body.get("sidebarState", preferences.get("sidebar_state", "open"))

    notifications = preferences.setdefault("notifications", deepcopy(DEFAULT_PREFERENCES["notifications"]))
    incoming_notifications = body.get("notifications", {})
    if isinstance(incoming_notifications, dict):
        notifications["weekly_digest"] = bool(incoming_notifications.get("weeklyDigest", notifications.get("weekly_digest", True)))
        notifications["budget_alerts"] = bool(incoming_notifications.get("budgetAlerts", notifications.get("budget_alerts", True)))
        notifications["unusual_activity"] = bool(incoming_notifications.get("unusualActivity", notifications.get("unusual_activity", False)))

    save_users_payload(payload)
    return jsonify({"ok": True, "user": public_user(user), "state": build_app_state(user)})


@app.get("/")
@app.get("/dashboard")
@app.get("/daily-entry")
@app.get("/monthly-insights")
@app.get("/yearly-analysis")
@app.get("/day-editor")
@app.get("/profile-overview")
@app.get("/account-settings")
@app.get("/login")
@app.get("/register")
def react_app():
    return render_template("react_app.html")


if __name__ == "__main__":
    ensure_data_files()
    app.run(debug=True)

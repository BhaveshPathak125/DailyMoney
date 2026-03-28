from __future__ import annotations

import json
import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from flask import Flask, redirect, render_template, request, url_for


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "ledger.json"

DEFAULT_DATA = {
    "settings": {
        "currency": "INR",
        "monthly_budget": 0.0,
        "monthly_income_target": 0.0,
    },
    "accounts": [],
    "entries": [],
}

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

app = Flask(__name__)
DEFAULT_ACCOUNT_NAME = "Unassigned"


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


def ensure_data_file() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text(json.dumps(DEFAULT_DATA, indent=2), encoding="utf-8")


def load_data() -> dict[str, Any]:
    ensure_data_file()
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_data(data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def parse_entries(data: dict[str, Any]) -> list[Entry]:
    parsed = [Entry(**entry) for entry in data.get("entries", [])]
    return sorted(parsed, key=lambda item: (item.date, item.id), reverse=True)


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


def month_key(value: str) -> str:
    return value[:7]


def year_key(value: str) -> str:
    return value[:4]


def current_month() -> str:
    return date.today().strftime("%Y-%m")


def current_year() -> str:
    return date.today().strftime("%Y")


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


def build_month_calendar(selected_iso: str, entries: list[Entry]) -> dict[str, Any]:
    selected_day = datetime.strptime(selected_iso, "%Y-%m-%d").date()
    month_start = selected_day.replace(day=1)
    today_value = date.today()
    month_calendar = calendar.Calendar(firstweekday=0)
    entry_dates = {entry.date for entry in entries}
    weeks: list[list[dict[str, Any]]] = []

    for week in month_calendar.monthdatescalendar(month_start.year, month_start.month):
        week_cells = []
        for day in week:
            iso_day = day.isoformat()
            in_current_month = day.month == month_start.month
            is_future = day > today_value
            week_cells.append(
                {
                    "iso": iso_day,
                    "day": day.day,
                    "in_month": in_current_month,
                    "is_selected": iso_day == selected_iso,
                    "has_entries": iso_day in entry_dates,
                    "is_future": is_future,
                    "is_clickable": in_current_month and not is_future,
                }
            )
        weeks.append(week_cells)

    prev_month = shift_month(month_start, -1)
    next_month = shift_month(month_start, 1)

    return {
        "label": month_start.strftime("%B %Y"),
        "weeks": weeks,
        "prev_month_iso": prev_month.isoformat(),
        "next_month_iso": next_month.isoformat() if next_month <= today_value.replace(day=1) else None,
    }


def build_yearly_editor_context(metrics: dict[str, Any], edit_date: str) -> dict[str, Any]:
    selected_entries = [entry for entry in metrics["entries"] if entry.date == edit_date]
    calendar_context = build_month_calendar(edit_date, metrics["entries"])
    return {
        "edit_date": edit_date,
        "selected_entries": selected_entries,
        "calendar_context": calendar_context,
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


def calculate_metrics(data: dict[str, Any]) -> dict[str, Any]:
    entries = parse_entries(data)
    accounts = data.get("accounts", [])
    monthly_budget = float(data.get("settings", {}).get("monthly_budget", 0))
    monthly_income_target = float(data.get("settings", {}).get("monthly_income_target", 0))
    total_balance = sum(float(account["balance"]) for account in accounts)

    today_iso = date.today().isoformat()
    month = current_month()
    year = current_year()
    today_entries = [entry for entry in entries if entry.date == today_iso]
    month_entries = [entry for entry in entries if month_key(entry.date) == month]
    year_entries = [entry for entry in entries if year_key(entry.date) == year]

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
        "total_balance": total_balance,
        "today_income": today_income,
        "today_expenses": today_expenses,
        "today_net": today_income - today_expenses,
        "month_income": month_income,
        "month_expenses": month_expenses,
        "month_savings": month_savings,
        "year_income": year_income,
        "year_expenses": year_expenses,
        "savings_rate": savings_rate,
        "budget_used": min(budget_used, 100),
        "budget_remaining": max(monthly_budget - month_expenses, 0),
        "monthly_budget": monthly_budget,
        "monthly_income_target": monthly_income_target,
        "monthly_categories": monthly_categories[:5],
        "category_counts": category_counts,
        "cash_flow": cash_flow_7,
        "cash_flow_ranges": {
            "7": cash_flow_7,
            "30": cash_flow_30,
            "90": cash_flow_90,
        },
        "month_breakdown": monthly_breakdown,
        "month_breakdown_ranges": {
            "3": slice_period_series(monthly_breakdown, 3),
            "6": slice_period_series(monthly_breakdown, 6),
            "12": slice_period_series(monthly_breakdown, 12),
        },
        "insight_chart_modes": {
            "daily": daily_insight_series,
            "monthly": monthly_breakdown,
        },
        "year_breakdown": monthly_breakdown,
        "year_breakdown_ranges": {
            "6": slice_period_series(monthly_breakdown, 6),
            "12": slice_period_series(monthly_breakdown, 12),
        },
        "ai_tips": ai_tips,
        "current_date_label": date.today().strftime("%B %d, %Y"),
        "current_month_label": date.today().strftime("%B %Y"),
        "current_year_label": date.today().strftime("%Y"),
    }


def update_account_balances(data: dict[str, Any], entry_type: str, account_name: str, amount: float) -> None:
    account_name = account_name or DEFAULT_ACCOUNT_NAME

    for account in data.get("accounts", []):
        if account["name"] != account_name:
            continue
        if entry_type == "income":
            account["balance"] = round(float(account["balance"]) + amount, 2)
        else:
            account["balance"] = round(float(account["balance"]) - amount, 2)
        break
    else:
        opening_balance = amount if entry_type == "income" else -amount
        data.setdefault("accounts", []).append(
            {"name": account_name, "balance": round(opening_balance, 2)}
        )


def rebuild_accounts_from_entries(data: dict[str, Any]) -> None:
    balances: dict[str, float] = defaultdict(float)
    for entry in data.get("entries", []):
        account_name = entry.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
        amount = float(entry.get("amount", 0))
        if entry.get("type") == "income":
            balances[account_name] += amount
        else:
            balances[account_name] -= amount

    data["accounts"] = [
        {"name": name, "balance": round(balance, 2)}
        for name, balance in sorted(balances.items())
    ]


@app.context_processor
def template_helpers() -> dict[str, Any]:
    return {
        "money": money,
        "today_iso": date.today().isoformat(),
        "category_styles": CATEGORY_STYLES,
        "currency_symbol": "₹",
        "currency_code": "INR",
        "default_account_name": DEFAULT_ACCOUNT_NAME,
    }


@app.route("/")
def index():
    return redirect(url_for("dashboard"))


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", metrics=calculate_metrics(load_data()))


@app.route("/daily-entry", methods=["GET", "POST"])
def daily_entry():
    data = load_data()
    if request.method == "POST":
        form = request.form
        amount = abs(float(form.get("amount", 0) or 0))
        entry_type = form.get("type", "expense")
        custom_category = form.get("custom_category", "").strip()
        category = custom_category or form.get("category", "Other").strip() or "Other"
        description = form.get("description", "").strip() or category
        account = form.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
        entry_date = sanitize_entry_date(form.get("date", date.today().isoformat()))

        if amount > 0:
            next_id = max((entry["id"] for entry in data.get("entries", [])), default=0) + 1
            data.setdefault("entries", []).append(
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
            rebuild_accounts_from_entries(data)
            save_data(data)
        return redirect(url_for("daily_entry"))

    return render_template(
        "daily_entry.html",
        metrics=calculate_metrics(data),
        categories=CATEGORY_CONFIG,
        type_options=TYPE_OPTIONS,
    )


@app.post("/entries/<int:entry_id>/update")
def update_entry(entry_id: int):
    data = load_data()
    form = request.form
    amount = abs(float(form.get("amount", 0) or 0))
    entry_type = form.get("type", "expense")
    custom_category = form.get("custom_category", "").strip()
    category = custom_category or form.get("category", "Other").strip() or "Other"
    description = form.get("description", "").strip() or category
    account = form.get("account", "").strip() or DEFAULT_ACCOUNT_NAME
    entry_date = sanitize_entry_date(form.get("date"))

    for entry in data.get("entries", []):
        if entry.get("id") != entry_id:
            continue
        entry["type"] = entry_type
        entry["category"] = category
        entry["description"] = description
        entry["account"] = account
        entry["date"] = entry_date
        if amount > 0:
            entry["amount"] = amount
        break

    rebuild_accounts_from_entries(data)
    save_data(data)
    target = form.get("redirect_to", "yearly_analysis")
    if target == "day_editor":
        return redirect(url_for("day_editor", edit_date=entry_date))
    return redirect(url_for("yearly_analysis", edit_date=entry_date))


@app.post("/entries/<int:entry_id>/delete")
def delete_entry(entry_id: int):
    data = load_data()
    redirect_date = sanitize_entry_date(request.form.get("redirect_date"))
    data["entries"] = [entry for entry in data.get("entries", []) if entry.get("id") != entry_id]
    rebuild_accounts_from_entries(data)
    save_data(data)
    target = request.form.get("redirect_to", "daily_entry")
    if target == "yearly_analysis":
        return redirect(url_for("yearly_analysis", edit_date=redirect_date))
    return redirect(url_for("daily_entry"))


@app.post("/entries/clear")
def clear_entries():
    data = load_data()
    data["entries"] = []
    data["accounts"] = []
    save_data(data)
    return redirect(url_for("daily_entry"))


@app.route("/monthly-insights")
def monthly_insights():
    return render_template("monthly_insights.html", metrics=calculate_metrics(load_data()))


@app.route("/yearly-analysis")
def yearly_analysis():
    data = load_data()
    metrics = calculate_metrics(data)
    edit_date = sanitize_entry_date(request.args.get("edit_date"))
    editor_context = build_yearly_editor_context(metrics, edit_date)
    return render_template(
        "yearly_analysis.html",
        metrics=metrics,
        categories=CATEGORY_CONFIG,
        type_options=TYPE_OPTIONS,
        **editor_context,
    )


@app.route("/yearly-analysis/editor")
def yearly_analysis_editor():
    data = load_data()
    metrics = calculate_metrics(data)
    edit_date = sanitize_entry_date(request.args.get("edit_date"))
    editor_context = build_yearly_editor_context(metrics, edit_date)
    return render_template(
        "partials/yearly_editor.html",
        metrics=metrics,
        categories=CATEGORY_CONFIG,
        type_options=TYPE_OPTIONS,
        **editor_context,
    )


@app.route("/day-editor")
def day_editor():
    data = load_data()
    metrics = calculate_metrics(data)
    edit_date = sanitize_entry_date(request.args.get("edit_date"))
    editor_context = build_yearly_editor_context(metrics, edit_date)
    return render_template(
        "day_editor.html",
        metrics=metrics,
        categories=CATEGORY_CONFIG,
        type_options=TYPE_OPTIONS,
        editor_endpoint="day_editor_partial",
        redirect_page="day_editor",
        **editor_context,
    )


@app.route("/day-editor/editor")
def day_editor_partial():
    data = load_data()
    metrics = calculate_metrics(data)
    edit_date = sanitize_entry_date(request.args.get("edit_date"))
    editor_context = build_yearly_editor_context(metrics, edit_date)
    return render_template(
        "partials/yearly_editor.html",
        metrics=metrics,
        categories=CATEGORY_CONFIG,
        type_options=TYPE_OPTIONS,
        editor_endpoint="day_editor_partial",
        redirect_page="day_editor",
        **editor_context,
    )


if __name__ == "__main__":
    ensure_data_file()
    app.run(debug=True)

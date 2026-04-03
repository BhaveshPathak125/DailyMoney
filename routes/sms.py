from datetime import datetime
from typing import Any, Callable

from flask import Blueprint, Response, jsonify, request

from schemas.sms import SMSPayloadValidationError, SMSWebhookPayload
from services.sms_parser import parse_sms_message


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _is_duplicate_sms_entry(finance: dict[str, Any], *, amount: float, merchant: str, timestamp: datetime) -> bool:
    merchant_key = merchant.strip().lower()
    for entry in finance.get("entries", []):
        if abs(float(entry.get("amount", 0)) - amount) > 0.009:
            continue
        if entry.get("description", "").strip().lower() != merchant_key:
            continue
        existing_timestamp = _parse_iso_datetime(entry.get("sms_timestamp"))
        if existing_timestamp is None:
            continue
        if abs((existing_timestamp - timestamp).total_seconds()) <= 60:
            return True
    return False


def create_sms_blueprint(
    *,
    load_users_payload: Callable[[], dict[str, Any]],
    save_users_payload: Callable[[dict[str, Any]], None],
    finance_from_user: Callable[[dict[str, Any]], dict[str, Any]],
    rebuild_accounts_from_entries: Callable[[dict[str, Any]], None],
    user_by_email: Callable[[str, dict[str, Any] | None], dict[str, Any] | None],
    json_error: Callable[[str, int], Any],
    sms_ingest_token: str,
) -> Blueprint:
    sms_router = Blueprint("sms_router", __name__)

    def resolve_target_user(payload: dict[str, Any]) -> tuple[dict[str, Any] | None, int | None]:
        users = payload.get("users", [])
        query_email = (request.args.get("user_email") or request.headers.get("X-DailyMoney-User-Email") or "").strip().lower()
        provided_token = (request.args.get("token") or request.headers.get("X-DailyMoney-Token") or "").strip()

        if provided_token and provided_token != sms_ingest_token:
            return None, 403
        if query_email:
            return user_by_email(query_email, payload), None
        if len(users) == 1:
            return users[0], None
        return None, 404

    def process_sms_request() -> tuple[dict[str, Any], int]:
        raw_body = request.get_json(silent=True) or {}
        if not raw_body:
            raw_body = {
                "message": request.form.get("Body") or request.form.get("message", ""),
                "sender": request.form.get("From") or request.form.get("sender", ""),
                "timestamp": request.form.get("timestamp") or datetime.now().isoformat(),
            }
        try:
            sms_payload = SMSWebhookPayload.model_validate(raw_body)
        except SMSPayloadValidationError as exc:
            details = [{"field": ".".join(str(part) for part in item["loc"]), "message": item["msg"]} for item in exc.errors()]
            return {"status": "error", "message": "Invalid SMS payload.", "details": details}, 422

        users_payload = load_users_payload()
        user, resolve_status = resolve_target_user(users_payload)
        if not user:
            if resolve_status == 403:
                return {"status": "error", "message": "Invalid SMS ingest token."}, 403
            return {"status": "error", "message": "Could not resolve the target user for this SMS webhook."}, 404

        parsed = parse_sms_message(sms_payload.message, sms_payload.sender)
        if parsed.amount is None:
            return {"status": "error", "message": "Could not detect transaction amount from SMS."}, 422

        transaction_type = parsed.transaction_type or "expense"
        merchant = parsed.merchant or sms_payload.message
        category = parsed.category or "Uncategorized"
        description = parsed.description or sms_payload.message

        finance = finance_from_user(user)
        if _is_duplicate_sms_entry(
            finance,
            amount=parsed.amount,
            merchant=merchant,
            timestamp=sms_payload.timestamp,
        ):
            return {
                "status": "ignored",
                "reason": "duplicate",
                "amount": parsed.amount,
                "merchant": merchant,
                "category": category,
            }, 200

        next_id = max((entry.get("id", 0) for entry in finance.get("entries", [])), default=0) + 1
        finance.setdefault("entries", []).append(
            {
                "id": next_id,
                "date": sms_payload.timestamp.date().isoformat(),
                "type": transaction_type,
                "category": category,
                "description": description,
                "account": sms_payload.sender.upper(),
                "amount": parsed.amount,
                "source": "sms",
                "sms_timestamp": sms_payload.timestamp.isoformat(),
                "sender": sms_payload.sender,
                "raw_message": sms_payload.message,
            }
        )
        rebuild_accounts_from_entries(finance)
        save_users_payload(users_payload)

        print(f"SMS Expense Added: ₹{parsed.amount:.2f} at {merchant}")

        return {
            "status": "success",
            "amount": parsed.amount,
            "merchant": merchant,
            "category": category,
        }, 200

    @sms_router.post("/sms-webhook")
    def sms_webhook():
        body, status = process_sms_request()
        return jsonify(body), status

    @sms_router.post("/api/integrations/sms/import")
    def sms_webhook_legacy():
        body, status = process_sms_request()
        if status >= 400:
            return jsonify(body), status
        return Response("<Response></Response>", mimetype="text/xml")

    return sms_router

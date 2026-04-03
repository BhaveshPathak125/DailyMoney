from datetime import datetime


try:
    from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

    SMSPayloadValidationError = ValidationError

    class SMSWebhookPayload(BaseModel):
        model_config = ConfigDict(str_strip_whitespace=True)

        message: str
        sender: str
        timestamp: datetime

        @field_validator("message", "sender")
        @classmethod
        def validate_not_blank(cls, value: str) -> str:
            if not value:
                raise ValueError("Field cannot be empty.")
            return value

except ImportError:
    class SMSPayloadValidationError(Exception):
        def __init__(self, details: list[dict[str, str]]):
            super().__init__("Invalid SMS payload.")
            self._details = details

        def errors(self) -> list[dict[str, str]]:
            return self._details

    class SMSWebhookPayload:
        def __init__(self, message: str, sender: str, timestamp: datetime):
            self.message = message
            self.sender = sender
            self.timestamp = timestamp

        @classmethod
        def model_validate(cls, raw_data: dict):
            details: list[dict[str, str]] = []

            message = str(raw_data.get("message", "") or "").strip()
            sender = str(raw_data.get("sender", "") or "").strip()
            raw_timestamp = raw_data.get("timestamp")

            if not message:
                details.append({"loc": ("message",), "msg": "Field cannot be empty."})
            if not sender:
                details.append({"loc": ("sender",), "msg": "Field cannot be empty."})

            parsed_timestamp = None
            if raw_timestamp is None or str(raw_timestamp).strip() == "":
                details.append({"loc": ("timestamp",), "msg": "Field is required."})
            else:
                normalized = str(raw_timestamp).strip().replace("Z", "+00:00")
                try:
                    parsed_timestamp = datetime.fromisoformat(normalized)
                except ValueError:
                    details.append({"loc": ("timestamp",), "msg": "Invalid datetime format."})

            if details:
                raise SMSPayloadValidationError(details)

            return cls(message=message, sender=sender, timestamp=parsed_timestamp)

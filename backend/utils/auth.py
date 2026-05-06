import os
import jwt
from datetime import datetime, timedelta

# Read from .env — MUST be set to a long random string in production.
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    import logging
    logging.getLogger(__name__).warning(
        "[Auth] JWT_SECRET_KEY not set in .env — using a random key. "
        "Tokens will be invalidated on every server restart. "
        "Set JWT_SECRET_KEY in backend/.env for persistent sessions."
    )


def generate_token(data):
    payload = {
        **data,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

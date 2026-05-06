import bcrypt
from utils.db import connect_db
from datetime import datetime


def _users_col():
    db = connect_db()
    return db["users"]


def create_user(username: str, password: str):
    """
    Create a new user. Returns the inserted document id on success,
    or None if the username already exists.
    """
    col = _users_col()
    if col.find_one({"username": username}):
        return None  # duplicate

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    result = col.insert_one({
        "username":      username,
        "password":      hashed,
        "watchlist":     [],          # list of stock symbols
        "search_history": [],         # list of {symbol, name, timestamp}
        "created_at":    datetime.utcnow().isoformat(),
    })
    return str(result.inserted_id)


def authenticate_user(username: str, password: str):
    """
    Verify credentials. Returns the user document on success, else None.
    """
    col  = _users_col()
    user = col.find_one({"username": username})
    if not user:
        return None

    if bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return user
    return None


def get_user(username: str):
    """Return the user document (without password) for profile display."""
    col  = _users_col()
    user = col.find_one({"username": username}, {"password": 0})
    return user


def add_to_watchlist(username: str, symbol: str, name: str = ""):
    """Add a stock to the user's watchlist. Idempotent."""
    col = _users_col()
    # Remove first (to avoid duplicates), then push
    col.update_one(
        {"username": username},
        {"$pull": {"watchlist": {"symbol": symbol}}}
    )
    col.update_one(
        {"username": username},
        {"$push": {"watchlist": {"symbol": symbol, "name": name, "added_at": datetime.utcnow().isoformat()}}}
    )
    return True


def remove_from_watchlist(username: str, symbol: str):
    """Remove a stock from the user's watchlist."""
    col = _users_col()
    col.update_one(
        {"username": username},
        {"$pull": {"watchlist": {"symbol": symbol}}}
    )
    return True


def get_watchlist(username: str):
    """Return the user's watchlist."""
    col  = _users_col()
    user = col.find_one({"username": username}, {"watchlist": 1})
    return user.get("watchlist", []) if user else []


def add_to_search_history(username: str, symbol: str, name: str = ""):
    """
    Record a stock search/view in the user's history.
    Keeps only the 20 most recent unique entries.
    """
    col = _users_col()
    entry = {"symbol": symbol, "name": name, "timestamp": datetime.utcnow().isoformat()}
    # Remove existing entry for same symbol (keep freshest)
    col.update_one(
        {"username": username},
        {"$pull": {"search_history": {"symbol": symbol}}}
    )
    # Push to front and trim to 20
    col.update_one(
        {"username": username},
        {
            "$push": {
                "search_history": {
                    "$each":     [entry],
                    "$position": 0,
                    "$slice":    20,
                }
            }
        }
    )
    return True


def get_search_history(username: str):
    """Return the user's recent search/view history."""
    col  = _users_col()
    user = col.find_one({"username": username}, {"search_history": 1})
    return user.get("search_history", []) if user else []

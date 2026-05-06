"""
user_routes.py
--------------
Flask blueprint for authenticated user operations: profile, watchlist, search history.

All endpoints require a valid JWT in the Authorization header:
  Authorization: Bearer <token>

Endpoints
---------
GET  /user/profile            → {username, watchlist, search_history, created_at}
GET  /user/watchlist          → [{symbol, name, added_at}]
POST /user/watchlist          → body: {symbol, name}  → adds to watchlist
DELETE /user/watchlist/<sym>  → removes from watchlist
GET  /user/history            → [{symbol, name, timestamp}]
POST /user/history            → body: {symbol, name}  → records a view
"""

import logging
from flask import Blueprint, request, jsonify
from utils.auth import verify_token
from models.user_model import (
    get_user, get_watchlist, add_to_watchlist, remove_from_watchlist,
    get_search_history, add_to_search_history,
)

logger   = logging.getLogger(__name__)
user_bp  = Blueprint("user", __name__)


def _get_username_from_request():
    """Extract and verify the JWT, returning the username or None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    payload = verify_token(token)
    if not payload:
        return None
    return payload.get("username")


def _require_auth():
    """Returns (username, None) on success or (None, error_response) on failure."""
    username = _get_username_from_request()
    if not username:
        return None, (jsonify({"error": "Unauthorized — valid JWT required."}), 401)
    return username, None


# ── Profile ──────────────────────────────────────────────────────────────────
@user_bp.route("/profile", methods=["GET"])
def profile():
    username, err = _require_auth()
    if err: return err

    user = get_user(username)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "username":       user.get("username"),
        "created_at":     user.get("created_at"),
        "watchlist":      user.get("watchlist", []),
        "search_history": user.get("search_history", []),
    }), 200


# ── Watchlist ─────────────────────────────────────────────────────────────────
@user_bp.route("/watchlist", methods=["GET"])
def watchlist_get():
    username, err = _require_auth()
    if err: return err
    return jsonify(get_watchlist(username)), 200


@user_bp.route("/watchlist", methods=["POST"])
def watchlist_add():
    username, err = _require_auth()
    if err: return err

    data   = request.get_json(silent=True) or {}
    symbol = (data.get("symbol") or "").strip().upper()
    name   = (data.get("name")   or "").strip()

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    add_to_watchlist(username, symbol, name)
    return jsonify({"message": f"{symbol} added to watchlist"}), 200


@user_bp.route("/watchlist/<symbol>", methods=["DELETE"])
def watchlist_remove(symbol):
    username, err = _require_auth()
    if err: return err

    remove_from_watchlist(username, symbol.upper())
    return jsonify({"message": f"{symbol} removed from watchlist"}), 200


# ── Search / View History ─────────────────────────────────────────────────────
@user_bp.route("/history", methods=["GET"])
def history_get():
    username, err = _require_auth()
    if err: return err
    return jsonify(get_search_history(username)), 200


@user_bp.route("/history", methods=["POST"])
def history_add():
    username, err = _require_auth()
    if err: return err

    data   = request.get_json(silent=True) or {}
    symbol = (data.get("symbol") or "").strip().upper()
    name   = (data.get("name")   or "").strip()

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    add_to_search_history(username, symbol, name)
    return jsonify({"message": "history updated"}), 200

"""
chatbot_routes.py
-----------------
Flask blueprint exposing the RAG chatbot API under /api/chatbot.

Endpoints
---------
POST /api/chatbot/chat
    Body:    {"query": "why is the signal Hold?", "context_symbol": "TCS.NS"}
    Success: {"answer": "..."}   HTTP 200
    Error:   {"error":  "..."}   HTTP 400 / 500

GET /api/chatbot/kb-status
    Returns the current RAG index status and list of indexed symbols.
    Success: {"status": "ready|building|error|idle", "symbols_indexed": [...], ...}

GET /api/chatbot/available-stocks
    Returns the list of symbols that have analysis snapshots in kb_data/.
    Success: {"symbols": ["TCS.NS", "RELIANCE.NS", ...]}
"""

import logging
from pathlib import Path
from flask import Blueprint, request, jsonify
from services.rag_service import answer_question, get_kb_info

logger     = logging.getLogger(__name__)
chatbot_bp = Blueprint("chatbot", __name__)

_KB_DATA_DIR = Path(__file__).resolve().parent.parent / "kb_data"


# ── /chat ─────────────────────────────────────────────────────────────────────
@chatbot_bp.route("/chat", methods=["POST"])
def chat():
    """Answer a user question using the auto-generated stock analysis KB."""
    data           = request.get_json(silent=True) or {}
    query          = (data.get("query") or "").strip()
    context_symbol = (data.get("context_symbol") or "").strip()

    if not query:
        return jsonify({"error": "The 'query' field is required and must not be empty."}), 400

    result = answer_question(query, context_symbol if context_symbol else None)

    if "error" in result:
        return jsonify(result), 500

    return jsonify(result), 200


# ── /kb-status ────────────────────────────────────────────────────────────────
@chatbot_bp.route("/kb-status", methods=["GET"])
def kb_status():
    """Return the current RAG index status — poll this after a stock analysis to confirm re-index."""
    return jsonify(get_kb_info()), 200


# ── /available-stocks ─────────────────────────────────────────────────────────
@chatbot_bp.route("/available-stocks", methods=["GET"])
def available_stocks():
    """Return the list of symbols that have KB snapshots and can be queried in depth."""
    try:
        _KB_DATA_DIR.mkdir(parents=True, exist_ok=True)
        symbols = sorted([p.stem for p in _KB_DATA_DIR.glob("*.txt")])
        return jsonify({"symbols": symbols}), 200
    except Exception as exc:
        logger.error(f"[chatbot] available-stocks error: {exc}")
        return jsonify({"symbols": [], "error": str(exc)}), 500

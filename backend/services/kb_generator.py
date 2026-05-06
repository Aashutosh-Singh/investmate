"""
kb_generator.py
---------------
Converts the fully-assembled stock_details dict (output of get_stock_details)
into a structured, human-readable text document stored in backend/kb_data/.

One file per symbol: backend/kb_data/{SYMBOL}.txt

The RAG service indexes all files in that directory so the chatbot can answer
deep follow-up questions about predictions, signals, sentiment, risk, and regime
immediately after a user views a stock analysis page.

Public API
----------
write_stock_analysis_snapshot(symbol, stock_details)   -> None
    Non-blocking. Called by stock_routes in a daemon thread after each analysis.
"""

import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Where snapshots are stored (one .txt per symbol)
_KB_DATA_DIR = Path(__file__).resolve().parent.parent / "kb_data"


def _safe(val, fmt=None, suffix="", fallback="N/A"):
    """Format a value safely, returning fallback if None / NaN."""
    if val is None:
        return fallback
    try:
        float_val = float(val)
        import math
        if math.isnan(float_val) or math.isinf(float_val):
            return fallback
        if fmt:
            return fmt.format(float_val) + suffix
        return str(float_val) + suffix
    except (TypeError, ValueError):
        return str(val) if val else fallback


def _build_document(symbol: str, d: dict) -> str:
    """Render stock_details dict into a rich, queryable plain-text document."""
    now  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    profile  = d.get("profile", {})
    quote    = d.get("current_quote", {})
    pred     = d.get("price_prediction") or {}
    sent     = d.get("sentiment") or {}
    risk     = d.get("risk_analysis") or {}
    signal   = pred.get("trading_signal") or {}

    # Resolve currency symbol from the data (yfinance provides ISO 4217 codes)
    currency_code = (
        profile.get("currency")
        or quote.get("currency")
        or "USD"
    ).upper()
    CURRENCY_SYMBOLS = {
        "INR": "\u20b9",  # ₹
        "USD": "$",
        "GBP": "\u00a3",  # £
        "EUR": "\u20ac",  # €
        "JPY": "\u00a5",  # ¥
        "CNY": "\u00a5",  # ¥
        "HKD": "HK$",
        "SGD": "S$",
        "CAD": "CA$",
        "AUD": "A$",
        "CHF": "CHF ",
    }
    SYM = CURRENCY_SYMBOLS.get(currency_code, currency_code + " ")

    # ── Helper for sentiment label ────────────────────────────────────────
    def _sent_label(score):
        if score is None: return "Unknown"
        try:
            s = float(score)
            return "Bullish" if s >= 60 else "Bearish" if s <= 40 else "Neutral"
        except: return "Unknown"

    # ── Confidence interval ───────────────────────────────────────────────
    ci = pred.get("confidence_interval")
    if ci and len(ci) == 2 and ci[0] is not None and ci[1] is not None:
        ci_str = f"{SYM}{_safe(ci[0], '{:.2f}')} – {SYM}{_safe(ci[1], '{:.2f}')}"
    else:
        ci_str = "N/A"

    # ── Signal explanation ────────────────────────────────────────────────
    signal_label   = signal.get("label", "N/A")
    signal_rat     = signal.get("rationale", "")
    regime_weight  = signal.get("regime_weight")
    regime         = pred.get("regime", "Unknown")
    sentiment_merged = signal.get("sentiment_merged", False)

    regime_explanation = {
        "Trending":  "The market is in a clear directional trend. Signal conviction is highest.",
        "Recovery":  "The stock is recovering from a recent downturn. Signals carry moderate conviction.",
        "Sideways":  "Price is range-bound with no clear direction. Signals are cautious and lower conviction.",
        "Volatile":  "High volatility detected. The model reduces position confidence significantly.",
        "Unknown":   "The market regime could not be determined.",
    }.get(regime, "N/A")

    signal_meaning = {
        "Strong Buy":       "The model has high confidence the price will rise over the next 5 days and the upside is meaningful.",
        "Buy":              "The model expects a moderate upward move over the next 5 days.",
        "Hold":             "The model sees insufficient evidence to commit to a buy or sell. Risk/reward is not compelling in either direction.",
        "Sell":             "The model expects a moderate downward move. Reducing exposure is suggested.",
        "Strong Sell":      "The model has high confidence the price will fall and recommends exiting the position.",
        "Model Unreliable": "Model validation AUC or confidence is too low to generate a reliable signal. Do not trade on this signal.",
    }.get(signal_label, "")

    # ── Price direction ───────────────────────────────────────────────────
    price_direction = pred.get("prediction_direction", "N/A")
    p_up            = _safe(pred.get("direction_probability"), "{:.1f}", "%")
    p_confidence    = _safe(pred.get("prediction_confidence"), "{:.1f}", "%")
    val_auc         = _safe(pred.get("val_auc"), "{:.4f}")
    exp_ret         = _safe(pred.get("expected_return_pct"), "{:.3f}", "%")
    pred_price      = _safe(pred.get("predicted_price"), "{:.2f}")
    last_price      = _safe(pred.get("last_close_price"), "{:.2f}")
    price_change    = _safe(pred.get("price_change"), "{:.2f}")
    price_chg_pct   = _safe(pred.get("price_change_percent"), "{:.2f}", "%")

    # ── Sentiment ─────────────────────────────────────────────────────────
    s_score  = sent.get("overall_prediction")
    s_label  = _sent_label(s_score)
    s_total  = sent.get("articles_analyzed", 0) or 0
    s_bull   = sent.get("bullish_count", 0) or 0
    s_bear   = sent.get("bearish_count", 0) or 0
    s_neut   = sent.get("neutral_count", 0) or 0
    s_yf     = _safe(sent.get("yfinance_score"), "{:.1f}")
    s_news   = _safe(sent.get("newsapi_score"), "{:.1f}")

    # ── Risk ──────────────────────────────────────────────────────────────
    r_level  = risk.get("risk_level", "N/A")
    r_vol    = _safe(risk.get("volatility"), "{:.2f}", "%")
    r_ret    = _safe(risk.get("daily_return"), "{:.4f}", "%")
    r_trend  = risk.get("trend", "N/A")

    lines = [
        f"=== STOCK ANALYSIS REPORT: {symbol} ===",
        f"Generated: {now}",
        f"This document is the full AI-generated analysis for {symbol}.",
        "",
        "--- COMPANY PROFILE ---",
        f"Company Name: {profile.get('name', 'Unknown')}",
        f"Symbol: {symbol}",
        f"Sector: {profile.get('sector', 'Unknown')}",
        f"Industry: {profile.get('industry', 'Unknown')}",
        f"Country: {profile.get('country', 'Unknown')}",
        f"Website: {profile.get('website', 'N/A')}",
        "",
        "--- CURRENT PRICE & MARKET ---",
        f"Current Price: {SYM}{_safe(quote.get('price'), '{:.2f}')}",
        f"Day Change: {_safe(quote.get('change'), '{:+.2f}')} ({_safe(quote.get('change_percent'), '{:+.2f}', '%')})",
        "",
        "--- LSTM AI PRICE PREDICTION (5-Day Horizon) ---",
        f"Predicted Price (next 5 trading days): {SYM}{pred_price}",
        f"Last Close Price: {SYM}{last_price}",
        f"Predicted Price Change: {SYM}{price_change} ({price_chg_pct})",
        f"Predicted Direction: {price_direction}",
        f"Direction Probability: {p_up}",
        f"  → This means the model is {p_up} confident the stock will move {price_direction.lower()}.",
        f"Expected Return (log-return based): {exp_ret}",
        f"Confidence Interval (15th–85th percentile): {ci_str}",
        f"  → The model estimates the price will land between {ci_str} with 70% probability.",
        f"Model Validation AUC: {val_auc}",
        f"  → AUC of 0.50 = random. Above 0.60 is considered meaningful. Below 0.52 = unreliable.",
        f"Overall Prediction Confidence: {p_confidence}",
        "",
        "--- MARKET REGIME ---",
        f"Detected Regime: {regime}",
        f"Regime Explanation: {regime_explanation}",
        f"Regime Weight Applied to Signal: {_safe(regime_weight, '{:.2f}')}",
        f"  → A weight of 1.0 means full conviction. Lower values dampen the signal strength.",
        "",
        "--- TRADING SIGNAL ---",
        f"Signal: {signal_label}",
        f"What '{signal_label}' means: {signal_meaning}",
        f"Signal Rationale: {signal_rat}",
        f"Sentiment Merged into Signal: {'Yes (30% weight)' if sentiment_merged else 'No'}",
        f"  → The final signal blends 70% LSTM model output with 30% news sentiment score.",
        "",
        "--- MARKET SENTIMENT (News & Social Analysis) ---",
        f"Overall Sentiment Score: {_safe(s_score, '{:.1f}')} / 100  →  {s_label}",
        f"  → Score above 60 = Bullish, below 40 = Bearish, 40–60 = Neutral.",
        f"Articles Analyzed: {s_total}",
        f"  Bullish Articles: {s_bull}",
        f"  Neutral Articles: {s_neut}",
        f"  Bearish Articles: {s_bear}",
        f"Yahoo Finance Sentiment Score: {s_yf} / 100",
        f"NewsAPI Sentiment Score: {s_news} / 100",
        "",
        "--- RISK ANALYSIS ---",
        f"Risk Level: {r_level}",
        f"Annualized Volatility: {r_vol}",
        f"  → Higher volatility means larger expected price swings. Above 30% is high risk.",
        f"Average Daily Return: {r_ret}",
        f"Current Trend: {r_trend}",
        "",
        "--- HOW TO INTERPRET THIS ANALYSIS ---",
        "Q: Why is the signal Hold?",
        f"A: The model computed a {price_direction} direction probability of {p_up} in a '{regime}' market (regime weight: {_safe(regime_weight, '{:.2f}')})."
        + (" After blending with the sentiment score, the combined score fell in the Hold zone." if sentiment_merged else ""),
        "",
        "Q: Is the prediction reliable?",
        f"A: The model has a validation AUC of {val_auc}. Values above 0.60 indicate the model has learned"
        " a meaningful pattern. The confidence interval gives the range of realistic outcomes.",
        "",
        "Q: What does the sentiment mean?",
        f"A: Of {s_total} articles analyzed, {s_bull} were bullish, {s_neut} neutral, and {s_bear} bearish,"
        f" giving an overall score of {_safe(s_score, '{:.1f}')} / 100 ({s_label}).",
        "",
        "Q: What is the market regime?",
        f"A: The detected regime is '{regime}'. {regime_explanation}"
        f" This regime reduces the signal weight by a factor of {_safe(regime_weight, '{:.2f}')}.",
        "",
        f"=== END OF REPORT: {symbol} ===",
    ]

    return "\n".join(lines)


def write_stock_analysis_snapshot(symbol: str, stock_details: dict) -> None:
    """
    Write a structured analysis snapshot for `symbol` to kb_data/{symbol}.txt.
    Then trigger a RAG re-index so the chatbot picks up the new data.

    This function is designed to be called from a daemon thread — it is
    completely non-blocking from the HTTP request/response cycle.
    """
    try:
        _KB_DATA_DIR.mkdir(parents=True, exist_ok=True)
        text = _build_document(symbol, stock_details)
        out_path = _KB_DATA_DIR / f"{symbol}.txt"
        out_path.write_text(text, encoding="utf-8")
        logger.info(f"[KB] Snapshot written: {out_path} ({len(text)} chars)")

        # Trigger RAG re-index with the updated kb_data/ directory
        from services.rag_service import update_symbol_in_kb
        update_symbol_in_kb(symbol)

    except Exception as exc:
        logger.error(f"[KB] Failed to write snapshot for {symbol}: {exc}")

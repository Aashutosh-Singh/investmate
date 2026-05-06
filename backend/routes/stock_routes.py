import os
from flask import Blueprint, jsonify, request
import logging
import threading
import numpy as np
import requests
import yfinance as yf
from datetime import datetime, timedelta
import math
from .sentiment_analysis import fetch_and_analyze_stock_sentiment
from .risk_analysis import fetch_risk_results, risk_analysis_model
from .prediction_analysis import stock_price_predictor

stock_bp = Blueprint('stock', __name__)
risk_bp = Blueprint('risk', __name__)
portfolio = ['TCS.NS', 'ITC.NS', 'ZOMATO.NS', 'TATASTEEL.NS', 'INFY.NS', 
                'RELIANCE.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS']
@risk_bp.route('/analyze/<symbol>', methods=['GET'])
def analyze_stock_risk(symbol):
    try:
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400
        
        # Attempt to get risk analysis results
        results = fetch_risk_results(symbol, portfolio)
        
        # Check for error in results
        if 'error' in results:
            return jsonify({
                "risk_analysis": {
                    "error": results['error'],
                    "risk_level": 'N/A',
                    "volatility": 'N/A',
                    "daily_return": 'N/A',
                    "current_price": 'N/A',
                    "trend": 'N/A',
                    "latest_close": None
                }
            }), 400
        
        # Return successful risk analysis
        return jsonify({
            "risk_analysis": {
                "risk_level": results.get('risk_level', 'N/A'),
                "volatility": results.get('volatility', 'N/A'),
                "daily_return": results.get('daily_return', 'N/A'),
                "current_price": results.get('current_price', 'N/A'),
                "trend": results.get('trend', 'N/A'),
                "latest_close": results.get('latest_close', None)
            }
        })
        
    except Exception as e:
        logging.error(f"Comprehensive error analyzing risk for {symbol}: {str(e)}")
        return jsonify({
            "risk_analysis": {
                "error": "Failed to analyze stock risk",
                "risk_level": 'N/A',
                "volatility": 'N/A',
                "daily_return": 'N/A',
                "current_price": 'N/A',
                "trend": 'N/A',
                "latest_close": None
            }
        }), 500
# Financial Modeling Prep API — key loaded from .env
FMP_API_KEY = os.getenv('FMP_API_KEY', '')
BASE_URL = 'https://financialmodelingprep.com/api'


def search_stocks(query):
    try:
        search_url = f"https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            'q': query,
            'quotesCount': 10,
            'newsCount': 0
        }
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
        
        response = requests.get(search_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for quote in data.get('quotes', []):
            if quote.get('quoteType') in ['EQUITY', 'ETF', 'INDEX']:
                results.append({
                    'symbol': quote.get('symbol'),
                    'name': quote.get('longname') or quote.get('shortname') or quote.get('symbol'),
                    'exchange': quote.get('exchDisp', "Unknown")
                })
        
        return results
    
    except Exception as e:
        logging.error(f"Error in stock search: {e}")
        raise

@stock_bp.route('/search', methods=['GET'])
def search_stocks_route():
    query = request.args.get('name', '').strip()
    
    if not query:
        return jsonify({"error": "Please provide a valid stock name or symbol"}), 400
    
    try:
        search_results = search_stocks(query)
        return jsonify(search_results)
    
    except requests.RequestException as e:
        logging.error(f"Network error: {e}")
        return jsonify({"error": "Network error occurred"}), 500
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

def get_stock_details(symbol):
    try:
        # Initialize default response structure with safe defaults
        stock_details = {
            'current_quote': {
                'price': 0.0,
                'change': 0.0,
                'change_percent': 0.0,
                'currency': 'USD',
            },
            'profile': {
                'name': 'Unknown',
                'symbol': symbol,
                'industry': 'Unknown',
                'sector': 'Unknown',
                'country': 'Unknown',
                'website': '#',
                'currency': 'USD',
            },
            'historical_prices': [],
            'news': [],
            'sentiment': None,
            'risk_analysis': None,
            'price_prediction': None
        }

        # Fetch stock information using yfinance
        stock = yf.Ticker(symbol)

        # Company Profile from yfinance
        if stock.info:
            # currency: yfinance returns 'INR', 'USD', 'GBP', 'EUR', etc.
            currency = (stock.info.get('currency') or stock.info.get('financialCurrency') or 'USD').upper()
            stock_details['profile'].update({
                'name':     stock.info.get('longName', 'Unknown'),
                'industry': stock.info.get('industry', 'Unknown'),
                'sector':   stock.info.get('sector', 'Unknown'),
                'country':  stock.info.get('country', 'Unknown'),
                'website':  stock.info.get('website', '#'),
                'currency': currency,
            })
        else:
            currency = 'USD'  # safe fallback

        # Current Quote from yfinance
        current_price = stock.history(period='5d').dropna(subset=['Close'])
        if len(current_price) >= 2:
            close_price = current_price['Close'].iloc[-1]
            previous_close = current_price['Close'].iloc[-2]
            
            if not np.isnan(close_price) and not np.isnan(previous_close):
                change = close_price - previous_close
                change_percent = (change / previous_close) * 100

                stock_details['current_quote'] = {
                    'price':          float(close_price),
                    'change':         float(change),
                    'change_percent': float(change_percent),
                    'currency':       currency,
                }

        # Historical Prices (Last 365 days) from yfinance
        historical_data = stock.history(period='1y')
        if not historical_data.empty:
            historical_data = historical_data.dropna(subset=['Close'])
            stock_details['historical_prices'] = [
                {
                    'date': idx.strftime('%Y-%m-%d'),
                    'close': float(row['Close'])
                }
                for idx, row in historical_data.iterrows()
            ]

        # News from Financial Modeling Prep (unchanged from original)
        news_url = f"{BASE_URL}/v3/stock_news"
        news_response = requests.get(news_url, params={
            'tickers': symbol,
            'limit': 5,
            'apikey': FMP_API_KEY
        })
        news_data = news_response.json()

        if news_data and isinstance(news_data, list):
            stock_details['news'] = [
                {
                    'title': article.get('title', ''),
                    'publisher': article.get('site', ''),
                    'link': article.get('url', ''),
                    'published_at': article.get('publishedDate', '')
                }
                for article in news_data[:5]
            ]

        # Fetch sentiment analysis 
        try:
            sentiment_data = fetch_and_analyze_stock_sentiment(symbol)
            
            # Combine existing news with sentiment news if needed
            existing_news = stock_details.get('news', [])
            sentiment_news = sentiment_data.get('news', [])
            
            # Merge news, prioritizing sentiment news but keeping existing if sentiment news is empty
            stock_details['news'] = sentiment_news if sentiment_news else existing_news
            
            stock_details['sentiment'] = {
                'overall_prediction': sentiment_data.get('overall_prediction', None),
                'overall_sentiment':  sentiment_data.get('overall_sentiment', 'Unknown'),
                'articles_analyzed':  sentiment_data.get('articles_analyzed', 0),
                'bullish_count':      sentiment_data.get('bullish_count', 0),
                'bearish_count':      sentiment_data.get('bearish_count', 0),
                'neutral_count':      sentiment_data.get('neutral_count', 0),
                'yfinance_score':     sentiment_data.get('yfinance_score', None),
                'newsapi_score':      sentiment_data.get('newsapi_score', None),
            }
        except Exception as e:
            logging.error(f"Error fetching sentiment: {e}")
            stock_details['sentiment'] = None
        # Fetch Risk Analysis
        try:
            # Directly call the function to avoid localhost deadlock
            results = fetch_risk_results(symbol, portfolio)
            if 'error' not in results:
                stock_details['risk_analysis'] = {
                    'risk_level': results.get('risk_level', 'N/A'),
                    'volatility': results.get('volatility', 'N/A'),
                    'daily_return': results.get('daily_return', 'N/A'),
                    'current_price': results.get('current_price', 'N/A'),
                    'trend': results.get('trend', 'N/A'),
                    'latest_close': results.get('latest_close', None)
                }
            else:
                stock_details['risk_analysis'] = {
                    'risk_level': 'N/A',
                    'volatility': 'N/A',
                    'daily_return': 'N/A',
                    'current_price': 'N/A',
                    'latest_close': None,
                    'trend': 'N/A'
                }
        except Exception as e:
            logging.error(f"Error fetching risk analysis: {e}")
            stock_details['risk_analysis'] = {
                'risk_level': 'N/A',
                'volatility': 'N/A',
                'daily_return': 'N/A',
                'current_price': 'N/A',
                'latest_close': None,
                'trend': 'N/A'
            }
        try:
            # Use the stock_price_predictor function
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            prediction_result = stock_price_predictor(symbol, start_date, end_date)
            
            if 'error' not in prediction_result:
                pred = prediction_result

                # ── Merge sentiment into signal (30% weight) ─────────────────
                sentiment_raw = (stock_details.get('sentiment') or {}).get('overall_prediction')
                signal_dict   = pred.get('trading_signal', {})
                signal_label  = signal_dict.get('label', 'Hold')

                if sentiment_raw is not None:
                    sent_norm   = (float(sentiment_raw) - 50) / 50        # -1..+1
                    p_up_norm   = (pred.get('direction_probability', 50) - 50) / 50
                    combined    = 0.70 * p_up_norm + 0.30 * sent_norm
                    val_auc     = pred.get('val_auc', 0.5)
                    conf        = pred.get('prediction_confidence', 50)
                    regime      = pred.get('regime', 'Unknown')

                    if val_auc < 0.52 or conf < 35:
                        signal_label = 'Model Unreliable'
                    elif combined >=  0.40: signal_label = 'Strong Buy'
                    elif combined >=  0.15: signal_label = 'Buy'
                    elif combined <= -0.40: signal_label = 'Strong Sell'
                    elif combined <= -0.15: signal_label = 'Sell'
                    else:                   signal_label = 'Hold'

                    signal_dict['label'] = signal_label
                    signal_dict['sentiment_merged'] = True
                # ─────────────────────────────────────────────────────────────

                stock_details['price_prediction'] = {
                    'predicted_price':       pred.get('predicted_price'),
                    'last_close_price':      pred.get('last_close_price'),
                    'price_change':          pred.get('price_change'),
                    'price_change_percent':  pred.get('price_change_percent'),
                    'direction_probability': pred.get('direction_probability'),
                    'expected_return_pct':   pred.get('expected_return_pct'),
                    'confidence_interval':   pred.get('confidence_interval'),
                    'prediction_direction':  pred.get('prediction_direction'),
                    'prediction_confidence': pred.get('prediction_confidence'),
                    'val_auc':               pred.get('val_auc'),
                    'regime':                pred.get('regime'),
                    'trading_signal':        signal_dict,
                }
            else:
                logging.error(f"Price prediction error: {prediction_result['error']}")
                stock_details['price_prediction'] = None

        except Exception as e:
            logging.error(f"Error in price prediction: {e}")
            stock_details['price_prediction'] = None

        # ── Fire-and-forget KB snapshot ───────────────────────────────────────
        # Writes a structured analysis document to kb_data/{symbol}.txt and
        # triggers a RAG re-index so the chatbot can answer follow-up questions.
        # Runs in a daemon thread so the HTTP response is never delayed.
        try:
            from services.kb_generator import write_stock_analysis_snapshot
            threading.Thread(
                target=write_stock_analysis_snapshot,
                args=(symbol, stock_details),
                daemon=True,
            ).start()
        except Exception as kb_err:
            logging.warning(f"[KB] Snapshot skipped for {symbol}: {kb_err}")

        return stock_details

    except Exception as e:
        logging.error(f"Comprehensive error fetching stock details: {e}")
        return None
    
def replace_nan(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    elif isinstance(obj, dict):
        return {k: replace_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan(v) for v in obj]
    return obj

@stock_bp.route('/details/<symbol>', methods=['GET'])
def stock_details_route(symbol):
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    try:
        details = get_stock_details(symbol)
        if details is None:
            return jsonify({"error": "Could not retrieve stock details"}), 404

        # Record view in user history (fire-and-forget, only if authenticated)
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                from utils.auth import verify_token
                from models.user_model import add_to_search_history
                payload = verify_token(auth_header[7:])
                if payload:
                    stock_name = (details.get("profile") or {}).get("name", "")
                    threading.Thread(
                        target=add_to_search_history,
                        args=(payload["username"], symbol, stock_name),
                        daemon=True,
                    ).start()
        except Exception:
            pass

        return jsonify(replace_nan(details))

    except Exception as e:
        logging.error(f"Error in stock details route: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500
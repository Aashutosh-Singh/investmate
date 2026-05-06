import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
import re
import praw
import os
import yfinance as yf
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Helper function to clean text
def clean_text(text):
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'[^a-zA-Z ]', '', text)
    return text.strip().lower()

# Sentiment Analysis using VADER and TextBlob
def analyze_sentiment(text):
    cleaned_text = clean_text(text)

    # VADER Sentiment Analysis
    analyzer = SentimentIntensityAnalyzer()
    vader_score = analyzer.polarity_scores(cleaned_text)['compound']

    textblob_score = TextBlob(cleaned_text).sentiment.polarity
    
    combined_score = (vader_score + textblob_score) / 2

    # Normalize to 1-100 scale
    sentiment_score = int((combined_score + 1) * 50)
    return sentiment_score

# Function to classify sentiment
def classify_sentiment(score):
    if score <= 40:
        return "Strong Sell"
    elif 41 <= score < 45:
        return "Sell"
    elif 45 <= score < 48:
        return "Weak Sell"
    elif 48 <= score < 52:
        return "Neutral"
    elif 52 <= score < 55:
        return "Weak Buy"
    elif 55 <= score < 60:
        return "Buy"
    else:
        return "Strong Buy"

def fetch_market_sentiment(market_type="global", country="US", num_articles=5):
    api_key = os.getenv('NEWS_API_KEY_MARKET', '')

    if market_type == "global":
        query = "stock market"
    elif market_type == "country":
        query = f"stock market {country}"
    else:
        print("Invalid market type. Please choose 'global' or 'country'.")
        return []

    url = f'https://newsapi.org/v2/everything?q={query}&sortBy=publishedAt&apiKey={api_key}'
    scores = []
    news_data = []

    try:
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()
        articles = data.get('articles', [])

        for article in articles[:num_articles]:
            title = article.get('title', '')
            description = article.get('description', '')
            url = article.get('url', '')

            if title and description and "[Removed]" not in title and "[Removed]" not in description:
                text = title + " " + description
                sentiment_score = analyze_sentiment(text)
                scores.append(sentiment_score)

                # Truncate description if it's too long
                if len(description) > 200:
                    description = description[:197] + '...'

                news_data.append({
                    "headline": title,
                    "url": url,
                    "description": description,
                    "relevant_prediction": sentiment_score,
                    "sentiment_classification": classify_sentiment(sentiment_score)
                })

    except requests.exceptions.RequestException as e:
        print(f"Error fetching news: {e}")

    if scores:
        overall_score = sum(scores) / len(scores)
        return {
            "overall_prediction": overall_score,
            "overall_sentiment": classify_sentiment(overall_score),
            "news": news_data
        }
    else:
        return {
            "overall_prediction": None,
            "overall_sentiment": "Unknown",
            "news": []
        }

def fetch_news_sentiment(stock_symbol, num_articles=5):
    api_key = os.getenv('NEWS_API_KEY_STOCK', '')
    url = f'https://newsapi.org/v2/everything?q={stock_symbol}&language=en&apiKey={api_key}'
    scores = []
    news_data = []

    try:
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()
        articles = data.get('articles', [])

        for article in articles[:num_articles]:
            title = article.get('title', '')
            description = article.get('description', '')
            url = article.get('url', '')

            if title and description and "[Removed]" not in title and "[Removed]" not in description:
                text = title + " " + description
                sentiment_score = analyze_sentiment(text)
                scores.append(sentiment_score)

                # Truncate description if it's too long
                if len(description) > 200:
                    description = description[:197] + '...'

                news_data.append({
                    "headline": title,
                    "url": url,
                    "description": description,
                    "relevant_prediction": sentiment_score,
                    "sentiment_classification": classify_sentiment(sentiment_score)
                })

    except requests.exceptions.RequestException as e:
        print(f"Error fetching news: {e}")

    if scores:
        overall_score = sum(scores) / len(scores)
        return {
            "overall_prediction": overall_score,
            "overall_sentiment": classify_sentiment(overall_score),
            "news": news_data
        }
    else:
        return {
            "overall_prediction": None,
            "overall_sentiment": "Unknown",
            "news": []
        }

def fetch_reddit_sentiment(stock_symbol, num_posts=5):
    # Strip exchange suffix (e.g. TCS.NS -> TCS) so search doesn't include dots
    clean_symbol = re.sub(r'\.(NS|BO|BSE|NSE)$', '', stock_symbol, flags=re.IGNORECASE)

    try:
        reddit = praw.Reddit(
            client_id=os.getenv('REDDIT_CLIENT_ID', ''),
            client_secret=os.getenv('REDDIT_CLIENT_SECRET', ''),
            user_agent=os.getenv('REDDIT_USER_AGENT', 'AI-lluminati'),
            username=os.getenv('REDDIT_USERNAME', ''),
            password=os.getenv('REDDIT_PASSWORD', '')
        )
    except Exception:
        return {"overall_prediction": None, "overall_sentiment": "Unknown", "news": []}

    scores = []
    reddit_data = []

    # Search only in financial subreddits — prevents getting gaming/sports results
    finance_subs = 'IndianStockMarket+Dalalstreet+stocks+investing+india+SecurityAnalysis'
    # Add 'stock' keyword alongside the symbol so "TCS" finds financial posts not tournaments
    query = f"{clean_symbol} stock"

    try:
        subreddit = reddit.subreddit(finance_subs)
        posts = subreddit.search(query, limit=num_posts * 3, sort='relevance', time_filter='year')

        count = 0
        for post in posts:
            if count >= num_posts:
                break
            text = post.title + " " + post.selftext
            sentiment_score = analyze_sentiment(text)
            scores.append(sentiment_score)

            description = post.selftext.strip() if post.selftext else None
            if description and len(description) > 200:
                description = description[:197] + '...'

            reddit_data.append({
                "headline": post.title,
                "url": f"https://reddit.com{post.permalink}",
                "description": description,
                "publisher": f"r/{post.subreddit.display_name}",
                "published_at": datetime.utcfromtimestamp(post.created_utc).isoformat(),
                "relevant_prediction": sentiment_score,
                "sentiment_classification": classify_sentiment(sentiment_score)
            })
            count += 1
    except Exception:
        # PRAW can fail due to auth issues — silently return empty rather than crashing
        pass

    if scores:
        overall_score = sum(scores) / len(scores)
        return {
            "overall_prediction": overall_score,
            "overall_sentiment": classify_sentiment(overall_score),
            "news": reddit_data
        }
    else:
        return {
            "overall_prediction": None,
            "overall_sentiment": "Unknown",
            "news": []
        }

def fetch_enhanced_news_sentiment(stock_symbol, num_display=5):
    api_key = os.getenv('NEWS_API_KEY_STOCK', '')
    url = f'https://newsapi.org/v2/everything?q={stock_symbol}&language=en&sortBy=relevancy&pageSize=25&apiKey={api_key}'
    
    try:
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()
        articles = data.get('articles', [])

        # Filter and process articles
        news_data = []
        for article in articles:
            # Only include articles with description and URL
            if (article.get('description') and 
                article.get('url') and 
                "[Removed]" not in article.get('title', '') and 
                "[Removed]" not in article.get('description', '')):
                
                title = article.get('title', '')
                description = article.get('description', '')
                url = article.get('url', '')
                publisher = article.get('source', {}).get('name', 'Unknown')
                published_at = article.get('publishedAt', '')

                # Analyze sentiment
                text = title + " " + description
                sentiment_score = analyze_sentiment(text)

                # Truncate description if needed
                if len(description) > 200:
                    description = description[:197] + '...'

                news_data.append({
                    "headline": title,
                    "url": url,
                    "description": description,
                    "publisher": publisher,
                    "published_at": published_at,
                    "relevant_prediction": sentiment_score,
                    "sentiment_classification": classify_sentiment(sentiment_score)
                })

                # Stop if we have 5 articles
                if len(news_data) == num_display:
                    break

        # If less than 5 articles found, return what we have
        if news_data:
            # Calculate overall sentiment
            scores = [article['relevant_prediction'] for article in news_data]
            overall_score = sum(scores) / len(scores)
            
            return {
                "overall_prediction": overall_score,
                "overall_sentiment": classify_sentiment(overall_score),
                "news": news_data
            }
        else:
            return {
                "overall_prediction": None,
                "overall_sentiment": "Unknown",
                "news": []
            }

    except requests.exceptions.RequestException as e:
        print(f"Error fetching news: {e}")
        return {
            "overall_prediction": None,
            "overall_sentiment": "Unknown",
            "news": []
        }

# ── yfinance news (primary source — actual financial journalism) ──────────────
def fetch_yfinance_news_sentiment(stock_symbol, num_articles=10):
    """
    Fetch news directly from Yahoo Finance via yfinance.
    Returns curated financial articles (Reuters, Bloomberg, etc.) with real URLs.
    Far more reliable than Reddit for stock-specific news.
    """
    try:
        ticker = yf.Ticker(stock_symbol)
        raw_news = ticker.news or []

        scores = []
        news_data = []

        for item in raw_news[:num_articles]:
            content = item.get('content', {})
            title = content.get('title', '') or item.get('title', '')
            if not title:
                continue

            url = (
                content.get('canonicalUrl', {}).get('url', '')
                or item.get('link', '')
            )
            publisher = (
                content.get('provider', {}).get('displayName', '')
                or item.get('publisher', 'Yahoo Finance')
            )
            pub_date = content.get('pubDate', '') or (
                datetime.utcfromtimestamp(item['providerPublishTime']).isoformat()
                if item.get('providerPublishTime') else None
            )

            sentiment_score = analyze_sentiment(title)
            scores.append(sentiment_score)

            news_data.append({
                'headline':    title,
                'url':         url,
                'publisher':   publisher,
                'published_at': pub_date,
                'description': None,
                'relevant_prediction': sentiment_score,
                'sentiment_classification': classify_sentiment(sentiment_score),
                'source': 'yfinance',
            })

        if scores:
            return {
                'overall_prediction': sum(scores) / len(scores),
                'overall_sentiment':  classify_sentiment(sum(scores) / len(scores)),
                'news': news_data,
                'source': 'yfinance',
            }
    except Exception as e:
        print(f'yfinance news fetch failed for {stock_symbol}: {e}')

    return {'overall_prediction': None, 'overall_sentiment': 'Unknown', 'news': [], 'source': 'yfinance'}


# ── Combined sentiment ─────────────────────────────────────────────────────────
def fetch_and_analyze_stock_sentiment(stock_symbol, num_posts=5):
    """
    Primary:   yfinance news (Reuters, GuruFocus, etc.) — real financial URLs.
    Secondary: NewsAPI (additional coverage).
    Reddit removed — it returned unrelated results (sports/gaming tournaments).

    Returns enriched dict with per-source scores, article counts, and
    bullish/bearish/neutral breakdown for a rich frontend sentiment card.
    """
    yf_result   = fetch_yfinance_news_sentiment(stock_symbol, num_articles=8)
    news_result = fetch_enhanced_news_sentiment(stock_symbol, num_display=5)

    yf_news  = yf_result.get('news', [])
    api_news = [a for a in news_result.get('news', []) if a.get('url')]
    all_news = yf_news + api_news

    all_scores = [a['relevant_prediction'] for a in all_news]

    if not all_scores:
        return {
            'overall_prediction': None,
            'overall_sentiment':  'Unknown',
            'news': [],
            'articles_analyzed': 0,
            'bullish_count': 0, 'bearish_count': 0, 'neutral_count': 0,
            'yfinance_score': None, 'newsapi_score': None,
        }

    overall = sum(all_scores) / len(all_scores)
    bullish = sum(1 for s in all_scores if s >= 60)
    bearish = sum(1 for s in all_scores if s <= 40)
    neutral = len(all_scores) - bullish - bearish

    yf_scores  = [a['relevant_prediction'] for a in yf_news  if a.get('relevant_prediction') is not None]
    api_scores = [a['relevant_prediction'] for a in api_news if a.get('relevant_prediction') is not None]

    return {
        'overall_prediction': round(overall, 2),
        'overall_sentiment':  classify_sentiment(overall),
        'news': all_news[:10],
        'articles_analyzed': len(all_scores),
        'bullish_count':  bullish,
        'bearish_count':  bearish,
        'neutral_count':  neutral,
        'yfinance_score':  round(sum(yf_scores)  / len(yf_scores),  2) if yf_scores  else None,
        'newsapi_score':   round(sum(api_scores) / len(api_scores), 2) if api_scores else None,
    }


if __name__ == '__main__':
    result = fetch_and_analyze_stock_sentiment('TCS.NS')
    print(f"Score: {result['overall_prediction']} | {result['overall_sentiment']}")
    print(f"Articles: {result['articles_analyzed']} | Bull:{result['bullish_count']} Bear:{result['bearish_count']} Neutral:{result['neutral_count']}")
    for item in result['news']:
        print(f"  [{item.get('publisher','-')}] {item['headline'][:80]}")
        print(f"  {item.get('url','-')}")
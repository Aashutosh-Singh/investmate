<div align="center">

<img src="https://img.shields.io/badge/InvestMate-AI%20Stock%20Analyser-white?style=for-the-badge&logo=trending-up" alt="InvestMate" />

# InvestMate

**AI-powered stock analysis platform with LSTM price prediction, multi-source sentiment analysis, and a RAG-based conversational chatbot.**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.21-FF6F00?logo=tensorflow)](https://tensorflow.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?logo=flask)](https://flask.palletsprojects.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://mongodb.com/atlas)
[![LangChain](https://img.shields.io/badge/LangChain-RAG-1C3C3C?logo=chainlink)](https://langchain.com)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Contributing](#contributing)

---

## Overview

InvestMate is a full-stack web application that brings institutional-grade stock analysis to anyone. It combines:

- A **Bidirectional LSTM neural network** trained on 36 technical indicators to predict the 5-day price direction and expected return for any stock
- **Multi-source sentiment analysis** using Yahoo Finance news and NewsAPI, scored by VADER and TextBlob
- A **RAG-powered chatbot** (LangChain + Google Gemini + FAISS) that can answer in-depth questions about *why* the model gave a specific signal — backed by the actual analysis data, not generic answers
- A full **user account system** with watchlists, viewing history, and a personalised dashboard

The app works with any stock traded on Yahoo Finance — Indian stocks (NSE/BSE), US stocks, UK stocks, and more. Currencies are detected automatically per stock.

---

## Features

| Feature | Details |
|---|---|
| 🔍 **Stock Search** | Search any global stock by name or ticker symbol |
| 📈 **LSTM Price Prediction** | 5-day horizon, bidirectional LSTM, 36 technical indicators, Monte Carlo confidence interval |
| 📰 **Sentiment Analysis** | Yahoo Finance + NewsAPI articles scored by VADER + TextBlob, with bullish/bearish breakdown |
| ⚠️ **Risk Analysis** | Annualised volatility, daily return, beta vs benchmark, market trend |
| 🤖 **RAG Chatbot** | Ask *"Why Hold?"*, *"What's the market regime?"* — AI answers using the actual analysis numbers |
| 💱 **Multi-currency** | Automatically detects and displays the correct currency (₹, $, £, €, etc.) |
| 👤 **Accounts** | JWT auth, watchlist, viewing history, personalised dashboard |
| 📊 **Market Overview** | Live Nifty 50 and Sensex charts on the home page |

---

## Tech Stack

### Backend (Python / Flask)
| Library | Purpose |
|---|---|
| **Flask** | REST API server |
| **TensorFlow / Keras** | Bidirectional LSTM model training and inference |
| **yfinance** | Stock price history, company info, news |
| **VADER + TextBlob** | Sentiment scoring of news headlines |
| **LangChain** | RAG pipeline orchestration |
| **Google Gemini** | LLM for chatbot responses + text embeddings |
| **FAISS** | Vector similarity search for document retrieval |
| **PyMongo** | MongoDB interaction (users, watchlists) |
| **bcrypt** | Password hashing |
| **PyJWT** | JWT token generation and verification |
| **PRAW** | Reddit API client (optional sentiment source) |
| **python-dotenv** | Environment variable management |

### Frontend (React)
| Library | Purpose |
|---|---|
| **React 18** | UI framework |
| **React Router** | Client-side routing |
| **Framer Motion** | Animations and transitions |
| **Recharts** | Price history and market charts |
| **Lucide React** | Icon set |
| **Tailwind CSS** | Utility-first styling |
| **Axios** | HTTP requests |
| **react-hot-toast** | Toast notifications |

### Infrastructure
| Service | Purpose |
|---|---|
| **MongoDB Atlas** | User data, watchlists, search history |
| **NewsAPI** | News article retrieval |
| **Google AI Studio** | Gemini API key |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  Home  │  StockAnalysis  │  Dashboard  │  Login  │  Signup  │
│                    ChatWidget (floating)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (JWT in Authorization header)
┌────────────────────────▼────────────────────────────────────┐
│                    Flask Backend (:5000)                      │
│                                                              │
│  /auth/*       Auth routes (signup, login)                   │
│  /stocks/*     Stock details, search, risk                   │
│  /api/market/* Nifty 50, Sensex, top stocks                  │
│  /api/chatbot/ RAG chat, KB status                           │
│  /user/*       Profile, watchlist, history                   │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  Prediction  │  │  Sentiment    │  │   RAG Service    │  │
│  │  (LSTM+TF)   │  │ (VADER+Blob)  │  │ (LangChain+FAISS)│  │
│  └──────────────┘  └───────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐                         │
│  │ KB Generator │  │  Risk Analysis│                         │
│  │ (auto-writes │  │  (volatility, │                         │
│  │  kb_data/)   │  │  beta, trend) │                         │
│  └──────────────┘  └───────────────┘                         │
└──────┬──────────────────┬───────────────────────────────────┘
       │                  │
  ┌────▼────┐       ┌─────▼──────────┐
  │ MongoDB │       │  yfinance API  │
  │  Atlas  │       │  NewsAPI       │
  └─────────┘       │  Google Gemini │
                    └────────────────┘
```

### Data Flow: Stock Analysis Request

```
1. User visits /stocks/AAPL
2. Frontend → GET /stocks/details/AAPL  (with JWT if logged in)
3. Backend:
   a. yfinance → company profile, prices, currency, news
   b. Sentiment pipeline → VADER + TextBlob on headlines → score 0–100
   c. Risk module → volatility, beta, trend
   d. LSTM module → check cache → train if >7 days old → predict price + direction
   e. Blend LSTM signal (70%) + sentiment (30%) → final trading signal
   f. JSON response → frontend
4. Background thread (non-blocking):
   → kb_generator writes kb_data/AAPL.txt with all analysis data
   → RAG service rebuilds FAISS index
5. User asks chatbot "Why Hold?" → RAG retrieves from AAPL.txt → Gemini answers
```

---

## Project Structure

```
investmate/
├── backend/
│   ├── app.py                    # Flask application factory
│   ├── .env                      # 🔒 Secret keys (never commit)
│   ├── .env.example              # Template for environment variables
│   ├── KB.pdf                    # Optional supplementary finance doc for RAG
│   ├── kb_data/                  # Auto-generated stock analysis snapshots (gitignored)
│   │   └── TCS.NS.txt            # Example: written after each analysis
│   ├── Ai_models/                # Trained LSTM models cached on disk (gitignored)
│   ├── routes/
│   │   ├── auth_routes.py        # POST /auth/signup, /auth/login
│   │   ├── stock_routes.py       # GET /stocks/details/:symbol, /stocks/search
│   │   ├── market_routes.py      # GET /api/market/market-overview
│   │   ├── chatbot_routes.py     # POST /api/chatbot/chat
│   │   ├── user_routes.py        # GET/POST /user/watchlist, /user/history
│   │   ├── prediction_analysis.py# Bidirectional LSTM engine
│   │   ├── sentiment_analysis.py # VADER + TextBlob pipeline
│   │   └── risk_analysis.py      # Volatility, beta, trend
│   ├── services/
│   │   ├── rag_service.py        # LangChain + FAISS RAG engine
│   │   └── kb_generator.py       # Auto-generates kb_data/*.txt snapshots
│   ├── models/
│   │   └── user_model.py         # MongoDB user CRUD (watchlist, history)
│   └── utils/
│       ├── auth.py               # JWT generate/verify
│       └── db.py                 # MongoDB connection
│
├── frontend/
│   ├── .env                      # REACT_APP_API_URL (never commit)
│   ├── .env.example              # Template for frontend env
│   ├── package.json
│   └── src/
│       ├── App.js                # Router, auth state
│       ├── pages/
│       │   ├── Home.js           # Landing page + market overview
│       │   ├── StockAnalysis.js  # Full stock analysis view
│       │   ├── Dashboard.js      # User dashboard (watchlist, history)
│       │   ├── Login.js
│       │   └── Signup.js
│       ├── components/
│       │   ├── ChatWidget.js     # Floating RAG chatbot
│       │   ├── PricePredictionCard.js
│       │   ├── RiskAnalysisSection.js
│       │   └── StockSentimentDisplay.js
│       └── utils/
│           └── currency.js       # formatCurrency() — auto-detects ₹ / $ / £ / €
│
├── notebooks/                    # Jupyter notebooks for experimentation
├── scratch/                      # Throwaway test scripts (gitignored)
└── README.md
```

---

## Prerequisites

Before you begin, make sure you have:

| Tool | Version | Download |
|---|---|---|
| **Python** | 3.11.x | [python.org](https://python.org/downloads) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Git** | Any | [git-scm.com](https://git-scm.com) |

You will also need **free accounts** at:

| Service | What for | Free tier |
|---|---|---|
| [MongoDB Atlas](https://mongodb.com/atlas) | User database | 512 MB free cluster |
| [NewsAPI](https://newsapi.org) | Stock news | 100 req/day free |
| [Google AI Studio](https://aistudio.google.com) | Gemini API (chatbot) | Free tier available |
| [Reddit](https://www.reddit.com/prefs/apps) | Reddit sentiment (optional) | Free |
| [Financial Modeling Prep](https://financialmodelingprep.com) | Stock search | Free tier |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/investmate.git
cd investmate
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

#### Create your environment file

```bash
# Copy the template
cp .env.example .env
```

Open `backend/.env` and fill in your API keys (see [Environment Variables](#environment-variables)).

#### Start the backend

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

### 3. Frontend setup

Open a **new terminal**:

```bash
cd frontend

# Install Node dependencies
npm install

# Copy the environment template
cp .env.example .env
```

The default `frontend/.env` is:
```
REACT_APP_API_URL=http://127.0.0.1:5000
```

This is correct for local development. No changes needed.

#### Start the frontend

```bash
npm start
```

The app will open at **http://localhost:3000**

---

## Environment Variables

### `backend/.env`

Create this file by copying `backend/.env.example`. Fill in each value:

```env
# ── MongoDB ───────────────────────────────────────────────────────────────────
# Your MongoDB Atlas connection string.
# Create a free cluster at https://mongodb.com/atlas → Connect → Drivers → Python
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/StockAnalysis

# ── News API ──────────────────────────────────────────────────────────────────
# Get free keys at https://newsapi.org/register
# Use the same key for both, or register two accounts for higher rate limits.
NEWS_API_KEY_MARKET=your_newsapi_key_here
NEWS_API_KEY_STOCK=your_newsapi_key_here

# ── Reddit (optional — used for sentiment, falls back gracefully if missing) ──
# Create an app at https://www.reddit.com/prefs/apps (type: script)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=InvestMate/1.0 by YourUsername
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password

# ── Financial Modeling Prep ───────────────────────────────────────────────────
# Free API key at https://financialmodelingprep.com/developer/docs
FMP_API_KEY=your_fmp_key_here

# ── Google Gemini ─────────────────────────────────────────────────────────────
# Get your key at https://aistudio.google.com/app/apikey
# Required for the RAG chatbot to work.
GOOGLE_API_KEY=your_google_api_key_here
```

### `frontend/.env`

```env
# URL of your running Flask backend
REACT_APP_API_URL=http://127.0.0.1:5000
```

> ⚠️ **Never commit `.env` files.** They are listed in `.gitignore`. Your actual API keys must never be pushed to GitHub.

---

## API Reference

All backend endpoints are served from `http://127.0.0.1:5000`.

### Authentication (`/auth`)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | `{username, password}` | Create a new account |
| `POST` | `/auth/login` | `{username, password}` | Returns a JWT token |

### Stocks (`/stocks`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/stocks/search?name=<query>` | Search stocks by name or symbol |
| `GET` | `/stocks/details/<symbol>` | Full analysis: price, prediction, sentiment, risk |

### User (`/user`) — requires `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/user/profile` | Get user profile + watchlist + history |
| `GET` | `/user/watchlist` | List watchlisted stocks |
| `POST` | `/user/watchlist` | Add stock: `{symbol, name}` |
| `DELETE` | `/user/watchlist/<symbol>` | Remove stock from watchlist |
| `GET` | `/user/history` | Recent stock views |

### Chatbot (`/api/chatbot`)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/chatbot/chat` | `{message, symbol?, history?}` | Send a message to the AI |
| `GET` | `/api/chatbot/kb-status` | — | Check RAG index status |
| `GET` | `/api/chatbot/available-stocks` | — | List stocks indexed in the KB |

### Market (`/api/market`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/market/market-overview` | Nifty 50, Sensex, top stocks |

---

## How It Works

### LSTM Price Prediction

The model uses a **sliding window** of 60 trading days, each day represented by 36 engineered features:

- **Log returns** at 1, 3, 5, 10, 20, 60-day horizons
- **Historical volatility** (10, 20, 60-day rolling std)
- **Moving averages** (SMA 20/50/200, EMA cross)
- **MACD** (line, histogram, crossover signal)
- **RSI** and rate-of-change
- **Bollinger Bands** (% position, width)
- **Stochastic Oscillator** and Williams %R
- **On-Balance Volume**, ATR, VWAP deviation
- **Time encoding** (day-of-week, month — encoded as sin/cos for cyclicality)

The architecture:
```
Input (60 days × 36 features)
  → Bidirectional LSTM (96 units) + BatchNorm + Dropout 30%
  → Bidirectional LSTM (48 units) + BatchNorm + Dropout 20%
  → Temporal Attention Layer
  → Dense (64) → Dense (32)
  → ┌── direction output (Sigmoid): probability price goes UP
    └── return output (Linear): expected log-return
```

Models are cached per symbol and retrained every 7 days automatically.

### Sentiment Analysis

1. Fetches up to 8 Yahoo Finance articles + 5 NewsAPI articles per stock
2. Each headline is scored by **VADER** (rule-based, 7500+ word lexicon) and **TextBlob** (linguistic polarity)
3. Combined score mapped to 0–100 scale
4. Articles classified: Bullish (≥60), Bearish (≤40), Neutral (40–60)
5. Sentiment blended into the final trading signal at 30% weight

### RAG Chatbot

1. After each stock analysis, a structured text snapshot is written to `kb_data/{SYMBOL}.txt`
2. The snapshot is indexed into a **FAISS vector database** using Google's embedding model
3. On user query, FAISS finds the most relevant chunks (e.g., the signal rationale section)
4. The retrieved chunks + query are sent to **Gemini** with a system prompt instructing it to quote the actual data
5. The chatbot answers with the real numbers from the analysis — not generic finance advice

---

## Common Issues

**`WinError 10038` or TensorFlow crash on Windows:**
The backend uses `use_reloader=False` in `app.run()` to prevent this. Do not remove it.

**`GOOGLE_API_KEY is not set` warning on startup:**
The RAG chatbot won't work without a Gemini API key. Add it to `backend/.env`. Everything else still works.

**Stock data returns `NaN` or `null` values:**
Some stocks have missing data for certain fields. The backend sanitises these automatically — the frontend shows `—` for unavailable values.

**`npm start` fails with module not found:**
Run `npm install` inside the `frontend/` directory first.

**LSTM shows "Prediction Unavailable":**
The model needs at least 252 trading days (1 year) of history. Very new stocks or delisted tickers will not have enough data.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

<div align="center">
  <sub>Built with ❤️ using TensorFlow, Flask, React, LangChain, and Google Gemini</sub>
</div>

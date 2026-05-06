import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, Building, TrendingUp, TrendingDown, AlertTriangle, AlertOctagon, Star } from 'lucide-react';
import RiskAnalysisSection from '../components/RiskAnalysisSection';
import PricePredictionCard from '../components/PricePredictionCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/card';
import { Alert, AlertDescription } from '../components/alert';
import StockSentimentDisplay from '../components/StockSentimentDisplay';
import { formatCurrency } from '../utils/currency';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const SentimentAnalysisCard = ({ sentiment }) => {
  if (!sentiment || sentiment.overall_prediction == null) return null;

  const score   = sentiment.overall_prediction;
  const total   = sentiment.articles_analyzed || 0;
  const bullish = sentiment.bullish_count || 0;
  const bearish = sentiment.bearish_count || 0;
  const neutral = sentiment.neutral_count || 0;

  const label =
    score >= 60 ? 'Bullish' :
    score <= 40 ? 'Bearish' : 'Neutral';

  const labelColor =
    score >= 60 ? 'text-green-400' :
    score <= 40 ? 'text-red-400'   : 'text-yellow-400';

  const gaugeColor =
    score >= 60 ? 'bg-green-500' :
    score <= 40 ? 'bg-red-500'   : 'bg-yellow-400';

  const Icon = score >= 60 ? TrendingUp : score <= 40 ? TrendingDown : AlertTriangle;

  const fmtScore = (s) => s != null ? s.toFixed(1) : '—';

  return (
    <Card className="bg-zinc-900 border border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <span className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Market Sentiment
          </span>
          {total > 0 && (
            <span className="text-xs font-normal text-zinc-500">
              {total} article{total !== 1 ? 's' : ''} analysed
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Score + label */}
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-4xl font-bold ${labelColor}`}>{label}</div>
            <div className="text-zinc-500 text-sm mt-0.5">composite score</div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-mono font-semibold ${labelColor}`}>
              {score.toFixed(1)}
            </div>
            <div className="text-zinc-600 text-xs">out of 100</div>
          </div>
        </div>

        {/* Gradient gauge */}
        <div>
          <div className="w-full bg-zinc-800 rounded-full h-2 relative">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${gaugeColor}`}
              style={{ width: `${score}%` }}
            />
            {/* Neutral midline marker */}
            <div className="absolute top-0 left-1/2 w-px h-full bg-zinc-600 opacity-60" />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Bearish</span><span>Neutral</span><span>Bullish</span>
          </div>
        </div>

        {/* Article distribution */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
              Article Breakdown
            </div>
            {[
              { label: 'Bullish', count: bullish, color: 'bg-green-500' },
              { label: 'Neutral', count: neutral, color: 'bg-yellow-400' },
              { label: 'Bearish', count: bearish, color: 'bg-red-500'   },
            ].map(({ label: lbl, count, color }) => (
              <div key={lbl} className="flex items-center gap-2 text-sm">
                <span className="w-14 text-zinc-400 text-xs">{lbl}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${color} transition-all duration-700`}
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="w-4 text-right text-xs text-zinc-500">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Per-source scores */}
        {(sentiment.yfinance_score != null || sentiment.newsapi_score != null) && (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
              By Source
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sentiment.yfinance_score != null && (
                <div className="bg-zinc-800 rounded-lg px-3 py-2 text-center">
                  <div className="text-xs text-zinc-500 mb-0.5">Yahoo Finance</div>
                  <div className={`text-sm font-semibold ${
                    sentiment.yfinance_score >= 60 ? 'text-green-400' :
                    sentiment.yfinance_score <= 40 ? 'text-red-400' : 'text-yellow-400'
                  }`}>{fmtScore(sentiment.yfinance_score)}</div>
                </div>
              )}
              {sentiment.newsapi_score != null && (
                <div className="bg-zinc-800 rounded-lg px-3 py-2 text-center">
                  <div className="text-xs text-zinc-500 mb-0.5">NewsAPI</div>
                  <div className={`text-sm font-semibold ${
                    sentiment.newsapi_score >= 60 ? 'text-green-400' :
                    sentiment.newsapi_score <= 40 ? 'text-red-400' : 'text-yellow-400'
                  }`}>{fmtScore(sentiment.newsapi_score)}</div>
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};


const StockAnalysis = () => {
  const { symbol } = useParams();
  const [stockDetails, setStockDetails] = useState({
    current_quote: { price: 0, change: 0, change_percent: 0 },
    profile: { name: '', symbol: '', industry: '', sector: '', country: '', website: '' },
    historical_prices: [],
    news: [],
    country_news: [],
    sentiment: null,
    risk_analysis: null,
    price_prediction: null
  });
  const [loading, setLoading] = useState({ main: true, prediction: true });
  const [errors,  setErrors]  = useState({ main: '' });

  // Watchlist state
  const [inWatchlist,   setInWatchlist]   = useState(false);
  const [wlLoading,     setWlLoading]     = useState(false);
  const isLoggedIn = !!localStorage.getItem('token');

  // Check if this stock is already in the watchlist
  const checkWatchlist = useCallback(async () => {
    if (!isLoggedIn || !symbol) return;
    try {
      const res  = await fetch(`${API}/user/watchlist`, { headers: authHeaders() });
      const data = await res.json();
      setInWatchlist(Array.isArray(data) && data.some(w => w.symbol === symbol));
    } catch {}
  }, [symbol, isLoggedIn]);

  const toggleWatchlist = async () => {
    if (!isLoggedIn) { alert('Please log in to use your watchlist.'); return; }
    setWlLoading(true);
    try {
      if (inWatchlist) {
        await fetch(`${API}/user/watchlist/${symbol}`, { method: 'DELETE', headers: authHeaders() });
        setInWatchlist(false);
      } else {
        await fetch(`${API}/user/watchlist`, {
          method:  'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body:    JSON.stringify({ symbol, name: stockDetails.profile.name }),
        });
        setInWatchlist(true);
      }
    } catch {}
    setWlLoading(false);
  };

  useEffect(() => {
    const fetchStockData = async () => {
      if (!symbol) {
        setErrors(prev => ({ ...prev, main: 'No stock symbol provided' }));
        setLoading(prev => ({ ...prev, main: false }));
        return;
      }
      try {
        setLoading(prev => ({ ...prev, main: true }));
        const response = await fetch(
          `${API}/stocks/details/${symbol}`,
          { headers: authHeaders() }  // sends JWT so backend can record history
        );
        if (!response.ok) throw new Error(`Failed to fetch stock data: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setStockDetails(prev => ({ ...prev, ...data }));
        setErrors(prev => ({ ...prev, main: '' }));
        setLoading(prev => ({ ...prev, prediction: false }));
      } catch (err) {
        console.error('Fetch error:', err);
        setErrors(prev => ({ ...prev, main: err.message || 'Failed to load stock data' }));
        setLoading(prev => ({ ...prev, prediction: false }));
      } finally {
        setLoading(prev => ({ ...prev, main: false }));
      }
    };
    fetchStockData();
    checkWatchlist();
  }, [symbol, checkWatchlist]);

  const renderError = (error, type) => {
    if (!error) return null;
    
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertOctagon className="h-4 w-4" />
        <AlertDescription>
          {type === 'prediction' && 'Price Prediction Error: '}
          {type === 'risk' && 'Risk Analysis Error: '}
          {error}
        </AlertDescription>
      </Alert>
    );
  };

  if (loading.main) {
    const stages = [
      { label: 'Fetching 4 years of price history & company profile', done: true },
      { label: 'Computing 30+ technical indicators (RSI, MACD, Bollinger, OBV…)', done: true },
      { label: 'Running sentiment analysis on news & Reddit posts', done: true },
      { label: 'Training LSTM AI model with walk-forward validation', done: false },
    ];
    return (
      <div className="max-w-7xl mx-auto p-4 min-h-screen text-white flex items-center justify-center">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-10 shadow-2xl text-center w-full max-w-md">

          {/* Spinner */}
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-white" />
          </div>

          <h2 className="text-2xl font-bold mb-1">
            Analysing <span className="text-zinc-400">{symbol}</span>
          </h2>
          <p className="text-zinc-400 text-sm mb-6">
            First-time analysis trains an LSTM model on historical data.{' '}
            <span className="text-white font-medium">This takes 2–5 minutes.</span>
          </p>

          {/* Stage list */}
          <div className="space-y-2 text-left mb-6">
            {stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                  stage.done ? 'bg-green-500' : 'bg-white animate-pulse'
                }`} />
                <span className={stage.done ? 'text-zinc-500 line-through' : 'text-white'}>
                  {stage.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-3">
            <div
              className="h-1.5 rounded-full bg-white/70 transition-all duration-1000"
              style={{ width: '75%', animation: 'none' }}
            />
          </div>

          <p className="text-xs text-zinc-600">
            Subsequent analyses are instant — results are cached for 7 days
          </p>
        </div>
      </div>
    );
  }

  if (errors.main) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertOctagon className="h-4 w-4" />
        <AlertDescription>{errors.main}</AlertDescription>
      </Alert>
    );
  }

  const isPositiveChange = stockDetails.current_quote.change > 0;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 text-white min-h-screen">
      {/* Header Section */}
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 shadow-2xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{stockDetails.profile.name}</h1>
            <p className="text-zinc-400">{symbol}</p>
          </div>
          <div className="text-right">
              <div className="text-3xl font-bold">{formatCurrency(stockDetails.current_quote.price, stockDetails.profile.currency)}</div>
              <div className={`flex items-center justify-end ${isPositiveChange ? 'text-green-500' : 'text-red-500'}`}>
                {isPositiveChange ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                <span className="ml-1">{Math.abs(stockDetails.current_quote.change_percent).toFixed(2)}%</span>
              </div>
              {/* Watchlist toggle */}
              {isLoggedIn && (
                <button
                  onClick={toggleWatchlist}
                  disabled={wlLoading}
                  className={`mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    inWatchlist
                      ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                      : 'border-white/10 text-zinc-500 hover:border-white/25 hover:text-white'
                  } disabled:opacity-40`}
                >
                  <Star size={12} fill={inWatchlist ? 'currentColor' : 'none'} />
                  {inWatchlist ? 'Watchlisted' : 'Add to Watchlist'}
                </button>
              )}
            </div>
        </div>
      </div>

      {/* Error Messages */}
      {renderError(errors.prediction, 'prediction')}
      {renderError(errors.risk, 'risk')}

      {/* Analysis Cards Grid - always show both slots */}
      <div className="grid md:grid-cols-2 gap-6">
        <SentimentAnalysisCard sentiment={stockDetails.sentiment} />
        <PricePredictionCard 
          prediction={stockDetails.price_prediction} 
          loading={loading.prediction}
          currency={stockDetails.profile.currency || 'USD'}
        />
      </div>

      {/* Price History Chart */}
      {stockDetails.historical_prices.length > 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4">Price History</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockDetails.historical_prices}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B', // zinc-900
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isPositiveChange ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Company Info */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Building className="mr-2" />
            Company Information
          </h2>
          <div className="space-y-3">
            <p><span className="text-zinc-500">Industry:</span> {stockDetails.profile.industry}</p>
            <p><span className="text-zinc-500">Sector:</span> {stockDetails.profile.sector}</p>
            <p><span className="text-zinc-500">Country:</span> {stockDetails.profile.country}</p>
            <p>
              <span className="text-zinc-500">Website:</span> 
              <a href={stockDetails.profile.website} target="_blank" rel="noopener noreferrer" 
                 className="ml-2 text-white font-medium hover:text-zinc-300 transition-colors">
                {stockDetails.profile.website}
              </a>
            </p>
          </div>
        </div>

        <StockSentimentDisplay stockDetails={stockDetails} />

        {/* Risk Analysis Section */}
        <RiskAnalysisSection 
          riskAnalysis={stockDetails.risk_analysis}
          loading={loading.risk}
          error={errors.risk}
          currency={stockDetails.profile.currency || 'USD'}
        />
      </div>
    </div>
  );
};

export default StockAnalysis;
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import {
  TrendingUp, TrendingDown, BarChart2, AlertTriangle,
  Activity, Target, Info
} from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

/* ── helpers ─────────────────────────────────────────────── */
const fmtPct = (v, decimals = 2) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(decimals)}%`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── sub-components ──────────────────────────────────────── */
const ProbabilityBar = ({ pUp }) => {
  if (pUp == null) return null;
  const bullWidth = clamp(pUp, 0, 100);
  const bearWidth = 100 - bullWidth;
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>Bear {(100 - pUp).toFixed(0)}%</span>
        <span>Direction probability</span>
        <span>Bull {pUp.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden flex">
        <div style={{ width: `${bearWidth}%` }} className="bg-red-500/60 transition-all duration-700" />
        <div style={{ width: `${bullWidth}%` }} className="bg-green-500/60 transition-all duration-700" />
      </div>
    </div>
  );
};

const ConfidenceBar = ({ value }) => {
  if (value == null) return null;
  const color =
    value >= 55 ? 'bg-green-500' : value >= 35 ? 'bg-yellow-400' : 'bg-red-500';
  const textColor =
    value >= 55 ? 'text-green-400' : value >= 35 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">Model confidence</span>
        <span className={textColor}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${clamp(value, 0, 100)}%` }}
        />
      </div>
    </div>
  );
};

const SignalBadge = ({ signal }) => {
  if (!signal?.label) return null;
  const map = {
    'Strong Buy':       'bg-green-500/15 text-green-400 border-green-500/30',
    'Buy':              'bg-green-500/10 text-green-300 border-green-500/20',
    'Strong Sell':      'bg-red-500/15   text-red-400   border-red-500/30',
    'Sell':             'bg-red-500/10   text-red-300   border-red-500/20',
    'Hold':             'bg-zinc-700/50  text-zinc-300  border-white/10',
    'Model Unreliable': 'bg-zinc-800     text-zinc-500  border-white/5',
  };
  const cls = map[signal.label] ?? 'bg-zinc-800 text-zinc-400 border-white/5';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-xs text-zinc-500">Combined Signal (LSTM + Sentiment)</div>
      <span className={`px-5 py-1.5 rounded-full text-sm font-bold tracking-wide border ${cls}`}>
        {signal.label}
      </span>
      {signal.rationale && (
        <p className="text-xs text-zinc-500 text-center leading-snug max-w-xs mt-0.5">
          {signal.rationale}
        </p>
      )}
    </div>
  );
};

const RegimePill = ({ regime }) => {
  if (!regime) return null;
  const map = {
    Trending:  'bg-green-500/10 text-green-400',
    Recovery:  'bg-yellow-500/10 text-yellow-400',
    Volatile:  'bg-red-500/10 text-red-400',
    Sideways:  'bg-zinc-700 text-zinc-300',
  };
  const cls = map[regime] ?? 'bg-zinc-800 text-zinc-400';
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cls}`}>
      {regime}
    </span>
  );
};

/* ── Skeleton (loading) ──────────────────────────────────── */
const PredictionSkeleton = () => (
  <Card className="bg-zinc-900 border border-white/10">
    <CardHeader>
      <CardTitle className="flex items-center text-xl">
        <BarChart2 className="mr-2" />Price Prediction
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-3/4 mx-auto" />
        <div className="h-8 bg-zinc-700 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-zinc-700 rounded w-2/3 mx-auto" />
        <p className="text-zinc-500 text-sm pt-2">Training model on historical data…</p>
      </div>
    </CardContent>
  </Card>
);

/* ── Unavailable card ─────────────────────────────────────── */
const PredictionUnavailable = ({ message }) => (
  <Card className="bg-zinc-900 border border-white/10">
    <CardHeader>
      <CardTitle className="flex items-center text-xl">
        <BarChart2 className="mr-2" />Price Prediction
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center p-4">
        <AlertTriangle className="mx-auto mb-2 text-zinc-500" size={24} />
        <div className="text-zinc-400 font-medium mb-1">Prediction Unavailable</div>
        <div className="text-zinc-600 text-sm">
          {message || 'Model training failed or insufficient data.'}
        </div>
      </div>
    </CardContent>
  </Card>
);

/* ── Main card ────────────────────────────────────────────── */
const PricePredictionCard = ({ prediction, loading, currency = 'USD' }) => {
  if (loading) return <PredictionSkeleton />;
  if (!prediction || prediction.error)
    return <PredictionUnavailable message={prediction?.error} />;

  const fmt = (v) => formatCurrency(v, currency);
  const currSym = getCurrencySymbol(currency);

  const isBullish  = prediction.prediction_direction === 'Bullish';
  const trendColor = isBullish ? 'text-green-500' : 'text-red-500';
  const TrendIcon  = isBullish ? TrendingUp : TrendingDown;
  const [ciLo, ciHi] = prediction.confidence_interval ?? [null, null];

  return (
    <Card className="bg-zinc-900 border border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-xl">
            <BarChart2 className="mr-2" />Price Prediction
          </CardTitle>
          <div className="flex items-center gap-2">
            <RegimePill regime={prediction.regime} />
            {prediction.val_auc != null && (
              <span className="text-xs text-zinc-500" title="Out-of-sample AUC-ROC">
                AUC {prediction.val_auc.toFixed(3)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-5">

          {/* Predicted price */}
          <div className="text-center">
            <div className="text-xs text-zinc-500 mb-1">Predicted 5-Day Outlook</div>
            <div className={`text-3xl font-bold ${trendColor} flex items-center justify-center`}>
              <TrendIcon className="mr-2" size={24} />
              {fmt(prediction.predicted_price)}
            </div>
            {ciLo != null && (
              <div className="text-xs text-zinc-500 mt-1">
                80% range: {fmt(ciLo)} — {fmt(ciHi)}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Today's Close</div>
              <div className="font-semibold text-white text-sm">
                {fmt(prediction.last_close_price)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Change ({currSym.trim()})</div>
              <div className={`font-semibold text-sm ${trendColor}`}>
                {prediction.price_change >= 0 ? '+' : ''}{Number(prediction.price_change).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Exp. Return</div>
              <div className={`font-semibold text-sm ${trendColor}`}>
                {fmtPct(prediction.expected_return_pct ?? prediction.price_change_percent)}
              </div>
            </div>
          </div>

          {/* Direction probability bar */}
          <ProbabilityBar pUp={prediction.direction_probability} />

          {/* Confidence */}
          <ConfidenceBar value={prediction.prediction_confidence} />

          {/* AUC quality note */}
          {prediction.val_auc != null && (
            <div className="flex items-start gap-2 bg-zinc-800/50 rounded-lg p-2.5 text-xs text-zinc-400">
              <Info size={12} className="mt-0.5 shrink-0 text-zinc-500" />
              <span>
                Walk-forward validation (5-fold time series) AUC:{' '}
                <span className={
                  prediction.val_auc >= 0.58 ? 'text-green-400' :
                  prediction.val_auc >= 0.54 ? 'text-yellow-400' : 'text-red-400'
                }>
                  {prediction.val_auc.toFixed(3)}
                </span>
                {prediction.val_auc >= 0.58 ? ' — strong signal.' :
                 prediction.val_auc >= 0.54 ? ' — moderate signal.' :
                                               ' — near-random, treat with caution.'}
              </span>
            </div>
          )}

          {/* Signal */}
          <SignalBadge signal={prediction.trading_signal} />

          {/* Direction fine print */}
          <div className="flex justify-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
              isBullish
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}>
              <TrendIcon className="mr-1" size={12} />
              {prediction.prediction_direction} · LSTM model
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default PricePredictionCard;
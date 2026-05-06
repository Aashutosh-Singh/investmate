import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, StarOff, Clock, TrendingUp, TrendingDown,
  User, LogOut, ChevronRight, RefreshCw, Trash2,
  BarChart2, BookOpen, Zap, AlertCircle,
} from "lucide-react";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Small reusable components ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center mb-3">
        <Icon size={22} className="text-zinc-600" />
      </div>
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

// ── Watchlist card ────────────────────────────────────────────────────────────
function WatchlistCard({ item, onRemove, onNavigate }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex items-center justify-between bg-zinc-900 border border-white/10 hover:border-white/25 rounded-xl px-4 py-3 transition-all cursor-pointer"
      onClick={() => onNavigate(item.symbol)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <BarChart2 size={16} className="text-zinc-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{item.symbol}</p>
          <p className="text-xs text-zinc-500 truncate">{item.name || "—"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.symbol); }}
          className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Remove from watchlist"
        >
          <Trash2 size={13} />
        </button>
        <ChevronRight size={15} className="text-zinc-600 group-hover:text-white transition-colors" />
      </div>
    </motion.div>
  );
}

// ── History card ──────────────────────────────────────────────────────────────
function HistoryCard({ item, onNavigate }) {
  const ts = item.timestamp ? new Date(item.timestamp) : null;
  const timeStr = ts
    ? ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center justify-between bg-zinc-900/60 border border-white/5 hover:border-white/20 rounded-xl px-4 py-3 transition-all cursor-pointer"
      onClick={() => onNavigate(item.symbol)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Clock size={14} className="text-zinc-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{item.symbol}</p>
          <p className="text-xs text-zinc-600 truncate">{item.name || "—"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-zinc-600">{timeStr}</span>
        <ChevronRight size={14} className="text-zinc-700 group-hover:text-white transition-colors" />
      </div>
    </motion.div>
  );
}

// ── KB indexed stocks (from chatbot) ─────────────────────────────────────────
function KbCard({ symbol, onNavigate }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onNavigate(symbol)}
      className="group flex items-center gap-2 bg-zinc-900 border border-white/10 hover:border-white/25 rounded-xl px-3 py-2 cursor-pointer transition-all"
    >
      <Zap size={12} className="text-yellow-400 flex-shrink-0" />
      <span className="text-sm text-zinc-300 group-hover:text-white truncate">{symbol}</span>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate  = useNavigate();
  const [profile,   setProfile]   = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [history,   setHistory]   = useState([]);
  const [kbStocks,  setKbStocks]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    setLoading(true);
    setError("");
    try {
      const [profRes, wlRes, histRes, kbRes] = await Promise.all([
        fetch(`${API}/user/profile`,  { headers: authHeaders() }),
        fetch(`${API}/user/watchlist`,{ headers: authHeaders() }),
        fetch(`${API}/user/history`,  { headers: authHeaders() }),
        fetch(`${API}/api/chatbot/available-stocks`),
      ]);

      if (profRes.status === 401) { navigate("/login"); return; }

      const [prof, wl, hist, kb] = await Promise.all([
        profRes.json(), wlRes.json(), histRes.json(), kbRes.json(),
      ]);

      setProfile(Array.isArray(prof) ? null : prof);
      setWatchlist(Array.isArray(wl) ? wl : []);
      setHistory(Array.isArray(hist) ? hist : []);
      setKbStocks((kb.symbols || []).slice(0, 12));
    } catch (e) {
      setError("Failed to load dashboard. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveWatchlist = async (symbol) => {
    try {
      await fetch(`${API}/user/watchlist/${symbol}`, {
        method:  "DELETE",
        headers: authHeaders(),
      });
      setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const goTo = (symbol) => navigate(`/stocks/${symbol}`);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const username     = profile?.username || "Investor";
  const joinedDate   = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white text-zinc-900 flex items-center justify-center font-bold text-lg">
              {username[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none mb-0.5">
                Welcome back, {username}
              </h1>
              <p className="text-xs text-zinc-500">Member since {joinedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 text-sm transition-all"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* ── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Star}
            label="Watchlist"
            value={watchlist.length}
            sub="stocks tracked"
            color="text-yellow-400"
          />
          <StatCard
            icon={Clock}
            label="Recently Viewed"
            value={history.length}
            sub="stocks analysed"
            color="text-blue-400"
          />
          <StatCard
            icon={BookOpen}
            label="KB Indexed"
            value={kbStocks.length}
            sub="AI-ready stocks"
            color="text-green-400"
          />
          <StatCard
            icon={User}
            label="Account"
            value="Active"
            sub={`@${username}`}
            color="text-white"
          />
        </div>

        {/* ── Main grid ───────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Watchlist */}
          <div>
            <SectionHeader
              title="⭐ Watchlist"
              subtitle="Stocks you're tracking — click to view analysis"
            />
            {watchlist.length === 0 ? (
              <EmptyState
                icon={StarOff}
                message="Your watchlist is empty. Open any stock analysis page and click ☆ to add it."
              />
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {watchlist.map(item => (
                    <WatchlistCard
                      key={item.symbol}
                      item={item}
                      onRemove={handleRemoveWatchlist}
                      onNavigate={goTo}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Recent history */}
          <div>
            <SectionHeader
              title="🕐 Recent Analyses"
              subtitle="Last 20 stocks you viewed while logged in"
            />
            {history.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                message="No recent activity. Visit a stock page while logged in to see it here."
              />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {history.map((item, i) => (
                  <HistoryCard key={`${item.symbol}-${i}`} item={item} onNavigate={goTo} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── AI-ready stocks ─────────────────────────────────────────── */}
        {kbStocks.length > 0 && (
          <div>
            <SectionHeader
              title="⚡ AI-Ready Stocks"
              subtitle="These stocks have been analysed and indexed — the chatbot can answer deep questions about them"
            />
            <div className="flex flex-wrap gap-2">
              {kbStocks.map(sym => (
                <KbCard key={sym} symbol={sym} onNavigate={goTo} />
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/"
            className="group flex items-center justify-between bg-zinc-900 border border-white/10 hover:border-white/25 rounded-2xl px-5 py-4 transition-all"
          >
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">Search Stocks</p>
              <p className="text-xs text-zinc-500">Find and analyse any stock</p>
            </div>
            <TrendingUp size={18} className="text-zinc-500 group-hover:text-white transition-colors" />
          </Link>

          <Link
            to="/"
            className="group flex items-center justify-between bg-zinc-900 border border-white/10 hover:border-white/25 rounded-2xl px-5 py-4 transition-all"
          >
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">Market Overview</p>
              <p className="text-xs text-zinc-500">Nifty 50 & Sensex live</p>
            </div>
            <BarChart2 size={18} className="text-zinc-500 group-hover:text-white transition-colors" />
          </Link>

          <div
            className="group flex items-center justify-between bg-zinc-900 border border-white/10 hover:border-white/25 rounded-2xl px-5 py-4 transition-all cursor-pointer"
            onClick={() => {
              // Open chatbot (triggers the floating button's click)
              document.getElementById("chat-launcher-btn")?.click();
            }}
          >
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">Ask InvestMate AI</p>
              <p className="text-xs text-zinc-500">Chat about any stock analysis</p>
            </div>
            <BookOpen size={18} className="text-zinc-500 group-hover:text-white transition-colors" />
          </div>
        </div>

      </div>
    </div>
  );
}

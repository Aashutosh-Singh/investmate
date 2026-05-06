/**
 * ChatWidget.js
 * -------------
 * Floating RAG chatbot widget for InvestMate.
 *
 * UX design:
 *  - Launcher button fixed bottom-right (hidden while panel is open)
 *  - Panel slides up from bottom-right with spring animation
 *  - Distinct bubbles: user = right/white, assistant = left/zinc
 *  - Animated 3-dot typing indicator while fetching
 *  - Empty-state prompt suggestions — stock-specific when on /stocks/:symbol
 *  - KB is automatically built from analysis results; no manual upload needed
 *  - Error state with inline message
 *  - Input disabled while loading; Enter to send, Shift+Enter for newline
 *  - Fully responsive: panel adapts on mobile (full-width, bottom-anchored)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  AlertCircle,
  BookOpen,
  Sparkles,
  Database,
} from "lucide-react";
import { useLocation } from "react-router-dom";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm InvestMate AI 📊\nAsk me anything about this stock's prediction, sentiment, risk, or any general finance question.",
};

const GENERIC_SUGGESTIONS = [
  "What is a stop-loss order?",
  "How does dollar-cost averaging work?",
  "What are the key risk metrics for stocks?",
  "Explain price-to-earnings ratio",
];

const buildStockSuggestions = (symbol) => [
  `Why is the trading signal what it is for ${symbol}?`,
  `What is the current volatility and risk level of ${symbol}?`,
  `Explain the sentiment analysis for ${symbol}`,
  `What does the market regime mean for ${symbol}?`,
];

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-zinc-800 border border-white/10">
        <Bot size={14} className="text-zinc-300" />
      </div>
      <div className="px-4 py-3 bg-zinc-800 border border-white/5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
          isUser
            ? "bg-white text-zinc-900"
            : "bg-zinc-800 text-zinc-300 border border-white/10"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div
        className={`max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-white text-zinc-900 rounded-2xl rounded-br-sm"
            : "bg-zinc-800 text-zinc-100 border border-white/5 rounded-2xl rounded-bl-sm"
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
  );
}

// ── Empty / welcome state ─────────────────────────────────────────────────────
function EmptyState({ onSuggest, suggestions, symbol }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center">
        {symbol ? (
          <Database size={26} className="text-zinc-300" />
        ) : (
          <Sparkles size={28} className="text-zinc-300" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">
          {symbol ? `Analysing ${symbol}` : "InvestMate AI"}
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {symbol
            ? `Ask me about the prediction, signal rationale, sentiment, volatility, or risk for ${symbol}.`
            : "Ask questions grounded in our stock analysis data or general finance concepts."}
          <br />
          <span className="text-zinc-600">Not connected to live market data.</span>
        </p>
      </div>
      <div className="w-full space-y-2 mt-1">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left text-xs text-zinc-400 px-3 py-2 rounded-xl bg-zinc-800/60 border border-white/5 hover:border-white/20 hover:text-zinc-200 transition-all duration-200"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const location = useLocation();

  // Derive the current stock symbol from the URL (if on a stock page)
  const contextSymbol = useMemo(() => {
    const match = location.pathname.match(/^\/stocks\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  const suggestions = useMemo(
    () => (contextSymbol ? buildStockSuggestions(contextSymbol) : GENERIC_SUGGESTIONS),
    [contextSymbol]
  );

  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg]   = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Reset conversation when navigating to a different stock
  useEffect(() => {
    setMessages([]);
    setErrorMsg(null);
  }, [contextSymbol]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (queryOverride) => {
      const query = (queryOverride ?? input).trim();
      if (!query || isLoading) return;

      const userMsg = { id: Date.now(), role: "user", text: query };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`${API_BASE}/api/chatbot/chat`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            query,
            context_symbol: contextSymbol || null,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || `Server error (${res.status})`);
        }

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", text: data.answer },
        ]);
      } catch (err) {
        setErrorMsg(err.message || "Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, contextSymbol]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showEmptyState = messages.length === 0 && !isLoading;

  // Subtitle text in the header
  const headerSubtitle = contextSymbol
    ? `Analysing ${contextSymbol} · ask me anything`
    : "Knowledge-base · not live market data";

  return (
    <>
      {/* ── Launcher button ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            id="chat-launcher-btn"
            key="launcher"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsOpen(true)}
            title="Open InvestMate AI"
            style={{ zIndex: 9999 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-white text-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center justify-center"
          >
            <MessageCircle size={24} strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chat-panel"
            key="panel"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            style={{ zIndex: 9999 }}
            className="
              fixed bottom-0 right-0
              sm:bottom-6 sm:right-6 sm:w-[400px] sm:max-h-[600px] sm:rounded-2xl
              w-full max-h-[100dvh]
              flex flex-col
              bg-zinc-900 border border-white/10
              shadow-[0_24px_60px_rgba(0,0,0,0.7)]
              overflow-hidden
            "
          >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <BookOpen size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none mb-0.5">
                    InvestMate AI
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-none">
                    {headerSubtitle}
                  </p>
                </div>
              </div>
              <button
                id="chat-close-btn"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={17} />
              </button>
            </div>

            {/* ── Message area ────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ minHeight: 0 }}
            >
              {showEmptyState ? (
                <EmptyState
                  onSuggest={(s) => sendMessage(s)}
                  suggestions={suggestions}
                  symbol={contextSymbol}
                />
              ) : (
                <>
                  {/* Welcome blurb */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-end gap-2"
                  >
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-zinc-800 border border-white/10">
                      <Bot size={14} className="text-zinc-300" />
                    </div>
                    <div className="max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed bg-zinc-800 text-zinc-100 border border-white/5 rounded-2xl rounded-bl-sm whitespace-pre-wrap">
                      {contextSymbol
                        ? `Hi! I have the full analysis for ${contextSymbol} ready. Ask me about the prediction, why the signal is what it is, the sentiment breakdown, volatility, risk, or anything else.`
                        : WELCOME_MESSAGE.text}
                    </div>
                  </motion.div>

                  {/* Conversation */}
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}

                  {/* Typing indicator */}
                  {isLoading && <TypingIndicator />}

                  {/* Error */}
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed"
                    >
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input bar ───────────────────────────────────────────── */}
            <div className="px-4 py-3 border-t border-white/10 bg-zinc-950 flex-shrink-0">
              <div className="flex items-end gap-2 bg-zinc-800 rounded-xl px-3 py-2 border border-white/5 focus-within:border-white/20 transition-colors">
                <textarea
                  ref={inputRef}
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={
                    contextSymbol
                      ? `Ask about ${contextSymbol}…`
                      : "Ask about stocks, investing…"
                  }
                  rows={1}
                  className="
                    flex-1 bg-transparent text-white text-sm
                    placeholder-zinc-500 resize-none outline-none
                    leading-5 max-h-28 overflow-y-auto
                    disabled:opacity-40
                  "
                  style={{ minHeight: "20px" }}
                />
                <motion.button
                  id="chat-send-btn"
                  whileHover={!isLoading && input.trim() ? { scale: 1.1 } : {}}
                  whileTap={!isLoading && input.trim() ? { scale: 0.9 } : {}}
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="
                    w-8 h-8 rounded-lg flex-shrink-0
                    flex items-center justify-center
                    bg-white text-zinc-900
                    disabled:opacity-25 disabled:cursor-not-allowed
                    transition-opacity
                  "
                >
                  <Send size={14} />
                </motion.button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2 text-center">
                Enter to send · Shift+Enter for newline
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

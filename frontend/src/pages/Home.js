import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';


const Home = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [_searchLoading, setLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const [searchPerformed, setSearchPerformed] = useState(false);
  const [marketData, setMarketData] = useState({
    nifty50: { historical: [], current: {} },
    sensex: { historical: [], current: {} },
    topStocks: []
  });


  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${API}/api/market/market-overview`);
        if (!response.ok) {
          throw new Error('Market data fetch failed');
        }
        const data = await response.json();
        // Use backend topStocks if available, else keep initial
        setMarketData(prevData => ({
          ...data,
          topStocks: data.topStocks && data.topStocks.length > 0 ? data.topStocks : prevData.topStocks
        }));
      } catch (error) {
        console.error("Error fetching market data:", error);
        toast.error("Unable to fetch market data");
      }
    };

    fetchMarketData();
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    if (!e.target.value.trim()) {
      setSearchPerformed(false);
      setSearchResults([]);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setSearchResults([]);
      setSearchPerformed(false);
      toast.error("Please enter a stock name or symbol");
      return;
    }
    setLoading(true);
    setSearchPerformed(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/stocks/search?name=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        // Attempt to parse JSON error first, fallback to text
        let errorMsg = 'Stock search failed';
        try {
          const errData = await response.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (e) {
          errorMsg = `Server error: ${response.status}`;
        }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length === 0) {
        toast("No stocks found matching your search");
        setSearchResults([]);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        setSearchResults([]);
      }
      
    } catch (error) {
      console.error("Error fetching search results:", error);
      toast.error(error.message || "Unable to fetch stock results. Please try again.");
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-800/80 backdrop-blur-lg p-4 rounded-xl shadow-2xl border border-gray-700"
        >
          <p className="text-gray-300 mb-1">{label}</p>
          <p className="text-green-500 font-bold text-lg">{formatCurrency(payload[0].value, 'INR')}</p>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <div className="bg-black text-white min-h-screen overflow-hidden">
      <Toaster 
        position="top-right"
        toastOptions={{
          success: { duration: 3000 },
          error: { duration: 5000 }
        }} 
      />
      <AnimatePresence>
        {!showContent && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                repeat: Infinity
              }}
            >
              <TrendingUp size={80} className="text-white" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container mx-auto px-4 py-8"
          >
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="max-w-2xl mx-auto bg-zinc-900 border border-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl mb-8"
            >
              <h1 className="text-5xl font-bold mb-8 text-center text-white">
                InvestMate
              </h1>
              
              <form onSubmit={handleSearch} className="mb-8">
                <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  placeholder="Search stocks by name or symbol..."
                  className="w-full p-4 pl-12 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white transition-all"
                />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Search />
                  </motion.button>
                </div>
              </form>
            </motion.div>
            {searchPerformed && searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-12 max-w-4xl mx-auto"
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-xl font-semibold text-white">Search Results</h2>
                  <span className="text-sm text-zinc-500">{searchResults.length} matches found</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map((stock) => (
                    <motion.div
                      key={stock.symbol}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(`/stocks/${stock.symbol}`)}
                      className="group flex items-center justify-between bg-zinc-900 border border-white/10 hover:border-white/30 backdrop-blur-lg rounded-xl p-4 cursor-pointer transition-all duration-300"
                    >
                      <div className="flex flex-col overflow-hidden pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                            {stock.symbol}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5">
                            {stock.exchange}
                          </span>
                        </div>
                        <span className="text-sm text-zinc-500 truncate" title={stock.name}>
                          {stock.name}
                        </span>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-all text-zinc-600">
                        →
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Nifty 50 Chart */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-zinc-900 border border-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Nifty 50</h2>
                  <div className={`flex items-center ${marketData.nifty50.current.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.nifty50.current.changePercent >= 0 ? <ArrowUp className="mr-2" /> : <ArrowDown className="mr-2" />}
                    {Math.abs(marketData.nifty50.current.changePercent || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marketData.nifty50.historical}>
                      <defs>
                        <linearGradient id="niftyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.5} />
                      <XAxis dataKey="Date" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#ffffff" 
                        fillOpacity={1} 
                        fill="url(#niftyGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
              {/* Sensex Chart */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-zinc-900 border border-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Sensex</h2>
                  <div className={`flex items-center ${marketData.sensex.current.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.sensex.current.changePercent >= 0 ? <ArrowUp className="mr-2" /> : <ArrowDown className="mr-2" />}
                    {Math.abs(marketData.sensex.current.changePercent || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marketData.sensex.historical}>
                      <defs>
                        <linearGradient id="sensexGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.5} />
                      <XAxis dataKey="Date" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#ffffff" 
                        fillOpacity={1} 
                        fill="url(#sensexGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
            {/* Top Stocks Section */}
            <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
        className="bg-zinc-900 border border-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-6">Top Performing Stocks</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {marketData.topStocks.map((stock, index) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 + index * 0.1 }}
              className="bg-zinc-800 border border-white/5 rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-700 transition-colors"
              onClick={() => navigate(`/stocks/${stock.symbol}`)}
            >
              <div className="font-bold text-lg mb-2">{stock.symbol}</div>
              <div className="text-xl mb-2">{formatCurrency(stock.price, stock.currency || 'INR')}</div>
              <div className={`flex items-center justify-center ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change >= 0 ? <ArrowUp className="mr-1" /> : <ArrowDown className="mr-1" />}
                {Math.abs(stock.change).toFixed(2)}%
              </div>
            </motion.div>
          ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
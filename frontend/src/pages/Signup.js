import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Eye, EyeOff, CheckCircle } from "lucide-react";

const Signup = () => {
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    if (!username.trim()) return "Username is required.";
    if (username.length < 3) return "Username must be at least 3 characters.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError("");
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL || "http://127.0.0.1:5000"}/auth/signup`,
        { username, password }
      );
      navigate("/login", { state: { message: "Account created! Please sign in." } });
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-yellow-400", "bg-green-500"][strength];

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
            <TrendingUp size={20} className="text-zinc-900" />
          </div>
          <span className="text-xl font-bold text-white">InvestMate</span>
        </div>

        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
          <p className="text-sm text-zinc-500 mb-6">Start tracking stocks with AI insights</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Username</label>
              <input
                type="text"
                id="signup-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  id="signup-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min. 6 chars)"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-zinc-800 border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${(strength / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500">{strengthLabel}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  id="signup-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-zinc-800 border border-white/5 text-white placeholder-zinc-600 focus:outline-none focus:border-white/30 transition-colors text-sm"
                />
                {confirm && confirm === password && (
                  <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
                )}
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-xs px-1"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              id="signup-submit"
              className="w-full py-3 rounded-xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Create Account"}
            </motion.button>
          </form>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-zinc-300 hover:text-white transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;

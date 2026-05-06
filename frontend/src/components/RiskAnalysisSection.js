import React from 'react';
import { Shield, TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

// Inline Card and CardHeader components
const Card = ({ children, className }) => (
  <div className={`rounded-xl shadow-lg ${className}`}>{children}</div>
);

const CardHeader = ({ children, className }) => (
  <div className={`p-4 border-b border-gray-700 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className }) => (
  <h2 className={`text-xl font-bold text-white ${className}`}>{children}</h2>
);

const CardContent = ({ children, className }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const RiskMetricCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-zinc-800 rounded-lg p-4 flex items-center justify-between border border-white/5">
    <div>
      <p className="text-zinc-400 text-sm">{title}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
    <Icon className={`h-8 w-8 ${colorClass}`} />
  </div>
);

const RiskAnalysisSection = ({ riskAnalysis, currency = 'USD' }) => {
  if (!riskAnalysis) return null;

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-zinc-400';
    }
  };

  const getTrendIcon = (trend) => 
    trend?.toLowerCase() === 'bullish' ? TrendingUp : TrendingDown;

  // Transform the flat riskAnalysis structure into the expected metrics structure
  const transformedMetrics = {
    risk_level: riskAnalysis.risk_level,
    metrics: {
      volatility: riskAnalysis.volatility,
      daily_return: riskAnalysis.daily_return,
      trend: riskAnalysis.trend
    },
    latest_data: {
      close: parseFloat(riskAnalysis.latest_close)
    }
  };

  const metrics = [
    {
      title: 'Risk Level',
      value: transformedMetrics.risk_level || 'N/A',
      icon: Shield,
      colorClass: getRiskColor(transformedMetrics.risk_level)
    },
    {
      title: 'Volatility',
      value: transformedMetrics.metrics.volatility || 'N/A',
      icon: Activity,
      colorClass: 'text-white'
    },
    {
      title: 'Daily Return',
      value: transformedMetrics.metrics.daily_return || 'N/A',
      icon: DollarSign,
      colorClass: parseFloat(transformedMetrics.metrics.daily_return) >= 0 ? 'text-green-500' : 'text-red-500'
    },
    {
      title: 'Market Trend',
      value: transformedMetrics.metrics.trend || 'N/A',
      icon: getTrendIcon(transformedMetrics.metrics.trend),
      colorClass: transformedMetrics.metrics.trend?.toLowerCase() === 'bullish' ? 'text-green-500' : 'text-red-500'
    }
  ];

  return (
    <Card className="bg-zinc-900 border border-white/10">
      <CardHeader>
        <CardTitle>Risk Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <RiskMetricCard key={index} {...metric} />
          ))}
        </div>

        {transformedMetrics.latest_data?.close && (
          <div className="mt-6">
            <div className="bg-zinc-800 border border-white/5 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Latest Trading Data</h3>
              <p className="text-zinc-400">
                Closing Price: <span className="text-white font-bold">
                  {formatCurrency(transformedMetrics.latest_data.close, currency)}
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskAnalysisSection;
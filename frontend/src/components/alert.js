import React from 'react';
import { AlertOctagon, Info, CheckCircle, AlertTriangle } from 'lucide-react';

const Alert = ({ variant = 'info', children, className = '' }) => {
  const getAlertStyles = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'success':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-white/5 text-white border-white/10';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertOctagon className="w-5 h-5 mr-2" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 mr-2" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 mr-2" />;
      default:
        return <Info className="w-5 h-5 mr-2" />;
    }
  };

  return (
    <div
      className={`flex items-center p-4 border-l-4 rounded-md ${getAlertStyles()} ${className}`}
    >
      {getIcon()}
      <div>{children}</div>
    </div>
  );
};

const AlertDescription = ({ children }) => {
    return <p className="text-sm leading-relaxed">{children}</p>;
};
export { Alert, AlertDescription };
  
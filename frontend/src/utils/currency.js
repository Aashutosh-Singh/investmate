/**
 * currency.js
 * -----------
 * Shared currency formatting utilities for InvestMate.
 *
 * Usage:
 *   import { formatCurrency, getCurrencySymbol } from '../utils/currency';
 *   formatCurrency(2427.30, 'INR')  →  "₹2,427.30"
 *   formatCurrency(182.45,  'USD')  →  "$182.45"
 *   getCurrencySymbol('GBP')        →  "£"
 */

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  HKD: 'HK$',
  SGD: 'S$',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF ',
};

// Locale map: some currencies look better with their native locale
const CURRENCY_LOCALE = {
  INR: 'en-IN',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
};

/**
 * Format a number as a currency string using Intl.NumberFormat.
 * Falls back gracefully if the currency code is unrecognised.
 *
 * @param {number|null} value   - The numeric value to format
 * @param {string}      currency - ISO 4217 code e.g. 'INR', 'USD'
 * @param {number}      decimals - Fraction digits (default 2)
 * @returns {string}
 */
export function formatCurrency(value, currency = 'USD', decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  const code   = (currency || 'USD').toUpperCase();
  const locale = CURRENCY_LOCALE[code] || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style:                 'currency',
      currency:              code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Fallback: prepend symbol manually
    const sym = CURRENCY_SYMBOLS[code] || code + ' ';
    return `${sym}${Number(value).toFixed(decimals)}`;
  }
}

/**
 * Get just the currency symbol (₹, $, £, etc.) for a given ISO code.
 * @param {string} currency - ISO 4217 code
 * @returns {string}
 */
export function getCurrencySymbol(currency = 'USD') {
  return CURRENCY_SYMBOLS[(currency || 'USD').toUpperCase()] || (currency + ' ');
}

/**
 * Format a currency change with a leading + or - sign.
 * @param {number|null} value
 * @param {string}      currency
 * @returns {string}
 */
export function formatCurrencyChange(value, currency = 'USD') {
  if (value == null || isNaN(value)) return '—';
  const prefix = value >= 0 ? '+' : '';
  return prefix + formatCurrency(value, currency);
}

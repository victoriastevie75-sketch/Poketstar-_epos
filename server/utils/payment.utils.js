/**
 * Payment Utilities
 * Helper functions for payment processing
 */

const crypto = require('crypto');

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 * @param {string} phone - Phone number in any format
 * @returns {string} Formatted phone number
 */
function formatPhoneForMpesa(phone) {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  // If doesn't start with 254, prepend it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
}

/**
 * Validate M-Pesa phone number
 * @param {string} phone - Phone number
 * @returns {boolean} Valid or not
 */
function isValidMpesaPhone(phone) {
  const formatted = formatPhoneForMpesa(phone);
  return /^254\d{9}$/.test(formatted);
}

/**
 * Generate a unique transaction reference
 * @param {string} prefix - Prefix for reference (e.g., 'ORD', 'TXN')
 * @returns {string} Unique reference
 */
function generateTransactionRef(prefix = 'TXN') {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculate payment amount with fees
 * @param {number} amount - Base amount
 * @param {number} feePercentage - Fee percentage (e.g., 1.5 for 1.5%)
 * @returns {object} { baseAmount, fee, totalAmount }
 */
function calculateWithFees(amount, feePercentage = 0) {
  const fee = (amount * feePercentage) / 100;
  const totalAmount = amount + fee;
  return {
    baseAmount: amount,
    fee: Math.round(fee * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Validate payment amount
 * @param {number} amount - Amount to validate
 * @param {number} min - Minimum amount (optional)
 * @param {number} max - Maximum amount (optional)
 * @returns {object} { valid, error }
 */
function validatePaymentAmount(amount, min = 1, max = 1000000) {
  if (!amount || isNaN(amount)) {
    return { valid: false, error: 'Invalid amount' };
  }
  if (amount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }
  if (amount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` };
  }
  return { valid: true };
}

/**
 * Format currency for display
 * @param {number} amount - Amount in KES
 * @param {string} currency - Currency code (default: KES)
 * @returns {string} Formatted string
 */
function formatCurrency(amount, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Create payment status object
 * @param {string} method - Payment method (MPESA, STRIPE, CASH)
 * @param {string} status - Status (PENDING, SUCCESS, FAILED, REFUNDED)
 * @param {object} details - Additional details
 * @returns {object} Payment status object
 */
function createPaymentStatus(method, status = 'PENDING', details = {}) {
  return {
    method: method.toUpperCase(),
    status: status.toUpperCase(),
    timestamp: new Date().toISOString(),
    ...details,
  };
}

/**
 * Encrypt sensitive payment data
 * @param {string} data - Data to encrypt
 * @param {string} key - Encryption key (optional, uses default)
 * @returns {string} Encrypted data
 */
function encryptPaymentData(data, key = process.env.ENCRYPTION_KEY || 'default-key') {
  try {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
}

/**
 * Decrypt sensitive payment data
 * @param {string} encrypted - Encrypted data
 * @param {string} key - Decryption key
 * @returns {object} Decrypted data
 */
function decryptPaymentData(encrypted, key = process.env.ENCRYPTION_KEY || 'default-key') {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

module.exports = {
  formatPhoneForMpesa,
  isValidMpesaPhone,
  generateTransactionRef,
  calculateWithFees,
  validatePaymentAmount,
  formatCurrency,
  createPaymentStatus,
  encryptPaymentData,
  decryptPaymentData,
};

/**
 * Payment Configuration
 * Centralized config for payment integrations (M-Pesa, Stripe, PayPal)
 * Update with your own API keys in production
 */

module.exports = {
  // M-Pesa Configuration (Safaricom)
  mpesa: {
    // Use sandbox for testing
    sandbox: true,
    endpoint: 'https://sandbox.safaricom.co.ke/mpesa',
    productionEndpoint: 'https://api.safaricom.co.ke/mpesa',
    
    // Get these from Daraja API registration
    businessShortCode: process.env.MPESA_SHORT_CODE || '174379',
    consumerKey: process.env.MPESA_CONSUMER_KEY || 'YOUR_CONSUMER_KEY',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'YOUR_CONSUMER_SECRET',
    passkey: process.env.MPESA_PASSKEY || 'YOUR_PASSKEY',
    
    // Callback URLs for payment notifications
    callbackURL: process.env.MPESA_CALLBACK_URL || 'http://localhost:4000/api/payments/mpesa/callback',
    confirmationURL: process.env.MPESA_CONFIRMATION_URL || 'http://localhost:4000/api/payments/mpesa/confirmation',
    
    // Validation and timeout
    timeout: 60, // seconds
  },

  // Stripe Configuration
  stripe: {
    // Get from https://dashboard.stripe.com/apikeys
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_KEY',
    
    // Currency
    currency: 'kes', // Kenyan Shilling
  },

  // PayPal Configuration (optional)
  paypal: {
    mode: 'sandbox', // or 'live'
    clientId: process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    returnUrl: process.env.PAYPAL_RETURN_URL || 'http://localhost:4000/payment/success',
    cancelUrl: process.env.PAYPAL_CANCEL_URL || 'http://localhost:4000/payment/cancel',
  },

  // Payment timeout and retry settings
  timeout: 60000, // ms
  maxRetries: 3,
  retryDelay: 2000, // ms
};

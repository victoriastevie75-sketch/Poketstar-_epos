/**
 * Stripe Payment Service
 * Handles card payments via Stripe
 */

const config = require('../config/payments.config');

class StripeService {
  constructor() {
    this.config = config.stripe;
    // Initialize Stripe library when available
    try {
      this.stripe = require('stripe')(this.config.secretKey);
    } catch (e) {
      console.warn('Stripe SDK not installed. Install with: npm install stripe');
    }
  }

  /**
   * Create a payment intent for card payments
   * @param {number} amount - Amount in KES (cents)
   * @param {string} description - Payment description
   * @param {object} metadata - Additional metadata
   */
  async createPaymentIntent(amount, description, metadata = {}) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe SDK not initialized');
      }

      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: this.config.currency,
        description,
        metadata,
      });

      return {
        success: true,
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        amount: intent.amount,
        status: intent.status,
      };
    } catch (error) {
      console.error('Stripe Payment Intent Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Confirm payment intent
   * @param {string} paymentIntentId - Payment intent ID
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe SDK not initialized');
      }

      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: intent.status === 'succeeded',
        status: intent.status,
        paymentIntentId: intent.id,
        amount: intent.amount,
        chargeId: intent.charges.data[0]?.id,
      };
    } catch (error) {
      console.error('Stripe Confirm Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Refund a payment
   * @param {string} chargeId - Charge ID to refund
   * @param {number} amount - Amount to refund (optional, full refund if not specified)
   */
  async refundPayment(chargeId, amount = null) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe SDK not initialized');
      }

      const refund = await this.stripe.refunds.create({
        charge: chargeId,
        ...(amount && { amount: Math.round(amount * 100) }),
      });

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
      };
    } catch (error) {
      console.error('Stripe Refund Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new StripeService();

/**
 * Payment Routes
 * API endpoints for payment processing (M-Pesa, Stripe, etc.)
 */

const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesa.service');
const stripeService = require('../services/stripe.service');
const paymentUtils = require('../utils/payment.utils');

/**
 * M-Pesa Routes
 */

/**
 * POST /api/payments/mpesa/initiate
 * Initiate M-Pesa STK Push (prompt user for PIN)
 * Body: { phoneNumber, amount, accountRef, description }
 */
router.post('/mpesa/initiate', async (req, res) => {
  try {
    const { phoneNumber, amount, accountRef, description } = req.body;

    if (!phoneNumber || !amount || !accountRef) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await mpesaService.initiateSTKPush(
      phoneNumber,
      amount,
      accountRef,
      description || 'POS Sale'
    );

    if (result.success) {
      res.json({
        success: true,
        checkoutRequestId: result.checkoutRequestId,
        message: result.customerMessage,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('M-Pesa initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate M-Pesa payment' });
  }
});

/**
 * POST /api/payments/mpesa/query
 * Query M-Pesa transaction status
 * Body: { checkoutRequestId }
 */
router.post('/mpesa/query', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ error: 'checkoutRequestId required' });
    }

    const result = await mpesaService.querySTKPushStatus(checkoutRequestId);
    res.json(result);
  } catch (error) {
    console.error('M-Pesa query error:', error);
    res.status(500).json({ error: 'Failed to query M-Pesa status' });
  }
});

/**
 * POST /api/payments/mpesa/callback
 * Receive M-Pesa callback notification
 */
router.post('/mpesa/callback', (req, res) => {
  try {
    const paymentData = mpesaService.processCallback(req.body);

    if (paymentData && paymentData.success) {
      // Update sale status in database
      console.log('M-Pesa payment successful:', paymentData);
      // TODO: Update payment record with confirmation data
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Rejected' });
  }
});

/**
 * Stripe Routes
 */

/**
 * POST /api/payments/stripe/create-intent
 * Create a Stripe payment intent
 * Body: { amount, description, metadata }
 */
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const { amount, description, metadata } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }

    const result = await stripeService.createPaymentIntent(
      amount,
      description || 'POS Sale',
      metadata
    );

    if (result.success) {
      res.json({
        success: true,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Stripe create-intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * POST /api/payments/stripe/confirm
 * Confirm a Stripe payment intent
 * Body: { paymentIntentId }
 */
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId required' });
    }

    const result = await stripeService.confirmPaymentIntent(paymentIntentId);
    res.json(result);
  } catch (error) {
    console.error('Stripe confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

/**
 * POST /api/payments/stripe/refund
 * Refund a Stripe charge
 * Body: { chargeId, amount }
 */
router.post('/stripe/refund', async (req, res) => {
  try {
    const { chargeId, amount } = req.body;

    if (!chargeId) {
      return res.status(400).json({ error: 'chargeId required' });
    }

    const result = await stripeService.refundPayment(chargeId, amount);
    res.json(result);
  } catch (error) {
    console.error('Stripe refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

/**
 * Generic Routes
 */

/**
 * POST /api/payments/record
 * Record a payment in the system
 * Body: { saleId, method, amount, status, reference }
 */
router.post('/record', (req, res) => {
  try {
    const { saleId, method, amount, status, reference } = req.body;

    if (!saleId || !method || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const payment = {
      id: Date.now().toString(),
      saleId,
      method: method.toUpperCase(), // MPESA, STRIPE, CASH, etc.
      amount,
      status: status || 'PENDING', // PENDING, SUCCESS, FAILED, REFUNDED
      reference,
      timestamp: new Date().toISOString(),
    };

    // TODO: Save payment record to database
    console.log('Payment recorded:', payment);

    res.json({ success: true, paymentId: payment.id });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * GET /api/payments/:saleId
 * Get payment details for a sale
 */
router.get('/:saleId', (req, res) => {
  try {
    const { saleId } = req.params;
    // TODO: Fetch payment from database
    res.json({ message: 'Payment details would be returned here' });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to retrieve payment' });
  }
});

module.exports = router;

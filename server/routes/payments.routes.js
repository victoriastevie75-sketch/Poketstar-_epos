const express = require('express');
const router = express.Router();

/**
 * Payment Routes
 * Handles payment processing, method management, and transaction records
 */

router.get('/methods', (req, res) => {
  res.json({
    status: 'success',
    methods: [
      {
        id: 'cash',
        label: 'Cash',
        icon: '💵',
        enabled: true
      },
      {
        id: 'mpesa',
        label: 'M-Pesa',
        icon: '📱',
        enabled: true
      },
      {
        id: 'card',
        label: 'Card',
        icon: '💳',
        enabled: true
      }
    ]
  });
});

router.post('/process', (req, res) => {
  const { method, amount, reference } = req.body;
  
  if (!method || !amount) {
    return res.status(400).json({
      status: 'error',
      message: 'Method and amount are required'
    });
  }

  const transactionId = `TXN-${Date.now()}`;
  
  res.json({
    status: 'success',
    transaction: {
      id: transactionId,
      method: method.toUpperCase(),
      amount,
      reference: reference || transactionId,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED'
    }
  });
});

router.post('/validate', (req, res) => {
  const { method, amount } = req.body;
  
  if (!method || amount <= 0) {
    return res.status(400).json({
      status: 'invalid',
      message: 'Invalid payment details'
    });
  }

  res.json({
    status: 'valid',
    method,
    amount,
    fee: 0,
    total: amount
  });
});

router.get('/history', (req, res) => {
  res.json({
    status: 'success',
    transactions: [],
    total: 0
  });
});

module.exports = router;
/**
 * Sales Management Routes
 * API endpoints for sales transactions and reporting
 */

const express = require('express');
const router = express.Router();
const salesService = require('../services/sales.service');
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');

// In-memory sales storage (replace with database in production)
let sales = [];
let refunds = [];

/**
 * POST /api/sales
 * Record a new sale
 */
router.post('/', verifyToken, requirePermission('process_sales'), (req, res) => {
  try {
    const { items, subtotal, tax, discount = 0, payment } = req.body;

    if (!items || !subtotal || tax === undefined) {
      return res.status(400).json({ error: 'Items, subtotal, and tax are required' });
    }

    const newSale = salesService.createSale(
      items,
      subtotal,
      tax,
      discount,
      {
        ...payment,
        userId: req.user.id,
      }
    );

    sales.push(newSale);

    res.status(201).json({
      success: true,
      sale: newSale,
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/sales
 * List all sales with optional filtering
 */
router.get('/', verifyToken, requirePermission('view_sales'), (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, limit = 100, offset = 0 } = req.query;

    let filtered = [...sales];

    // Date filtering
    if (startDate && endDate) {
      filtered = filtered.filter(s => {
        const saleDate = new Date(s.createdAt);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
      });
    }

    // Payment method filtering
    if (paymentMethod) {
      filtered = filtered.filter(s => s.payment.method === paymentMethod.toUpperCase());
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      sales: paginated,
      total: filtered.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('List sales error:', error);
    res.status(500).json({ error: 'Failed to list sales' });
  }
});

/**
 * GET /api/sales/:saleId
 * Get specific sale details
 */
router.get('/:saleId', verifyToken, requirePermission('view_sales'), (req, res) => {
  try {
    const { saleId } = req.params;
    const sale = sales.find(s => s.id === saleId);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Failed to get sale' });
  }
});

/**
 * POST /api/sales/:saleId/refund
 * Process refund for a sale
 */
router.post('/:saleId/refund', verifyToken, requirePermission('process_refunds'), (req, res) => {
  try {
    const { saleId } = req.params;
    const { amount, reason } = req.body;

    const sale = sales.find(s => s.id === saleId);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const refund = salesService.createRefund(sale, amount, reason);
    refunds.push(refund);

    res.status(201).json({
      success: true,
      refund,
    });
  } catch (error) {
    console.error('Create refund error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/sales/summary/date-range
 * Get sales summary for date range
 */
router.get('/summary/date-range', verifyToken, requirePermission('view_reports'), (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates required' });
    }

    const summary = salesService.getSalesSummary(sales, startDate, endDate);

    res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
});

/**
 * GET /api/sales/reports/top-products
 * Get top selling products
 */
router.get('/reports/top-products', verifyToken, requirePermission('view_reports'), (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topProducts = salesService.getTopProducts(sales, parseInt(limit));

    res.json({
      topProducts,
      total: topProducts.length,
    });
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ error: 'Failed to get top products' });
  }
});

/**
 * GET /api/sales/reports/daily-trend
 * Get daily sales trend
 */
router.get('/reports/daily-trend', verifyToken, requirePermission('view_reports'), (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = salesService.getDailyTrend(sales, parseInt(days));

    res.json({
      trend,
      period: parseInt(days),
    });
  } catch (error) {
    console.error('Get daily trend error:', error);
    res.status(500).json({ error: 'Failed to get daily trend' });
  }
});

/**
 * GET /api/sales/reports/summary
 * Get overall sales statistics
 */
router.get('/reports/summary', verifyToken, requirePermission('view_reports'), (req, res) => {
  try {
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const completedSales = sales.filter(s => s.payment.status === 'SUCCESS');
    const failedSales = sales.filter(s => s.payment.status === 'FAILED');
    const pendingSales = sales.filter(s => s.payment.status === 'PENDING');

    const paymentMethods = salesService.groupByPaymentMethod(completedSales);

    res.json({
      summary: {
        totalTransactions: sales.length,
        completedTransactions: completedSales.length,
        failedTransactions: failedSales.length,
        pendingTransactions: pendingSales.length,
        totalRevenue: totalSales,
        averageTransactionValue: sales.length > 0 ? totalSales / sales.length : 0,
        paymentMethods,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get sales summary' });
  }
});

module.exports = router;

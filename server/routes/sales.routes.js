const express = require('express');
const router = express.Router();
const { sanitizeString } = require('../middleware/security');
const { getOrgSales, saveOrgSales } = require('../services/tenant.service');

/**
 * Sales Routes — Multi-Tenant Scoped
 * Handles isolated sales transactions, receipts, and reporting per organization
 */

router.get('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const sales = getOrgSales(orgId);
  res.json({
    status: 'success',
    organizationId: orgId,
    count: sales.length,
    sales
  });
});

router.get('/summary', (req, res) => {
  const orgId = req.orgId || 'default';
  const sales = getOrgSales(orgId);
  
  const totalSales = sales.reduce((sum, sale) => sum + (sale.totals?.grand || sale.total || 0), 0);
  const totalTransactions = sales.length;
  const totalTax = sales.reduce((sum, sale) => sum + (sale.totals?.tax || 0), 0);
  
  res.json({
    status: 'success',
    organizationId: orgId,
    summary: {
      totalSales: Math.round(totalSales * 100) / 100,
      totalTransactions,
      totalTax: Math.round(totalTax * 100) / 100,
      averageTransaction: totalTransactions > 0 ? Math.round((totalSales / totalTransactions) * 100) / 100 : 0
    }
  });
});

router.get('/daily', (req, res) => {
  const orgId = req.orgId || 'default';
  const sales = getOrgSales(orgId);
  const today = new Date().toDateString();
  
  const dailySales = sales.filter(sale => {
    const saleDate = new Date(sale.created_at || sale.timestamp || sale.date || Date.now()).toDateString();
    return saleDate === today;
  });
  
  const totalDaily = dailySales.reduce((sum, sale) => sum + (sale.totals?.grand || sale.total || 0), 0);
  
  res.json({
    status: 'success',
    organizationId: orgId,
    date: today,
    transactions: dailySales.length,
    total: Math.round(totalDaily * 100) / 100,
    sales: dailySales
  });
});

router.get('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const sales = getOrgSales(orgId);
  const sale = sales.find(s => s.id === req.params.id || s.ref === req.params.id);
  
  if (!sale) {
    return res.status(404).json({
      status: 'error',
      message: 'Sale not found'
    });
  }

  res.json({
    status: 'success',
    organizationId: orgId,
    sale
  });
});

router.post('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const { items, totals, total, payment, paymentMethod, tendered, change, subtotal, ref, cashier, tillId } = req.body;
  
  if (!items || (!totals && total === undefined && subtotal === undefined)) {
    return res.status(400).json({
      status: 'error',
      message: 'Items and total or payment information are required'
    });
  }

  const sales = getOrgSales(orgId);
  const grandTotal = Number(totals?.grand !== undefined ? totals.grand : (total !== undefined ? total : (subtotal || 0))) || 0;
  const rawSubtotal = Number(totals?.subtotal !== undefined ? totals.subtotal : (subtotal !== undefined ? subtotal : grandTotal)) || grandTotal;
  const rawTax = Number(totals?.tax !== undefined ? totals.tax : 0) || 0;
  const rawDiscount = Number(totals?.discount !== undefined ? totals.discount : 0) || 0;
  const payMethod = paymentMethod || payment?.method || 'cash';
  const tenderedAmt = Number(tendered !== undefined ? tendered : (payment?.tendered !== undefined ? payment.tendered : grandTotal)) || grandTotal;
  const changeAmt = Number(change !== undefined ? change : (payment?.change !== undefined ? payment.change : Math.max(0, tenderedAmt - grandTotal))) || 0;

  const newSale = {
    id: req.body.id || `SALE-${Date.now()}`,
    organizationId: orgId,
    items: Array.isArray(items) ? items : [],
    totals: {
      subtotal: rawSubtotal,
      tax: rawTax,
      discount: rawDiscount,
      grand: grandTotal
    },
    total: grandTotal,
    payment: {
      method: payMethod,
      tendered: tenderedAmt,
      change: changeAmt
    },
    ref: ref || `REC-${Date.now().toString().slice(-6)}`,
    cashier: cashier || req.body.cashierName || 'admin',
    tillId: tillId || 'Till-01',
    created_at: req.body.created_at || new Date().toISOString()
  };

  sales.unshift(newSale);
  
  if (saveOrgSales(orgId, sales)) {
    res.status(201).json({
      status: 'success',
      organizationId: orgId,
      message: 'Sale recorded successfully',
      sale: newSale
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to record sale'
    });
  }
});

router.delete('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const sales = getOrgSales(orgId);
  const index = sales.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Sale not found'
    });
  }

  const deleted = sales.splice(index, 1)[0];
  
  if (saveOrgSales(orgId, sales)) {
    res.json({
      status: 'success',
      organizationId: orgId,
      message: 'Sale record deleted',
      sale: deleted
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete sale'
    });
  }
});

module.exports = router;

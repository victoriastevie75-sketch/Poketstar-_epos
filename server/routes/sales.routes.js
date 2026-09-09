const express = require('express');
const fs = require('fs');
const path = require('path');
const { sanitizeString } = require('../middleware/security');
const router = express.Router();

/**
 * Sales Routes
 * Handles sales transactions, invoices, and reporting
 */

function getSalesFilePath() {
  const candidates = [
    path.join(__dirname, '../../sales.json'),
    path.join(process.cwd(), 'sales.json'),
    path.join(__dirname, '../../web/sales.json')
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  
  return path.join(process.cwd(), 'sales.json');
}

function loadSales() {
  try {
    const salesPath = getSalesFilePath();
    if (fs.existsSync(salesPath)) {
      const data = fs.readFileSync(salesPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading sales:', err.message);
  }
  return [];
}

function saveSales(sales) {
  try {
    const salesPath = getSalesFilePath();
    fs.writeFileSync(salesPath, JSON.stringify(sales, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving sales:', err.message);
    return false;
  }
}

router.get('/', (req, res) => {
  const sales = loadSales();
  res.json({
    status: 'success',
    count: sales.length,
    sales
  });
});

router.get('/summary', (req, res) => {
  const sales = loadSales();
  
  const totalSales = sales.reduce((sum, sale) => sum + (sale.totals?.grand || 0), 0);
  const totalTransactions = sales.length;
  const totalTax = sales.reduce((sum, sale) => sum + (sale.totals?.tax || 0), 0);
  
  res.json({
    status: 'success',
    summary: {
      totalSales,
      totalTransactions,
      totalTax,
      averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0
    }
  });
});

router.get('/daily', (req, res) => {
  const sales = loadSales();
  const today = new Date().toDateString();
  
  const dailySales = sales.filter(sale => {
    const saleDate = new Date(sale.created_at).toDateString();
    return saleDate === today;
  });
  
  const totalDaily = dailySales.reduce((sum, sale) => sum + (sale.totals?.grand || 0), 0);
  
  res.json({
    status: 'success',
    date: today,
    transactions: dailySales.length,
    total: totalDaily,
    sales: dailySales
  });
});

router.get('/:id', (req, res) => {
  const sales = loadSales();
  const sale = sales.find(s => s.id === req.params.id);
  
  if (!sale) {
    return res.status(404).json({
      status: 'error',
      message: 'Sale not found'
    });
  }

  res.json({
    status: 'success',
    sale
  });
});

router.post('/', (req, res) => {
  const { items, totals, total, payment, paymentMethod, tendered, change, subtotal, ref } = req.body;
  
  if (!items || (!totals && total === undefined && subtotal === undefined)) {
    return res.status(400).json({
      status: 'error',
      message: 'Items and total or payment information are required'
    });
  }

  const sales = loadSales();
  const grandTotal = Number(totals?.grand !== undefined ? totals.grand : (total !== undefined ? total : (subtotal || 0))) || 0;
  const rawSubtotal = Number(totals?.subtotal !== undefined ? totals.subtotal : (subtotal !== undefined ? subtotal : grandTotal)) || grandTotal;
  const rawTax = Number(totals?.tax !== undefined ? totals.tax : 0) || 0;
  const rawDiscount = Number(totals?.discount !== undefined ? totals.discount : 0) || 0;
  const payMethod = paymentMethod || payment?.method || 'cash';
  const tenderedAmt = Number(tendered !== undefined ? tendered : (payment?.tendered !== undefined ? payment.tendered : grandTotal)) || grandTotal;
  const changeAmt = Number(change !== undefined ? change : (payment?.change !== undefined ? payment.change : Math.max(0, tenderedAmt - grandTotal))) || 0;

  const newSale = {
    id: req.body.id || `SALE-${Date.now()}`,
    items: Array.isArray(items) ? items : [],
    totals: {
      subtotal: rawSubtotal,
      tax: rawTax,
      discount: rawDiscount,
      grand: grandTotal
    },
    payment: {
      method: payMethod,
      tendered: tenderedAmt,
      change: changeAmt,
      reference: ref || payment?.reference || null,
      processedAt: new Date().toISOString()
    },
    subtotal: grandTotal,
    paymentMethod: payMethod,
    created_at: new Date().toISOString(),
    status: 'COMPLETED'
  };

  sales.push(newSale);
  
  if (saveSales(sales)) {
    res.status(201).json({
      status: 'success',
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

router.post('/refund/:id', (req, res) => {
  const sales = loadSales();
  const index = sales.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Sale not found'
    });
  }

  const sale = sales[index];
  
  if (sale.status === 'REFUNDED') {
    return res.status(400).json({
      status: 'error',
      message: 'Sale already refunded'
    });
  }

  sale.status = 'REFUNDED';
  sale.refundedAt = new Date().toISOString();
  
  if (saveSales(sales)) {
    res.json({
      status: 'success',
      message: 'Sale refunded successfully',
      sale
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to process refund'
    });
  }
});

router.get('/report/daily', (req, res) => {
  const sales = loadSales();
  
  // Group by date
  const byDate = {};
  sales.forEach(sale => {
    const date = new Date(sale.created_at).toDateString();
    if (!byDate[date]) {
      byDate[date] = {
        date,
        transactions: 0,
        total: 0,
        tax: 0
      };
    }
    byDate[date].transactions++;
    byDate[date].total += sale.totals?.grand || 0;
    byDate[date].tax += sale.totals?.tax || 0;
  });

  res.json({
    status: 'success',
    report: Object.values(byDate)
  });
});

router.get('/report/payment-methods', (req, res) => {
  const sales = loadSales();
  
  const byMethod = {};
  sales.forEach(sale => {
    const method = sale.payment?.method || 'UNKNOWN';
    if (!byMethod[method]) {
      byMethod[method] = {
        method,
        count: 0,
        total: 0
      };
    }
    byMethod[method].count++;
    byMethod[method].total += sale.totals?.grand || 0;
  });

  res.json({
    status: 'success',
    report: Object.values(byMethod)
  });
});

module.exports = router;
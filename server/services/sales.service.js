/**
 * Sales Management Service
 * Handles sales transactions, calculations, and reporting
 */

class SalesService {
  /**
   * Create new sale/transaction
   * @param {array} items - Sale items
   * @param {number} subtotal - Subtotal before tax
   * @param {number} tax - Tax amount
   * @param {number} discount - Discount amount
   * @param {object} payment - Payment details
   * @returns {object} Sale record
   */
  createSale(items, subtotal, tax, discount, payment) {
    if (!items || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    const total = subtotal + tax - discount;

    return {
      id: `SAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(tax),
      discount: parseFloat(discount),
      total: parseFloat(total),
      payment: {
        method: payment.method || 'CASH',
        status: payment.status || 'PENDING',
        reference: payment.reference || '',
        timestamp: new Date().toISOString(),
        ...payment,
      },
      userId: payment.userId || '',
      notes: payment.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate sale totals
   * @param {array} items - Cart items
   * @param {number} taxRate - Tax rate as decimal (e.g., 0.16 for 16%)
   * @param {number} discount - Discount amount
   * @returns {object} Totals calculation
   */
  calculateTotals(items, taxRate = 0.16, discount = 0) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax - discount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Calculate change from cash payment
   * @param {number} amount - Amount due
   * @param {number} tendered - Amount paid
   * @returns {number} Change amount
   */
  calculateChange(amount, tendered) {
    return Math.round((tendered - amount) * 100) / 100;
  }

  /**
   * Process refund
   * @param {object} sale - Original sale
   * @param {number} amount - Refund amount (optional, full refund if not specified)
   * @param {string} reason - Refund reason
   * @returns {object} Refund record
   */
  createRefund(sale, amount = null, reason = 'customer_request') {
    const refundAmount = amount || sale.total;

    if (refundAmount > sale.total) {
      throw new Error('Refund amount cannot exceed sale total');
    }

    return {
      id: `REF-${Date.now()}`,
      saleId: sale.id,
      originalAmount: sale.total,
      refundAmount: parseFloat(refundAmount),
      reason,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      processedAt: null,
    };
  }

  /**
   * Get sales summary by date range
   * @param {array} sales - Sales array
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @returns {object} Summary data
   */
  getSalesSummary(sales, startDate, endDate) {
    const filtered = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });

    const totalSales = filtered.reduce((sum, s) => sum + s.total, 0);
    const totalTax = filtered.reduce((sum, s) => sum + s.tax, 0);
    const totalDiscount = filtered.reduce((sum, s) => sum + s.discount, 0);
    const completedSales = filtered.filter(s => s.payment.status === 'SUCCESS');
    const totalItems = filtered.reduce((sum, s) => sum + s.items.length, 0);

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalTransactions: filtered.length,
      completedTransactions: completedSales.length,
      totalSales,
      totalTax,
      totalDiscount,
      averageTransactionValue: filtered.length > 0 ? totalSales / filtered.length : 0,
      totalItems,
      paymentMethods: this.groupByPaymentMethod(filtered),
    };
  }

  /**
   * Group sales by payment method
   * @param {array} sales - Sales array
   * @returns {object} Grouped by payment method
   */
  groupByPaymentMethod(sales) {
    const grouped = {};

    sales.forEach(s => {
      const method = s.payment.method || 'UNKNOWN';
      if (!grouped[method]) {
        grouped[method] = {
          method,
          count: 0,
          total: 0,
        };
      }
      grouped[method].count++;
      grouped[method].total += s.total;
    });

    return Object.values(grouped);
  }

  /**
   * Get top selling products
   * @param {array} sales - Sales array
   * @param {number} limit - Number of top products
   * @returns {array} Top products
   */
  getTopProducts(sales, limit = 10) {
    const productSales = {};

    sales.forEach(s => {
      s.items.forEach(item => {
        if (!productSales[item.id]) {
          productSales[item.id] = {
            id: item.id,
            name: item.name,
            quantitySold: 0,
            revenue: 0,
          };
        }
        productSales[item.id].quantitySold += item.quantity;
        productSales[item.id].revenue += item.price * item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Calculate daily sales trend
   * @param {array} sales - Sales array
   * @param {number} days - Number of days to analyze
   * @returns {array} Daily trend data
   */
  getDailyTrend(sales, days = 30) {
    const trend = {};
    const today = new Date();

    // Initialize days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trend[dateStr] = {
        date: dateStr,
        sales: 0,
        transactions: 0,
      };
    }

    // Populate data
    sales.forEach(s => {
      const dateStr = s.createdAt.split('T')[0];
      if (trend[dateStr]) {
        trend[dateStr].sales += s.total;
        trend[dateStr].transactions++;
      }
    });

    return Object.values(trend);
  }
}

module.exports = new SalesService();

/**
 * Reporting Service
 * Generate comprehensive reports for analytics and business intelligence
 */

class ReportingService {
  /**
   * Generate daily sales report
   * @param {array} sales - Sales array
   * @param {string} date - Date (ISO string)
   * @returns {object} Daily report
   */
  generateDailySalesReport(sales, date) {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const daySales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= targetDate && saleDate < nextDate;
    });

    const totalSales = daySales.reduce((sum, s) => sum + s.total, 0);
    const totalTax = daySales.reduce((sum, s) => sum + s.tax, 0);
    const totalDiscount = daySales.reduce((sum, s) => sum + s.discount, 0);

    return {
      date,
      totalTransactions: daySales.length,
      totalSales: Math.round(totalSales * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      netSales: Math.round((totalSales - totalDiscount) * 100) / 100,
      paymentMethods: this.groupByPaymentMethod(daySales),
      topProducts: this.getTopProducts(daySales, 5),
    };
  }

  /**
   * Generate weekly sales report
   * @param {array} sales - Sales array
   * @param {string} startDate - Week start date
   * @returns {object} Weekly report
   */
  generateWeeklySalesReport(sales, startDate) {
    const weekStart = new Date(startDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= weekStart && saleDate < weekEnd;
    });

    const dailyBreakdown = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const daySales = weekSales.filter(s => s.createdAt.startsWith(dateStr));
      dailyBreakdown[days[i]] = daySales.reduce((sum, s) => sum + s.total, 0);
    }

    const totalSales = weekSales.reduce((sum, s) => sum + s.total, 0);

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalTransactions: weekSales.length,
      totalSales: Math.round(totalSales * 100) / 100,
      averageDailySales: Math.round((totalSales / 7) * 100) / 100,
      dailyBreakdown,
    };
  }

  /**
   * Generate monthly sales report
   * @param {array} sales - Sales array
   * @param {string} month - Month (YYYY-MM)
   * @returns {object} Monthly report
   */
  generateMonthlySalesReport(sales, month) {
    const [year, monthNum] = month.split('-');
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    const monthSales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= monthStart && saleDate <= monthEnd;
    });

    const totalSales = monthSales.reduce((sum, s) => sum + s.total, 0);
    const totalTax = monthSales.reduce((sum, s) => sum + s.tax, 0);
    const costOfGoods = monthSales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => itemSum + (item.cost || 0) * item.quantity, 0);
    }, 0);

    const profit = totalSales - costOfGoods;

    return {
      month,
      totalTransactions: monthSales.length,
      totalSales: Math.round(totalSales * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      costOfGoods: Math.round(costOfGoods * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMargin: totalSales > 0 ? Math.round((profit / totalSales) * 100) : 0,
      paymentMethods: this.groupByPaymentMethod(monthSales),
    };
  }

  /**
   * Group sales by payment method
   * @param {array} sales - Sales array
   * @returns {array} Grouped by method
   */
  groupByPaymentMethod(sales) {
    const grouped = {};

    sales.forEach(s => {
      const method = s.payment.method || 'UNKNOWN';
      if (!grouped[method]) {
        grouped[method] = { count: 0, total: 0 };
      }
      grouped[method].count++;
      grouped[method].total += s.total;
    });

    return Object.entries(grouped).map(([method, data]) => ({
      method,
      count: data.count,
      total: Math.round(data.total * 100) / 100,
    }));
  }

  /**
   * Get top products
   * @param {array} sales - Sales array
   * @param {number} limit - Number of products
   * @returns {array} Top products
   */
  getTopProducts(sales, limit = 10) {
    const products = {};

    sales.forEach(s => {
      s.items.forEach(item => {
        if (!products[item.id]) {
          products[item.id] = {
            id: item.id,
            name: item.name,
            quantitySold: 0,
            revenue: 0,
          };
        }
        products[item.id].quantitySold += item.quantity;
        products[item.id].revenue += item.price * item.quantity;
      });
    });

    return Object.values(products)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Generate tax compliance report
   * @param {array} sales - Sales array
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {object} Tax report
   */
  generateTaxReport(sales, startDate, endDate) {
    const filtered = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });

    const totalTax = filtered.reduce((sum, s) => sum + s.tax, 0);
    const totalSalesBeforeTax = filtered.reduce((sum, s) => sum + s.subtotal, 0);
    const taxRate = totalSalesBeforeTax > 0 ? (totalTax / totalSalesBeforeTax) * 100 : 0;

    return {
      period: { startDate, endDate },
      totalSalesBeforeTax: Math.round(totalSalesBeforeTax * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      taxRate: Math.round(taxRate * 100) / 100,
      transactions: filtered.length,
    };
  }

  /**
   * Generate cash reconciliation report
   * @param {array} sales - Sales array
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {object} Cash report
   */
  generateCashReport(sales, startDate, endDate) {
    const filtered = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= new Date(startDate) && saleDate <= new Date(endDate) && s.payment.method === 'CASH';
    });

    const totalCash = filtered.reduce((sum, s) => sum + s.total, 0);
    const totalTendered = filtered.reduce((sum, s) => sum + (s.payment.tendered || 0), 0);
    const totalChange = filtered.reduce((sum, s) => sum + (s.payment.change || 0), 0);

    return {
      period: { startDate, endDate },
      transactions: filtered.length,
      totalSales: Math.round(totalCash * 100) / 100,
      totalTendered: Math.round(totalTendered * 100) / 100,
      totalChange: Math.round(totalChange * 100) / 100,
      expectedCash: Math.round((totalCash + totalChange) * 100) / 100,
    };
  }
}

module.exports = new ReportingService();

/**
 * Inventory Management Service
 * Advanced inventory operations, stock tracking, and analytics
 */

class InventoryService {
  /**
   * Get inventory statistics
   * @param {array} products - Products array
   * @returns {object} Inventory stats
   */
  getInventoryStats(products) {
    const activeProducts = products.filter(p => p.active);
    const totalValue = activeProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const lowStockProducts = activeProducts.filter(p => p.quantity <= p.reorderLevel);
    const outOfStock = activeProducts.filter(p => p.quantity === 0);

    return {
      totalProducts: activeProducts.length,
      totalQuantity: activeProducts.reduce((sum, p) => sum + p.quantity, 0),
      totalValue: Math.round(totalValue * 100) / 100,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStock.length,
      averageInventoryValue: activeProducts.length > 0 ? Math.round((totalValue / activeProducts.length) * 100) / 100 : 0,
    };
  }

  /**
   * Generate reorder list
   * @param {array} products - Products array
   * @returns {array} Products needing reorder
   */
  getReorderList(products) {
    return products
      .filter(p => p.active && p.quantity <= p.reorderLevel)
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        currentQuantity: p.quantity,
        reorderLevel: p.reorderLevel,
        suggestedOrderQuantity: (p.reorderLevel * 2) - p.quantity,
        supplier: p.supplier,
        cost: p.cost,
        totalCost: ((p.reorderLevel * 2) - p.quantity) * p.cost,
      }))
      .sort((a, b) => a.currentQuantity - b.currentQuantity);
  }

  /**
   * Calculate fast-moving vs slow-moving items
   * @param {array} sales - Sales array
   * @param {number} days - Number of days to analyze
   * @returns {object} Product velocity analysis
   */
  analyzeProductVelocity(sales, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const productSales = {};

    sales.forEach(s => {
      if (new Date(s.createdAt) > cutoffDate) {
        s.items.forEach(item => {
          if (!productSales[item.id]) {
            productSales[item.id] = {
              id: item.id,
              name: item.name,
              unitsSold: 0,
              revenue: 0,
            };
          }
          productSales[item.id].unitsSold += item.quantity;
          productSales[item.id].revenue += item.price * item.quantity;
        });
      }
    });

    const products = Object.values(productSales);
    const avgUnitsSold = products.length > 0 ? products.reduce((sum, p) => sum + p.unitsSold, 0) / products.length : 0;

    return {
      fastMoving: products.filter(p => p.unitsSold > avgUnitsSold),
      slowMoving: products.filter(p => p.unitsSold <= avgUnitsSold),
      period: days,
    };
  }

  /**
   * Calculate inventory turnover ratio
   * @param {array} products - Products array
   * @param {array} sales - Sales array
   * @param {number} period - Period in days
   * @returns {number} Turnover ratio
   */
  calculateTurnoverRatio(products, sales, period = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);

    let unitsSold = 0;
    sales.forEach(s => {
      if (new Date(s.createdAt) > cutoffDate) {
        s.items.forEach(item => {
          unitsSold += item.quantity;
        });
      }
    });

    const averageInventory = products.reduce((sum, p) => sum + p.quantity, 0) / products.length;

    return averageInventory > 0 ? Math.round((unitsSold / averageInventory) * 100) / 100 : 0;
  }

  /**
   * Get inventory by category
   * @param {array} products - Products array
   * @returns {object} Inventory grouped by category
   */
  getInventoryByCategory(products) {
    const categories = {};

    products.forEach(p => {
      if (p.active) {
        const cat = p.category || 'Uncategorized';
        if (!categories[cat]) {
          categories[cat] = {
            category: cat,
            productCount: 0,
            totalQuantity: 0,
            totalValue: 0,
          };
        }
        categories[cat].productCount++;
        categories[cat].totalQuantity += p.quantity;
        categories[cat].totalValue += p.price * p.quantity;
      }
    });

    return Object.values(categories);
  }

  /**
   * Perform stock take
   * @param {array} products - Products array
   * @param {object} countedStock - Physically counted stock
   * @returns {array} Discrepancies
   */
  performStockTake(products, countedStock) {
    const discrepancies = [];

    products.forEach(p => {
      const counted = countedStock[p.id] || 0;
      if (counted !== p.quantity) {
        discrepancies.push({
          productId: p.id,
          productName: p.name,
          systemQuantity: p.quantity,
          countedQuantity: counted,
          variance: counted - p.quantity,
          variancePercent: ((counted - p.quantity) / p.quantity * 100).toFixed(2),
        });
      }
    });

    return discrepancies;
  }

  /**
   * Calculate ABC analysis (value vs volume)
   * @param {array} products - Products array
   * @returns {object} ABC classification
   */
  getABCAnalysis(products) {
    const sorted = [...products]
      .filter(p => p.active)
      .sort((a, b) => b.price * b.quantity - a.price * a.quantity);

    const totalValue = sorted.reduce((sum, p) => sum + p.price * p.quantity, 0);
    let runningValue = 0;
    const classified = { A: [], B: [], C: [] };

    sorted.forEach(p => {
      runningValue += p.price * p.quantity;
      const percentage = (runningValue / totalValue) * 100;

      if (percentage <= 80) {
        classified.A.push(p);
      } else if (percentage <= 95) {
        classified.B.push(p);
      } else {
        classified.C.push(p);
      }
    });

    return {
      A: classified.A,
      B: classified.B,
      C: classified.C,
      notes: 'A: 80% of value, B: next 15%, C: remaining 5%',
    };
  }

  /**
   * Forecast demand based on sales trend
   * @param {array} sales - Sales array
   * @param {number} days - Days to forecast
   * @returns {array} Forecast data
   */
  forecastDemand(sales, days = 30) {
    const productTrends = {};

    // Analyze last 90 days
    const analysisDate = new Date();
    analysisDate.setDate(analysisDate.getDate() - 90);

    sales.forEach(s => {
      if (new Date(s.createdAt) > analysisDate) {
        s.items.forEach(item => {
          if (!productTrends[item.id]) {
            productTrends[item.id] = {
              id: item.id,
              name: item.name,
              dailySales: [],
            };
          }
          productTrends[item.id].dailySales.push(item.quantity);
        });
      }
    });

    // Calculate forecast
    const forecasts = [];
    Object.values(productTrends).forEach(product => {
      const avgDailySales = product.dailySales.length > 0 ? product.dailySales.reduce((a, b) => a + b, 0) / product.dailySales.length : 0;
      forecasts.push({
        productId: product.id,
        productName: product.name,
        avgDailySalesLast90Days: Math.round(avgDailySales * 100) / 100,
        forecasted30DayDemand: Math.round(avgDailySales * days * 100) / 100,
        trend: product.dailySales.length > 0 ? 'stable' : 'new',
      });
    });

    return forecasts.sort((a, b) => b.forecasted30DayDemand - a.forecasted30DayDemand);
  }
}

module.exports = new InventoryService();

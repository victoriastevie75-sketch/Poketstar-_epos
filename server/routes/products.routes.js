/**
 * Product Management Routes
 * API endpoints for product CRUD and inventory operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const productService = require('../services/product.service');
const { verifyToken, requirePermission } = require('../middleware/auth.middleware');

// In-memory product storage initialized from products.json
let products = [];
try {
  const localPath = path.join(process.cwd(), 'products.json');
  const bundlePath = path.join(__dirname, '../../products.json');
  const jsonPath = fs.existsSync(localPath) ? localPath : bundlePath;
  if (fs.existsSync(jsonPath)) {
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    products = rawData.map((p, idx) => ({
      id: `PRD-${String(idx + 1).padStart(4, '0')}`,
      name: p.name,
      sku: p.barcode ? (p.barcode.startsWith('SKU-') ? p.barcode : `SKU-${p.barcode.slice(-6)}`) : `SKU-${idx + 1}`,
      barcode: p.barcode || `600${String(idx + 1).padStart(9, '0')}`,
      price: Number(p.price) || 0,
      cost: Number(p.buyingPrice) || Math.round(Number(p.price) * 0.7),
      quantity: p.qty !== undefined ? Number(p.qty) : 50,
      category: p.category || 'General',
      taxRate: p.taxRate !== undefined ? Number(p.taxRate) : 16,
      description: `${p.name} - Official inventory item`,
      reorderLevel: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }
} catch (e) {
  console.warn('Could not load products.json, using fallback:', e.message);
}

if (products.length === 0) {
  products = [
    {
      id: 'PRD-0001',
      name: 'Espresso Coffee',
      sku: 'SKU-ESP-01',
      barcode: '600123456789',
      price: 250,
      cost: 100,
      quantity: 50,
      category: 'Beverages',
      taxRate: 16,
      description: 'Rich dark roast espresso',
      reorderLevel: 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}
let adjustmentHistory = [];

/**
 * POST /api/products
 * Create new product
 */
router.post(
  '/',
  verifyToken,
  requirePermission('manage_products'),
  (req, res) => {
    try {
      const newProduct = productService.createProduct(req.body);
      products.push(newProduct);

      res.status(201).json({
        success: true,
        product: newProduct,
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/products
 * List all products with optional filtering
 */
router.get('/', (req, res) => {
  try {
    const { category, search, lowStock } = req.query;

    let filtered = products.filter(p => p.active);

    if (category) {
      filtered = productService.getByCategory(filtered, category);
    }

    if (search) {
      filtered = productService.searchProducts(filtered, search);
    }

    if (lowStock === 'true') {
      filtered = productService.getLowStockProducts(filtered);
    }

    // Support both direct array expectations and object wrapper
    res.json({
      success: true,
      products: filtered,
      total: filtered.length,
      inventoryValue: productService.getInventoryValue(filtered),
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

/**
 * GET /api/products/:productId
 * Get specific product details
 */
router.get('/:productId', verifyToken, (req, res) => {
  try {
    const { productId } = req.params;
    const product = products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      product,
      profitMargin: productService.getProfitMargin(product),
      isLowStock: productService.isLowStock(product),
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

/**
 * PUT /api/products/:productId
 * Update product details
 */
router.put(
  '/:productId',
  verifyToken,
  requirePermission('manage_products'),
  (req, res) => {
    try {
      const { productId } = req.params;
      const product = products.find(p => p.id === productId);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const updated = productService.updateProduct(product, req.body);

      res.json({
        success: true,
        product: updated,
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/products/:productId
 * Deactivate product (soft delete)
 */
router.delete(
  '/:productId',
  verifyToken,
  requirePermission('manage_products'),
  (req, res) => {
    try {
      const { productId } = req.params;
      const product = products.find(p => p.id === productId);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      product.active = false;
      product.updatedAt = new Date().toISOString();

      res.json({ success: true, message: 'Product deactivated' });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  }
);

/**
 * POST /api/products/:productId/adjust-quantity
 * Adjust product quantity (stock take, returns, etc.)
 */
router.post(
  '/:productId/adjust-quantity',
  verifyToken,
  requirePermission('manage_products'),
  (req, res) => {
    try {
      const { productId } = req.params;
      const { quantity, reason } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({ error: 'Quantity required' });
      }

      const product = products.find(p => p.id === productId);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const adjustment = productService.adjustQuantity(
        product,
        parseInt(quantity),
        reason || 'manual'
      );

      adjustmentHistory.push(adjustment);

      res.json({
        success: true,
        adjustment,
        product,
      });
    } catch (error) {
      console.error('Adjust quantity error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * GET /api/products/low-stock
 * Get all low stock products
 */
router.get('/inventory/low-stock', verifyToken, (req, res) => {
  try {
    const lowStockProducts = productService.getLowStockProducts(products);

    res.json({
      lowStockProducts,
      total: lowStockProducts.length,
    });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to get low stock products' });
  }
});

/**
 * GET /api/products/categories
 * Get all product categories
 */
router.get('/inventory/categories', verifyToken, (req, res) => {
  try {
    const categories = [...new Set(products.map(p => p.category))];

    res.json({
      categories: categories.sort(),
      total: categories.length,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * GET /api/products/statistics/inventory
 * Get inventory statistics
 */
router.get('/statistics/inventory', verifyToken, (req, res) => {
  try {
    const activeProducts = products.filter(p => p.active);
    const lowStockCount = productService.getLowStockProducts(activeProducts).length;
    const totalValue = productService.getInventoryValue(activeProducts);
    const avgPrice = activeProducts.length > 0 ? totalValue / activeProducts.length : 0;
    const totalQuantity = activeProducts.reduce((sum, p) => sum + p.quantity, 0);

    res.json({
      statistics: {
        totalProducts: activeProducts.length,
        totalQuantity,
        totalValue,
        averagePrice: avgPrice,
        lowStockCount,
        outOfStockCount: activeProducts.filter(p => p.quantity === 0).length,
      },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;

/**
 * Product Management Service
 * CRUD operations and inventory management
 */

class ProductService {
  constructor() {
    this.nextId = 1;
  }

  /**
   * Create new product
   * @param {object} data - Product data
   * @returns {object} Created product
   */
  createProduct(data) {
    const {
      name,
      sku,
      barcode,
      price,
      cost,
      quantity,
      category,
      description,
      reorderLevel = 10,
      supplier,
      imageUrl,
    } = data;

    if (!name || !price || quantity === undefined) {
      throw new Error('Name, price, and quantity are required');
    }

    return {
      id: `PRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      sku: sku || `SKU-${this.nextId++}`,
      barcode: barcode || `BAR-${Date.now()}`,
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
      quantity: parseInt(quantity),
      category: category || 'General',
      description: description || '',
      reorderLevel: parseInt(reorderLevel),
      supplier: supplier || '',
      imageUrl: imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
    };
  }

  /**
   * Update product
   * @param {object} product - Product to update
   * @param {object} data - Update data
   * @returns {object} Updated product
   */
  updateProduct(product, data) {
    const updateFields = [
      'name',
      'sku',
      'barcode',
      'price',
      'cost',
      'category',
      'description',
      'reorderLevel',
      'supplier',
      'imageUrl',
      'active',
    ];

    updateFields.forEach(field => {
      if (data[field] !== undefined) {
        if (field === 'price' || field === 'cost') {
          product[field] = parseFloat(data[field]);
        } else if (field === 'quantity' || field === 'reorderLevel') {
          product[field] = parseInt(data[field]);
        } else {
          product[field] = data[field];
        }
      }
    });

    product.updatedAt = new Date().toISOString();
    return product;
  }

  /**
   * Adjust product quantity
   * @param {object} product - Product to adjust
   * @param {number} quantity - Quantity adjustment (positive or negative)
   * @param {string} reason - Reason for adjustment (sale, return, stock-take, etc.)
   * @returns {object} Adjustment record
   */
  adjustQuantity(product, quantity, reason = 'manual') {
    const oldQuantity = product.quantity;
    product.quantity = Math.max(0, product.quantity + quantity);
    product.updatedAt = new Date().toISOString();

    return {
      id: `ADJ-${Date.now()}`,
      productId: product.id,
      previousQuantity: oldQuantity,
      newQuantity: product.quantity,
      adjustmentAmount: quantity,
      reason,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check low stock
   * @param {object} product - Product to check
   * @returns {boolean} Is low stock
   */
  isLowStock(product) {
    return product.quantity <= product.reorderLevel;
  }

  /**
   * Get product profit margin
   * @param {object} product - Product
   * @returns {number} Profit margin percentage
   */
  getProfitMargin(product) {
    if (product.cost === 0) return 0;
    return ((product.price - product.cost) / product.price) * 100;
  }

  /**
   * Search products
   * @param {array} products - Products array
   * @param {string} query - Search query
   * @returns {array} Matching products
   */
  searchProducts(products, query) {
    const q = query.toLowerCase();
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  /**
   * Get products by category
   * @param {array} products - Products array
   * @param {string} category - Category name
   * @returns {array} Products in category
   */
  getByCategory(products, category) {
    return products.filter(p => p.category === category);
  }

  /**
   * Get low stock products
   * @param {array} products - Products array
   * @returns {array} Low stock products
   */
  getLowStockProducts(products) {
    return products.filter(p => this.isLowStock(p));
  }

  /**
   * Calculate inventory value
   * @param {array} products - Products array
   * @returns {number} Total inventory value
   */
  getInventoryValue(products) {
    return products.reduce((total, p) => total + p.price * p.quantity, 0);
  }
}

module.exports = new ProductService();

/**
 * Product Service Tests
 */

const productService = require('../../services/product.service');

describe('ProductService', () => {
  let product;

  beforeEach(() => {
    product = productService.createProduct({
      name: 'Test Product',
      price: 100,
      quantity: 50,
      category: 'Electronics',
    });
  });

  describe('createProduct', () => {
    it('should create a product', () => {
      expect(product).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.price).toBe(100);
    });

    it('should throw error without required fields', () => {
      expect(() => {
        productService.createProduct({ name: 'Test' });
      }).toThrow();
    });
  });

  describe('updateProduct', () => {
    it('should update product properties', () => {
      const updated = productService.updateProduct(product, {
        name: 'Updated Product',
        price: 150,
      });
      expect(updated.name).toBe('Updated Product');
      expect(updated.price).toBe(150);
    });
  });

  describe('adjustQuantity', () => {
    it('should increase quantity', () => {
      const adjustment = productService.adjustQuantity(product, 10);
      expect(product.quantity).toBe(60);
      expect(adjustment.adjustmentAmount).toBe(10);
    });

    it('should decrease quantity', () => {
      const adjustment = productService.adjustQuantity(product, -20);
      expect(product.quantity).toBe(30);
      expect(adjustment.adjustmentAmount).toBe(-20);
    });

    it('should not go below zero', () => {
      productService.adjustQuantity(product, -100);
      expect(product.quantity).toBe(0);
    });
  });

  describe('isLowStock', () => {
    it('should detect low stock', () => {
      product.quantity = 5;
      product.reorderLevel = 10;
      expect(productService.isLowStock(product)).toBe(true);
    });
  });

  describe('getProfitMargin', () => {
    it('should calculate profit margin', () => {
      product.cost = 60;
      product.price = 100;
      const margin = productService.getProfitMargin(product);
      expect(margin).toBe(40);
    });
  });

  describe('searchProducts', () => {
    it('should search products by name', () => {
      const products = [product];
      const results = productService.searchProducts(products, 'Test');
      expect(results.length).toBe(1);
    });
  });
});

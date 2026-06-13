/**
 * Sales Service Tests
 */

const salesService = require('../../services/sales.service');

describe('SalesService', () => {
  const mockItems = [
    { id: '1', name: 'Product 1', price: 100, quantity: 2 },
    { id: '2', name: 'Product 2', price: 50, quantity: 1 },
  ];

  describe('calculateTotals', () => {
    it('should calculate totals correctly', () => {
      const totals = salesService.calculateTotals(mockItems, 0.16, 10);
      expect(totals.subtotal).toBe(250); // (100*2) + (50*1)
      expect(totals.tax).toBe(40); // 250 * 0.16
      expect(totals.discount).toBe(10);
      expect(totals.total).toBe(280); // 250 + 40 - 10
    });
  });

  describe('calculateChange', () => {
    it('should calculate change correctly', () => {
      const change = salesService.calculateChange(250, 300);
      expect(change).toBe(50);
    });
  });

  describe('createSale', () => {
    it('should create a sale', () => {
      const sale = salesService.createSale(
        mockItems,
        250,
        40,
        0,
        { method: 'CASH', status: 'SUCCESS' }
      );
      expect(sale).toBeDefined();
      expect(sale.total).toBe(290);
      expect(sale.payment.method).toBe('CASH');
    });
  });

  describe('createRefund', () => {
    it('should create a refund', () => {
      const sale = salesService.createSale(
        mockItems,
        250,
        40,
        0,
        { method: 'CASH' }
      );
      const refund = salesService.createRefund(sale, 100, 'customer_request');
      expect(refund).toBeDefined();
      expect(refund.refundAmount).toBe(100);
      expect(refund.saleId).toBe(sale.id);
    });

    it('should throw error for refund exceeding sale total', () => {
      const sale = salesService.createSale(
        mockItems,
        250,
        40,
        0,
        { method: 'CASH' }
      );
      expect(() => {
        salesService.createRefund(sale, 500);
      }).toThrow();
    });
  });

  describe('groupByPaymentMethod', () => {
    it('should group sales by payment method', () => {
      const sales = [
        salesService.createSale(mockItems, 250, 40, 0, { method: 'CASH' }),
        salesService.createSale(mockItems, 250, 40, 0, { method: 'MPESA' }),
        salesService.createSale(mockItems, 250, 40, 0, { method: 'CASH' }),
      ];
      const grouped = salesService.groupByPaymentMethod(sales);
      expect(grouped.length).toBe(2);
    });
  });
});

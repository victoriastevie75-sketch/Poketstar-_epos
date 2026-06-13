/**
 * MongoDB Database Schemas
 * Define data models for Poketstar POS system
 * To use: npm install mongoose
 */

const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    firstName: String,
    lastName: String,
    phone: String,
    role: {
      type: String,
      enum: ['admin', 'manager', 'cashier', 'viewer'],
      default: 'cashier',
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

// Product Schema
const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    category: String,
    description: String,
    reorderLevel: {
      type: Number,
      default: 10,
    },
    supplier: String,
    imageUrl: String,
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Add index for barcode searches
ProductSchema.index({ barcode: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ category: 1 });

// Sale Item Schema (sub-document)
const SaleItemSchema = new mongoose.Schema(
  {
    productId: mongoose.Schema.Types.ObjectId,
    productName: String,
    quantity: Number,
    price: Number,
    subtotal: Number,
  },
  { _id: false }
);

// Payment Schema (sub-document)
const PaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['CASH', 'MPESA', 'STRIPE', 'PAYPAL'],
      default: 'CASH',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    reference: String,
    transactionId: String,
    tendered: Number,
    change: Number,
  },
  { _id: false }
);

// Sale Schema
const SaleSchema = new mongoose.Schema(
  {
    items: [SaleItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    payment: PaymentSchema,
    userId: mongoose.Schema.Types.ObjectId,
    notes: String,
    receiptPrinted: {
      type: Boolean,
      default: false,
    },
    voided: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Add index for date range queries
SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ 'payment.method': 1 });
SaleSchema.index({ userId: 1 });

// Customer Schema
const CustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: String,
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    lastPurchase: Date,
  },
  { timestamps: true }
);

// Loyalty Schema
const LoyaltySchema = new mongoose.Schema(
  {
    customerId: mongoose.Schema.Types.ObjectId,
    pointsBalance: {
      type: Number,
      default: 0,
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
  },
  { timestamps: true }
);

// Refund Schema
const RefundSchema = new mongoose.Schema(
  {
    saleId: mongoose.Schema.Types.ObjectId,
    originalAmount: Number,
    refundAmount: Number,
    reason: String,
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'],
      default: 'PENDING',
    },
    approvedBy: mongoose.Schema.Types.ObjectId,
    processedAt: Date,
  },
  { timestamps: true }
);

// Inventory Adjustment Schema
const InventoryAdjustmentSchema = new mongoose.Schema(
  {
    productId: mongoose.Schema.Types.ObjectId,
    previousQuantity: Number,
    newQuantity: Number,
    adjustmentAmount: Number,
    reason: String,
    performedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

// Audit Log Schema
const AuditLogSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    action: String,
    resource: String,
    resourceId: String,
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

// Add index for audit queries
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, createdAt: -1 });

// Payment Record Schema
const PaymentRecordSchema = new mongoose.Schema(
  {
    saleId: mongoose.Schema.Types.ObjectId,
    method: {
      type: String,
      enum: ['CASH', 'MPESA', 'STRIPE', 'PAYPAL'],
    },
    amount: Number,
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    },
    reference: String,
    metadata: mongoose.Schema.Types.Mixed,
    processedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

// Export models
module.exports = {
  User: mongoose.model('User', UserSchema),
  Product: mongoose.model('Product', ProductSchema),
  Sale: mongoose.model('Sale', SaleSchema),
  Customer: mongoose.model('Customer', CustomerSchema),
  Loyalty: mongoose.model('Loyalty', LoyaltySchema),
  Refund: mongoose.model('Refund', RefundSchema),
  InventoryAdjustment: mongoose.model('InventoryAdjustment', InventoryAdjustmentSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema),
  PaymentRecord: mongoose.model('PaymentRecord', PaymentRecordSchema),
};

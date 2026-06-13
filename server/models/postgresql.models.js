/**
 * PostgreSQL Database Schemas
 * Define data models for Poketstar POS system using SQL
 * To use: npm install pg sequelize
 */

const Sequelize = require('sequelize');

// Initialize Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME || 'poketstar_pos',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

// User Model
const User = sequelize.define(
  'User',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    firstName: Sequelize.STRING,
    lastName: Sequelize.STRING,
    phone: Sequelize.STRING,
    role: {
      type: Sequelize.ENUM('admin', 'manager', 'cashier', 'viewer'),
      defaultValue: 'cashier',
    },
    active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    lastLogin: Sequelize.DATE,
  },
  {
    timestamps: true,
    indexes: [{ fields: ['email'] }],
  }
);

// Product Model
const Product = sequelize.define(
  'Product',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    sku: {
      type: Sequelize.STRING,
      unique: true,
    },
    barcode: {
      type: Sequelize.STRING,
      unique: true,
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    cost: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    quantity: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    category: Sequelize.STRING,
    description: Sequelize.TEXT,
    reorderLevel: {
      type: Sequelize.INTEGER,
      defaultValue: 10,
    },
    supplier: Sequelize.STRING,
    imageUrl: Sequelize.STRING,
    active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ['barcode'] },
      { fields: ['sku'] },
      { fields: ['category'] },
    ],
  }
);

// Sale Model
const Sale = sequelize.define(
  'Sale',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    subtotal: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    tax: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    discount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: Sequelize.ENUM('CASH', 'MPESA', 'STRIPE', 'PAYPAL'),
      defaultValue: 'CASH',
    },
    paymentStatus: {
      type: Sequelize.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'),
      defaultValue: 'PENDING',
    },
    paymentReference: Sequelize.STRING,
    notes: Sequelize.TEXT,
    receiptPrinted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    voided: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: Sequelize.UUID,
      references: { model: User, key: 'id' },
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ['createdAt'] },
      { fields: ['paymentMethod'] },
      { fields: ['userId'] },
    ],
  }
);

// Sale Item Model
const SaleItem = sequelize.define(
  'SaleItem',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    quantity: Sequelize.INTEGER,
    price: Sequelize.DECIMAL(10, 2),
    subtotal: Sequelize.DECIMAL(10, 2),
    productId: {
      type: Sequelize.UUID,
      references: { model: Product, key: 'id' },
    },
    saleId: {
      type: Sequelize.UUID,
      references: { model: Sale, key: 'id' },
    },
  },
  { timestamps: true }
);

// Customer Model
const Customer = sequelize.define(
  'Customer',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      validate: { isEmail: true },
    },
    phone: Sequelize.STRING,
    loyaltyPoints: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    totalSpent: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    totalTransactions: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    lastPurchase: Sequelize.DATE,
  },
  { timestamps: true }
);

// Refund Model
const Refund = sequelize.define(
  'Refund',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    originalAmount: Sequelize.DECIMAL(10, 2),
    refundAmount: Sequelize.DECIMAL(10, 2),
    reason: Sequelize.STRING,
    status: {
      type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'),
      defaultValue: 'PENDING',
    },
    processedAt: Sequelize.DATE,
    saleId: {
      type: Sequelize.UUID,
      references: { model: Sale, key: 'id' },
    },
    approvedBy: {
      type: Sequelize.UUID,
      references: { model: User, key: 'id' },
    },
  },
  { timestamps: true }
);

// Inventory Adjustment Model
const InventoryAdjustment = sequelize.define(
  'InventoryAdjustment',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    previousQuantity: Sequelize.INTEGER,
    newQuantity: Sequelize.INTEGER,
    adjustmentAmount: Sequelize.INTEGER,
    reason: Sequelize.STRING,
    productId: {
      type: Sequelize.UUID,
      references: { model: Product, key: 'id' },
    },
    performedBy: {
      type: Sequelize.UUID,
      references: { model: User, key: 'id' },
    },
  },
  { timestamps: true }
);

// Audit Log Model
const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    action: Sequelize.STRING,
    resource: Sequelize.STRING,
    resourceId: Sequelize.STRING,
    changes: Sequelize.JSON,
    ipAddress: Sequelize.STRING,
    userAgent: Sequelize.STRING,
    userId: {
      type: Sequelize.UUID,
      references: { model: User, key: 'id' },
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ['userId', 'createdAt'] },
      { fields: ['resource', 'createdAt'] },
    ],
  }
);

// Define relationships
Sale.belongsTo(User);
User.hasMany(Sale);

Sale.hasMany(SaleItem);
SaleItem.belongsTo(Sale);

SaleItem.belongsTo(Product);
Product.hasMany(SaleItem);

Refund.belongsTo(Sale);
Sale.hasOne(Refund);

InventoryAdjustment.belongsTo(Product);
Product.hasMany(InventoryAdjustment);

// Sync all models
async function syncDatabase() {
  try {
    await sequelize.sync({ alter: false });
    console.log('Database synced successfully');
  } catch (error) {
    console.error('Database sync failed:', error);
  }
}

module.exports = {
  sequelize,
  syncDatabase,
  User,
  Product,
  Sale,
  SaleItem,
  Customer,
  Refund,
  InventoryAdjustment,
  AuditLog,
};

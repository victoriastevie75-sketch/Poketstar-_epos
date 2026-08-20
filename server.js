#!/usr/bin/env node
/**
 * Poketstar POS Server
 * Unified Express server for serving the POS desktop environment & web demo APIs
 */

const express = require('express');
const path = require('path');
const app = express();

// Import API routes
const authRoutes = require('./server/routes/auth.routes');
const paymentsRoutes = require('./server/routes/payments.routes');
const productsRoutes = require('./server/routes/products.routes');
const salesRoutes = require('./server/routes/sales.routes');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from workspace root & web folder
app.use(express.static(path.join(__dirname)));
app.use('/web', express.static(path.join(__dirname, 'web')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server on 0.0.0.0:3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  Poketstar POS Server Running    ║`);
  console.log(`╚══════════════════════════════════╝`);
  console.log(`\n🚀 Listening on http://0.0.0.0:${PORT}\n`);
});

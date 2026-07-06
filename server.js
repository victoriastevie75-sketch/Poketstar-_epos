#!/usr/bin/env node
/**
 * Poketstar POS Server
 * Lightweight Express server for serving the unified POS application
 * Use: node server.js
 */

const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.static(path.dirname(__filename)));
app.use(express.json());

// Serve the main index.html for all routes (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  Poketstar POS Server Running    ║`);
  console.log(`╚══════════════════════════════════╝`);
  console.log(`\n🚀 Open in browser: http://localhost:${PORT}`);
  console.log(`📱 Mobile access: http://<your-ip>:${PORT}`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});

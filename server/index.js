// Simple Express server to store products and sales in JSON files.
// NOTE: For production use a proper DB. This is a small demo fallback.

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const DB_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const SALES_FILE = path.join(DB_DIR, 'sales.json');
if(!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if(!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, '[]');
if(!fs.existsSync(SALES_FILE)) fs.writeFileSync(SALES_FILE, '[]');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../web')));

// util
const read = (file)=> JSON.parse(fs.readFileSync(file,'utf8')||'[]');
const write = (file,data)=> fs.writeFileSync(file, JSON.stringify(data, null, 2));

// API endpoints
app.get('/api/products', (req,res)=> res.json(read(PRODUCTS_FILE)));
app.post('/api/products', (req,res)=> {
  const products = read(PRODUCTS_FILE);
  const p = req.body;
  products.push(p);
  write(PRODUCTS_FILE, products);
  res.json(p);
});
app.get('/api/sales', (req,res)=> res.json(read(SALES_FILE)));
app.post('/api/sales', (req,res)=> {
  const sales = read(SALES_FILE);
  const s = req.body;
  s.id = Date.now();
  sales.push(s);
  write(SALES_FILE, sales);
  res.json(s);
});

const port = process.env.PORT || 4000;
app.listen(port, ()=> console.log('Server running on', port));

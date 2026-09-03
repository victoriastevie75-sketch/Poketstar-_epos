const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * Products Routes
 * Handles product catalog, inventory, and item management
 */

function getProductsPath() {
  const candidates = [
    path.join(__dirname, '../../products.json'),
    path.join(process.cwd(), 'products.json'),
    path.join(__dirname, '../../web/products.json')
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  
  return path.join(process.cwd(), 'products.json');
}

function loadProducts() {
  try {
    const productsPath = getProductsPath();
    if (fs.existsSync(productsPath)) {
      const data = fs.readFileSync(productsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading products:', err.message);
  }
  return [];
}

function saveProducts(products) {
  try {
    const productsPath = getProductsPath();
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving products:', err.message);
    return false;
  }
}

router.get('/', (req, res) => {
  const products = loadProducts();
  res.json({
    status: 'success',
    count: products.length,
    products
  });
});

router.get('/search', (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({
      status: 'error',
      message: 'Search query required'
    });
  }

  const products = loadProducts();
  const query = q.toLowerCase();
  const results = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.barcode && p.barcode.includes(query)) ||
    (p.category && p.category.toLowerCase().includes(query))
  );

  res.json({
    status: 'success',
    query: q,
    count: results.length,
    products: results
  });
});

router.get('/categories', (req, res) => {
  const products = loadProducts();
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  
  res.json({
    status: 'success',
    categories
  });
});

router.get('/:id', (req, res) => {
  const products = loadProducts();
  const product = products.find(p => p.id === req.params.id);
  
  if (!product) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  res.json({
    status: 'success',
    product
  });
});

router.post('/', (req, res) => {
  const { name, barcode, price, qty, category } = req.body;
  
  if (!name || !price) {
    return res.status(400).json({
      status: 'error',
      message: 'Name and price are required'
    });
  }

  const products = loadProducts();
  
  // Check if barcode already exists
  if (barcode && products.find(p => p.barcode === barcode)) {
    return res.status(409).json({
      status: 'error',
      message: 'Product with this barcode already exists'
    });
  }

  const newProduct = {
    id: Date.now().toString(),
    name,
    barcode: barcode || '',
    price: parseFloat(price),
    qty: parseInt(qty) || 0,
    category: category || 'Uncategorized',
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  
  if (saveProducts(products)) {
    res.status(201).json({
      status: 'success',
      message: 'Product created',
      product: newProduct
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to save product'
    });
  }
});

router.put('/:id', (req, res) => {
  const { name, barcode, price, qty, category } = req.body;
  const products = loadProducts();
  
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  const updated = {
    ...products[index],
    ...(name && { name }),
    ...(barcode && { barcode }),
    ...(price && { price: parseFloat(price) }),
    ...(qty !== undefined && { qty: parseInt(qty) }),
    ...(category && { category }),
    updatedAt: new Date().toISOString()
  };

  products[index] = updated;
  
  if (saveProducts(products)) {
    res.json({
      status: 'success',
      message: 'Product updated',
      product: updated
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update product'
    });
  }
});

router.delete('/:id', (req, res) => {
  const products = loadProducts();
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  const deleted = products.splice(index, 1)[0];
  
  if (saveProducts(products)) {
    res.json({
      status: 'success',
      message: 'Product deleted',
      product: deleted
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete product'
    });
  }
});

module.exports = router;
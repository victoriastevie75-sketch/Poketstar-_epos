const express = require('express');
const router = express.Router();
const { sanitizeString } = require('../middleware/security');
const { getOrgProducts, saveOrgProducts } = require('../services/tenant.service');

/**
 * Products Routes — Multi-Tenant Scoped
 * Handles isolated product catalog, inventory, and bulk imports per organization
 */

router.get('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const products = getOrgProducts(orgId);
  res.json({
    status: 'success',
    organizationId: orgId,
    count: products.length,
    products
  });
});

router.get('/search', (req, res) => {
  const orgId = req.orgId || 'default';
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({
      status: 'error',
      message: 'Search query required'
    });
  }

  const products = getOrgProducts(orgId);
  const query = q.toLowerCase();
  const results = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.barcode && p.barcode.includes(query)) ||
    (p.category && p.category.toLowerCase().includes(query))
  );

  res.json({
    status: 'success',
    organizationId: orgId,
    query: q,
    count: results.length,
    products: results
  });
});

router.get('/categories', (req, res) => {
  const orgId = req.orgId || 'default';
  const products = getOrgProducts(orgId);
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  
  res.json({
    status: 'success',
    organizationId: orgId,
    categories
  });
});

router.get('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const products = getOrgProducts(orgId);
  const product = products.find(p => p.id === req.params.id || p.barcode === req.params.id);
  
  if (!product) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  res.json({
    status: 'success',
    organizationId: orgId,
    product
  });
});

router.post('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const { name, barcode, sku, price, qty, quantity, cost, buyingPrice, category, taxRate } = req.body;
  
  const cleanName = sanitizeString(name || '', 120);
  if (!cleanName || (price === undefined && req.body.price === undefined)) {
    return res.status(400).json({
      status: 'error',
      message: 'Name and price are required'
    });
  }

  const products = getOrgProducts(orgId);
  const cleanBarcode = sanitizeString(barcode || sku || '', 60);
  
  // If product with exact same barcode or name exists, update it instead of failing with 409
  let existingIndex = -1;
  if (cleanBarcode && cleanBarcode !== '-') {
    existingIndex = products.findIndex(p => p.barcode === cleanBarcode || p.sku === cleanBarcode);
  }
  if (existingIndex === -1 && cleanName) {
    existingIndex = products.findIndex(p => p.name && p.name.trim().toLowerCase() === cleanName.toLowerCase());
  }

  const finalQty = Math.max(0, qty !== undefined ? parseInt(qty, 10) : (quantity !== undefined ? parseInt(quantity, 10) : 50));
  const finalPrice = Math.max(0, parseFloat(price) || 0);
  const finalCost = Math.max(0, cost !== undefined ? parseFloat(cost) : (buyingPrice !== undefined ? parseFloat(buyingPrice) : Math.round(finalPrice * 0.7)));
  const finalTax = Math.min(100, Math.max(0, taxRate !== undefined ? parseInt(taxRate, 10) : 16));
  const finalCat = sanitizeString(category || 'General', 50);

  if (existingIndex >= 0) {
    products[existingIndex] = {
      ...products[existingIndex],
      name: cleanName,
      barcode: cleanBarcode || products[existingIndex].barcode || `SKU-${Date.now()}`,
      price: finalPrice,
      buyingPrice: finalCost,
      cost: finalCost,
      qty: finalQty,
      quantity: finalQty,
      category: finalCat,
      taxRate: finalTax,
      updatedAt: new Date().toISOString()
    };

    saveOrgProducts(orgId, products);
    return res.json({
      status: 'success',
      organizationId: orgId,
      message: 'Product updated',
      product: products[existingIndex]
    });
  }

  const newProduct = {
    id: Date.now().toString(),
    name: cleanName,
    barcode: cleanBarcode || `SKU-${Date.now()}`,
    price: finalPrice,
    buyingPrice: finalCost,
    cost: finalCost,
    qty: finalQty,
    quantity: finalQty,
    category: finalCat,
    taxRate: finalTax,
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  
  if (saveOrgProducts(orgId, products)) {
    res.status(201).json({
      status: 'success',
      organizationId: orgId,
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

/**
 * Bulk Import / CSV Import Route (Scoped per Organization)
 */
router.post(['/bulk-import', '/import-csv'], (req, res) => {
  const orgId = req.orgId || 'default';
  const { items, products: incomingProducts, mode = 'merge', stockMode = 'replace' } = req.body || {};
  const listToImport = Array.isArray(items) ? items : (Array.isArray(incomingProducts) ? incomingProducts : (Array.isArray(req.body) ? req.body : null));

  if (!Array.isArray(listToImport) || listToImport.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'No valid products provided for bulk import'
    });
  }

  let currentProducts = mode === 'replace' ? [] : getOrgProducts(orgId);
  let addedCount = 0;
  let updatedCount = 0;

  // Build lookup maps for fast O(1) matching by barcode and lowercase name
  const barcodeIdxMap = new Map();
  const nameIdxMap = new Map();
  currentProducts.forEach((p, idx) => {
    if (p.barcode && p.barcode !== '-') {
      barcodeIdxMap.set(String(p.barcode).trim().toLowerCase(), idx);
    }
    if (p.name) {
      nameIdxMap.set(String(p.name).trim().toLowerCase(), idx);
    }
  });

  listToImport.forEach((rawItem, i) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    const cleanName = sanitizeString(rawItem.name || '', 120);
    if (!cleanName) return;

    const rawBarcode = sanitizeString(rawItem.barcode || rawItem.sku || '', 60);
    const cleanBarcode = rawBarcode && rawBarcode !== '-' ? rawBarcode : '';

    let existingIndex = -1;
    if (cleanBarcode && barcodeIdxMap.has(cleanBarcode.toLowerCase())) {
      existingIndex = barcodeIdxMap.get(cleanBarcode.toLowerCase());
    } else if (nameIdxMap.has(cleanName.toLowerCase())) {
      existingIndex = nameIdxMap.get(cleanName.toLowerCase());
    }

    const parsedPrice = Math.max(0, parseFloat(rawItem.price !== undefined ? rawItem.price : rawItem.retailPrice) || 0);
    const parsedBuyingPrice = Math.max(
      0,
      rawItem.buyingPrice !== undefined && rawItem.buyingPrice !== ''
        ? parseFloat(rawItem.buyingPrice)
        : (rawItem.cost !== undefined && rawItem.cost !== '' ? parseFloat(rawItem.cost) : Math.round(parsedPrice * 0.7))
    );
    const parsedQty = rawItem.qty !== undefined && rawItem.qty !== ''
      ? parseInt(rawItem.qty, 10)
      : (rawItem.quantity !== undefined && rawItem.quantity !== '' ? parseInt(rawItem.quantity, 10) : 50);
    const safeQty = isNaN(parsedQty) ? 50 : Math.max(0, parsedQty);
    const parsedTax = rawItem.taxRate !== undefined && rawItem.taxRate !== '' ? parseInt(rawItem.taxRate, 10) : 16;
    const finalTax = (parsedTax === 0 || parsedTax === 16) ? parsedTax : 16;
    const finalCat = sanitizeString(rawItem.category || 'General', 50) || 'General';

    if (existingIndex >= 0) {
      const existing = currentProducts[existingIndex];
      const finalBarcode = cleanBarcode || existing.barcode || `SKU-${Date.now()}-${i}`;
      const newQty = stockMode === 'add'
        ? Math.max(0, (parseInt(existing.qty, 10) || 0) + safeQty)
        : safeQty;
      const updatedProd = {
        ...existing,
        name: cleanName,
        barcode: finalBarcode,
        buyingPrice: isNaN(parsedBuyingPrice) ? (existing.buyingPrice || 0) : parsedBuyingPrice,
        price: parsedPrice > 0 ? parsedPrice : (existing.price || 0),
        qty: newQty,
        category: finalCat,
        taxRate: finalTax,
        _searchStr: `${cleanName} ${finalBarcode} ${finalCat}`.toLowerCase()
      };
      currentProducts[existingIndex] = updatedProd;
      if (finalBarcode && finalBarcode !== '-') {
        barcodeIdxMap.set(finalBarcode.toLowerCase(), existingIndex);
      }
      nameIdxMap.set(cleanName.toLowerCase(), existingIndex);
      updatedCount++;
    } else {
      const finalBarcode = cleanBarcode || `SKU-${Date.now()}-${i}`;
      const newProd = {
        name: cleanName,
        barcode: finalBarcode,
        buyingPrice: isNaN(parsedBuyingPrice) ? Math.round(parsedPrice * 0.7) : parsedBuyingPrice,
        price: parsedPrice,
        qty: safeQty,
        category: finalCat,
        taxRate: finalTax,
        _searchStr: `${cleanName} ${finalBarcode} ${finalCat}`.toLowerCase()
      };
      const newIdx = currentProducts.length;
      currentProducts.push(newProd);
      if (finalBarcode && finalBarcode !== '-') {
        barcodeIdxMap.set(finalBarcode.toLowerCase(), newIdx);
      }
      nameIdxMap.set(cleanName.toLowerCase(), newIdx);
      addedCount++;
    }
  });

  if (saveOrgProducts(orgId, currentProducts)) {
    return res.json({
      status: 'success',
      organizationId: orgId,
      message: `CSV Import completed for organization: ${addedCount} added, ${updatedCount} updated`,
      addedCount,
      updatedCount,
      totalCount: currentProducts.length,
      products: currentProducts
    });
  } else {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to persist imported inventory products'
    });
  }
});

router.put('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const { name, barcode, price, qty, category } = req.body;
  const products = getOrgProducts(orgId);
  
  const index = products.findIndex(p => p.id === req.params.id || p.barcode === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  const updated = {
    ...products[index],
    ...(name && { name: sanitizeString(name) }),
    ...(barcode && { barcode: sanitizeString(barcode) }),
    ...(price !== undefined && { price: parseFloat(price) }),
    ...(qty !== undefined && { qty: parseInt(qty, 10) }),
    ...(category && { category: sanitizeString(category) }),
    updatedAt: new Date().toISOString()
  };

  products[index] = updated;
  
  if (saveOrgProducts(orgId, products)) {
    res.json({
      status: 'success',
      organizationId: orgId,
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
  const orgId = req.orgId || 'default';
  const products = getOrgProducts(orgId);
  const index = products.findIndex(p => p.id === req.params.id || p.barcode === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      status: 'error',
      message: 'Product not found'
    });
  }

  const deleted = products.splice(index, 1)[0];
  
  if (saveOrgProducts(orgId, products)) {
    res.json({
      status: 'success',
      organizationId: orgId,
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

const express = require('express');
const router = express.Router();
const {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  exportOrgBackup,
  importOrgBackup,
  getOrgProducts,
  getOrgSales,
  getOrgUsers,
  getOrgSettings,
  saveOrgSettings
} = require('../services/tenant.service');
const { sanitizeString } = require('../middleware/security');

/**
 * Organizations & Multi-Tenant Management API
 */

// GET all organizations with statistics
router.get('/', (req, res) => {
  try {
    const orgs = getOrganizations();
    res.json({
      status: 'success',
      count: orgs.length,
      currentOrgId: req.orgId || 'default',
      organizations: orgs
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET current active organization details
router.get('/current', (req, res) => {
  try {
    const org = getOrganization(req.orgId || 'default');
    const settings = getOrgSettings(req.orgId || 'default');
    res.json({
      status: 'success',
      organization: org,
      settings
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET specific organization by ID
router.get('/:id', (req, res) => {
  try {
    const org = getOrganization(req.params.id);
    res.json({
      status: 'success',
      organization: org
    });
  } catch (err) {
    res.status(404).json({ status: 'error', message: err.message });
  }
});

// POST create a new organization
router.post('/', (req, res) => {
  try {
    const {
      name,
      code,
      businessType,
      currency,
      currencySymbol,
      phone,
      email,
      address,
      taxPin,
      vatRate,
      receiptHeader,
      receiptFooter,
      adminPin,
      cloneFromOrgId
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Organization name is required.'
      });
    }

    const created = createOrganization({
      name: sanitizeString(name),
      code: code ? sanitizeString(code) : undefined,
      businessType: businessType ? sanitizeString(businessType) : undefined,
      currency: currency ? sanitizeString(currency) : 'KES',
      currencySymbol: currencySymbol ? sanitizeString(currencySymbol) : 'KSh',
      phone: phone ? sanitizeString(phone) : '',
      email: email ? sanitizeString(email) : '',
      address: address ? sanitizeString(address) : '',
      taxPin: taxPin ? sanitizeString(taxPin) : '',
      vatRate: vatRate !== undefined ? Number(vatRate) : 16,
      receiptHeader: receiptHeader ? sanitizeString(receiptHeader) : undefined,
      receiptFooter: receiptFooter ? sanitizeString(receiptFooter) : undefined,
      adminPin: adminPin ? sanitizeString(adminPin) : '1234',
      cloneFromOrgId: cloneFromOrgId ? sanitizeString(cloneFromOrgId) : undefined
    });

    res.status(201).json({
      status: 'success',
      message: `Organization '${created.name}' created successfully with isolated database workspace.`,
      organization: created
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PUT update organization profile & details
router.put('/:id', (req, res) => {
  try {
    const updated = updateOrganization(req.params.id, req.body);
    res.json({
      status: 'success',
      message: `Organization '${updated.name}' updated successfully.`,
      organization: updated
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// DELETE organization
router.delete('/:id', (req, res) => {
  try {
    const result = deleteOrganization(req.params.id);
    res.json({
      status: 'success',
      message: result.message
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST switch organization cookie
router.post('/:id/switch', (req, res) => {
  try {
    const org = getOrganization(req.params.id);
    res.cookie('pos_org_id', org.id, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    res.json({
      status: 'success',
      message: `Switched active organization to '${org.name}'.`,
      organization: org
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// GET export full organization backup
router.get('/:id/export', (req, res) => {
  try {
    const backup = exportOrgBackup(req.params.id);
    const filename = `poketstar_org_${backup.organization.id}_backup_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST import organization backup
router.post('/:id/import', (req, res) => {
  try {
    const result = importOrgBackup(req.params.id, req.body);
    res.json({
      status: 'success',
      message: result.message
    });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// GET / PUT organization settings
router.get('/:id/settings', (req, res) => {
  try {
    const settings = getOrgSettings(req.params.id);
    res.json({
      status: 'success',
      settings
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id/settings', (req, res) => {
  try {
    saveOrgSettings(req.params.id, req.body);
    res.json({
      status: 'success',
      message: 'Organization settings updated successfully.',
      settings: getOrgSettings(req.params.id)
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

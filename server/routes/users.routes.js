const express = require('express');
const router = express.Router();
const { sanitizeString } = require('../middleware/security');
const { getOrgUsers, saveOrgUsers } = require('../services/tenant.service');

/**
 * Users Registry Routes — Multi-Tenant Scoped
 * Handles isolated staff, cashiers, roles, and PIN management per organization
 */

// GET all users for current organization
router.get('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const users = getOrgUsers(orgId);
  res.json({
    status: 'success',
    organizationId: orgId,
    total: users.length,
    users
  });
});

// POST new user registration
router.post('/', (req, res) => {
  const orgId = req.orgId || 'default';
  const { username, name, role, pin, tillId, status, phone, email, permissions } = req.body;
  const cleanUsername = sanitizeString(username || '', 50).toLowerCase();
  const cleanName = sanitizeString(name || '', 100);

  if (!cleanUsername || !cleanName) {
    return res.status(400).json({ error: 'Username and Full Name are required.' });
  }

  const users = getOrgUsers(orgId);
  const existing = users.find(u => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(409).json({ error: `Username "${cleanUsername}" already exists in this organization.` });
  }

  const cleanRole = ['admin', 'manager', 'cashier', 'accountant', 'inventory'].includes(role) ? role : 'cashier';
  const cleanPin = pin ? sanitizeString(String(pin), 30) : '1234';
  const cleanTillId = sanitizeString(tillId || 'Till-01', 30);
  const cleanStatus = status === 'suspended' ? 'suspended' : 'active';
  const cleanPhone = sanitizeString(phone || '', 30);
  const cleanEmail = sanitizeString(email || '', 100);

  const cleanPermissions = Array.isArray(permissions) 
    ? permissions.map(p => sanitizeString(String(p), 30)).filter(Boolean)
    : ['sales'];

  const newUser = {
    id: `USR-${orgId}-${Date.now().toString().slice(-6)}`,
    username: cleanUsername,
    name: cleanName,
    role: cleanRole,
    pin: cleanPin,
    tillId: cleanTillId,
    status: cleanStatus,
    phone: cleanPhone,
    email: cleanEmail,
    permissions: cleanPermissions,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  if (saveOrgUsers(orgId, users)) {
    res.status(201).json({
      status: 'success',
      organizationId: orgId,
      message: `User ${cleanName} (${cleanRole}) created successfully.`,
      user: newUser
    });
  } else {
    res.status(500).json({ error: 'Failed to save new user to database.' });
  }
});

// PUT update user
router.put('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const users = getOrgUsers(orgId);
  const userIdx = users.findIndex(u => u.id === req.params.id || u.username.toLowerCase() === req.params.id.toLowerCase());

  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found in this organization.' });
  }

  const target = users[userIdx];
  const { name, role, pin, tillId, status, phone, email, permissions } = req.body;

  if (name) target.name = sanitizeString(name, 100);
  if (role && ['admin', 'manager', 'cashier', 'accountant', 'inventory'].includes(role)) target.role = role;
  if (pin) target.pin = sanitizeString(String(pin), 30);
  if (tillId) target.tillId = sanitizeString(tillId, 30);
  if (status && ['active', 'suspended'].includes(status)) target.status = status;
  if (phone !== undefined) target.phone = sanitizeString(phone, 30);
  if (email !== undefined) target.email = sanitizeString(email, 100);
  if (Array.isArray(permissions)) target.permissions = permissions.map(p => sanitizeString(String(p), 30)).filter(Boolean);
  target.updatedAt = new Date().toISOString();

  users[userIdx] = target;
  if (saveOrgUsers(orgId, users)) {
    res.json({
      status: 'success',
      organizationId: orgId,
      message: `User ${target.name} updated successfully.`,
      user: target
    });
  } else {
    res.status(500).json({ error: 'Failed to update user in database.' });
  }
});

// DELETE user
router.delete('/:id', (req, res) => {
  const orgId = req.orgId || 'default';
  const users = getOrgUsers(orgId);
  const userIdx = users.findIndex(u => u.id === req.params.id || u.username.toLowerCase() === req.params.id.toLowerCase());

  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const target = users[userIdx];
  if (target.username.toLowerCase() === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the only administrative account in this organization.' });
  }

  users.splice(userIdx, 1);
  if (saveOrgUsers(orgId, users)) {
    res.json({
      status: 'success',
      organizationId: orgId,
      message: `User ${target.name} removed successfully.`
    });
  } else {
    res.status(500).json({ error: 'Failed to remove user from database.' });
  }
});

module.exports = router;

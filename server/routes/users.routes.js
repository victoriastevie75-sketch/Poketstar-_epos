const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sanitizeString, sanitizeHtml } = require('../middleware/security');

const usersFilePath = path.join(__dirname, '../../users.json');

function getUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('[Users API] Error reading users.json:', err.message);
  }
  return [
    {
      id: 'USR-001',
      username: 'admin',
      name: 'Stevie Administrator',
      role: 'admin',
      pin: '1234',
      tillId: 'Till-01',
      status: 'active',
      phone: '+254700000001',
      email: 'admin@poketstar.com',
      permissions: ['sales', 'discounts', 'refunds', 'inventory', 'reports', 'users'],
      createdAt: new Date().toISOString()
    }
  ];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    const webUsersPath = path.join(__dirname, '../../web/users.json');
    if (fs.existsSync(path.dirname(webUsersPath))) {
      fs.writeFileSync(webUsersPath, JSON.stringify(users, null, 2), 'utf8');
    }
    return true;
  } catch (err) {
    console.error('[Users API] Error saving users.json:', err.message);
    return false;
  }
}

// GET all users (registry)
router.get('/', (req, res) => {
  const users = getUsers();
  res.json({
    status: 'success',
    total: users.length,
    users
  });
});

// POST new user registration with strict sanitization
router.post('/', (req, res) => {
  const { username, name, role, pin, tillId, status, phone, email, permissions } = req.body;
  const cleanUsername = sanitizeString(username || '', 50).toLowerCase();
  const cleanName = sanitizeString(name || '', 100);

  if (!cleanUsername || !cleanName) {
    return res.status(400).json({ error: 'Username and Full Name are required.' });
  }

  const users = getUsers();
  const existing = users.find(u => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(409).json({ error: `Username "${cleanUsername}" already exists in the registry.` });
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
    id: `USR-${Date.now().toString().slice(-6)}`,
    username: cleanUsername,
    name: cleanName,
    role: cleanRole,
    pin: cleanPin,
    tillId: cleanTillId,
    status: cleanStatus,
    phone: cleanPhone,
    email: cleanEmail,
    permissions: cleanPermissions,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  users.push(newUser);
  saveUsers(users);

  res.status(201).json({
    status: 'success',
    message: `User ${newUser.name} registered successfully.`,
    user: newUser
  });
});

// PUT update user
router.put('/:id', (req, res) => {
  const cleanId = sanitizeString(req.params.id || '', 50);
  const users = getUsers();
  const index = users.findIndex(u => u.id === cleanId || u.username === cleanId);

  if (index === -1) {
    return res.status(404).json({ error: 'User not found in registry.' });
  }

  const existing = users[index];
  const { username, name, role, pin, tillId, status, phone, email, permissions } = req.body;

  users[index] = {
    ...existing,
    name: name !== undefined ? sanitizeString(name, 100) : existing.name,
    username: username !== undefined ? sanitizeString(username, 50).toLowerCase() : existing.username,
    role: role !== undefined && ['admin', 'manager', 'cashier', 'accountant', 'inventory'].includes(role) ? role : existing.role,
    pin: pin !== undefined ? sanitizeString(String(pin), 30) : existing.pin,
    tillId: tillId !== undefined ? sanitizeString(tillId, 30) : existing.tillId,
    status: status !== undefined ? (status === 'suspended' ? 'suspended' : 'active') : existing.status,
    phone: phone !== undefined ? sanitizeString(phone, 30) : existing.phone,
    email: email !== undefined ? sanitizeString(email, 100) : existing.email,
    permissions: Array.isArray(permissions) ? permissions.map(p => sanitizeString(String(p), 30)) : existing.permissions,
    updatedAt: new Date().toISOString()
  };

  saveUsers(users);

  res.json({
    status: 'success',
    message: 'User registry record updated.',
    user: users[index]
  });
});

// DELETE user
router.delete('/:id', (req, res) => {
  const cleanId = sanitizeString(req.params.id || '', 50);
  let users = getUsers();
  const userToDelete = users.find(u => u.id === cleanId || u.username === cleanId);

  if (!userToDelete) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (userToDelete.username === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the primary Administrator account.' });
  }

  users = users.filter(u => u.id !== userToDelete.id);
  saveUsers(users);

  res.json({
    status: 'success',
    message: `User ${userToDelete.name} deleted from registry.`
  });
});

// POST authenticate PIN / quick switch
router.post('/auth/pin', (req, res) => {
  const { pin, tillId } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN code is required.' });
  }

  const users = getUsers();
  const matchedUser = users.find(u => String(u.pin) === String(pin).trim() && u.status === 'active');

  if (!matchedUser) {
    return res.status(401).json({ error: 'Invalid PIN code or user account inactive.' });
  }

  matchedUser.lastLogin = new Date().toISOString();
  saveUsers(users);

  res.json({
    status: 'success',
    message: `Welcome ${matchedUser.name}!`,
    user: {
      id: matchedUser.id,
      username: matchedUser.username,
      name: matchedUser.name,
      role: matchedUser.role,
      tillId: tillId || matchedUser.tillId || 'Till-01',
      permissions: matchedUser.permissions
    }
  });
});

module.exports = router;

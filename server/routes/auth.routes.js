const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authLimiter, sanitizeString, generateSecureToken, verifySecureToken } = require('../middleware/security');

const usersFilePath = path.join(__dirname, '../../users.json');

function getUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('[Auth API] Error reading users.json:', err.message);
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
      permissions: ['sales', 'discounts', 'refunds', 'inventory', 'reports', 'users']
    }
  ];
}

/**
 * Authentication Routes
 * Handles user login, logout, and session verification with brute-force defense
 */

router.post('/login', authLimiter, (req, res) => {
  const { username, name, password, pin } = req.body;
  const rawId = username || name || '';
  const identifier = sanitizeString(rawId, 50).toLowerCase();
  const secret = (password !== undefined ? password : pin !== undefined ? pin : '').toString().trim();
  
  if (!identifier || !secret) {
    return res.status(400).json({ 
      error: 'Username/Name and Password/PIN are required' 
    });
  }

  const users = getUsers();
  const matchedUser = users.find(u => {
    const uName = (u.name || '').toLowerCase();
    const uUsername = (u.username || '').toLowerCase();
    const isIdMatch = uUsername === identifier || uName === identifier;
    const isSecretMatch = String(u.pin || u.password || '').trim() === secret;
    return isIdMatch && isSecretMatch;
  });

  if (!matchedUser) {
    return res.status(401).json({
      error: 'Invalid operator credentials. Please verify your username and password/PIN.'
    });
  }

  if (matchedUser.status === 'suspended') {
    return res.status(403).json({
      error: 'Account is currently suspended. Please contact the administrator.'
    });
  }

  // Update last login timestamp
  matchedUser.lastLogin = new Date().toISOString();
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {}

  const userPayload = {
    id: matchedUser.id,
    username: matchedUser.username,
    name: matchedUser.name,
    role: matchedUser.role,
    tillId: matchedUser.tillId || 'Till-01',
    permissions: matchedUser.permissions || ['sales'],
    loginTime: matchedUser.lastLogin
  };

  const secureToken = generateSecureToken(userPayload);

  // Set secure auth cookie
  try {
    res.cookie('pos_auth_token', secureToken, {
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
      httpOnly: false, // allow client JS access for offline state sync
      path: '/'
    });
  } catch (e) {}

  res.json({
    status: 'success',
    message: `Welcome, ${matchedUser.name}!`,
    user: userPayload,
    token: secureToken
  });
});

router.post('/logout', (req, res) => {
  try {
    res.cookie('pos_auth_token', '', {
      maxAge: 0,
      sameSite: 'none',
      secure: true,
      path: '/'
    });
  } catch (e) {}

  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

router.get('/session', (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.pos_auth_token) {
    token = req.cookies.pos_auth_token;
  }

  if (token) {
    const verified = verifySecureToken(token);
    if (verified) {
      return res.json({
        status: 'active',
        authenticated: true,
        user: verified
      });
    }
  }

  res.json({
    status: 'active',
    authenticated: false
  });
});

module.exports = router;
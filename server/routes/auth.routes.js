const express = require('express');
const router = express.Router();

/**
 * Authentication Routes
 * Handles user login, logout, and session management
 */

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Username and password required' 
    });
  }

  // Simple validation (in production, use proper authentication)
  res.json({
    status: 'success',
    message: 'Login successful',
    user: {
      id: Date.now().toString(),
      username,
      role: 'cashier',
      loginTime: new Date().toISOString()
    },
    token: `token_${Date.now()}`
  });
});

router.post('/logout', (req, res) => {
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

router.get('/session', (req, res) => {
  res.json({
    status: 'active',
    user: {
      id: '1',
      username: 'cashier',
      role: 'cashier'
    }
  });
});

router.post('/verify', (req, res) => {
  const { token } = req.body;
  
  res.json({
    status: 'verified',
    valid: !!token,
    user: {
      id: '1',
      username: 'cashier'
    }
  });
});

module.exports = router;
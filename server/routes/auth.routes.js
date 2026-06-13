/**
 * User Management Routes
 * API endpoints for user CRUD, authentication, and profile management
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { verifyToken, requireRole, auditLog } = require('../middleware/auth.middleware');

// In-memory user storage (replace with database in production)
let users = [];

/**
 * POST /api/auth/register
 * Register a new user (admin only)
 */
router.post('/register', verifyToken, requireRole('admin'), auditLog, (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if email already exists
    if (users.some(u => u.email === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const newUser = authService.createUser({
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
    });

    users.push(newUser);

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', auditLog, (req, res) => {
  try {
    const { email, password } = req.body;

    const result = authService.authenticate(email, password, users);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', verifyToken, auditLog, (req, res) => {
  try {
    // Token is handled client-side; this endpoint can be used for server-side cleanup
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current logged-in user profile
 */
router.get('/me', verifyToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      phone: user.phone,
      active: user.active,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/auth/change-password
 * Change user password
 */
router.put('/change-password', verifyToken, auditLog, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    if (!authService.verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.passwordHash = authService.hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const userList = users.map(u => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim(),
      role: u.role,
      phone: u.phone,
      active: u.active,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    }));

    res.json({ users: userList, total: userList.length });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /api/users/:userId
 * Get specific user details (admin or self)
 */
router.get('/:userId', verifyToken, (req, res) => {
  try {
    const { userId } = req.params;

    // Allow access if admin or requesting own profile
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      phone: user.phone,
      active: user.active,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * PUT /api/users/:userId
 * Update user details (admin only)
 */
router.put('/:userId', verifyToken, requireRole('admin'), auditLog, (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, role, active } = req.body;

    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = authService.getRoles()[role.toUpperCase()] || user.role;
    if (active !== undefined) user.active = active;
    user.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        active: user.active,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:userId
 * Deactivate user (soft delete)
 */
router.delete('/:userId', verifyToken, requireRole('admin'), auditLog, (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting own account
    if (req.user.id === userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete
    user.active = false;
    user.updatedAt = new Date().toISOString();

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/users/:userId/permissions
 * Get user permissions
 */
router.get('/:userId/permissions', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const { userId } = req.params;
    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions = authService.getPermissions(user.role);

    res.json({
      role: user.role,
      permissions,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

module.exports = router;

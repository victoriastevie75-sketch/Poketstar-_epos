/**
 * User Authentication & Authorization Service
 * Handles login, registration, JWT tokens, and role-based access control
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// User roles and permissions
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  VIEWER: 'viewer',
};

const PERMISSIONS = {
  [ROLES.ADMIN]: [
    'view_dashboard',
    'manage_users',
    'manage_products',
    'manage_sales',
    'manage_reports',
    'manage_settings',
    'void_transactions',
    'process_refunds',
  ],
  [ROLES.MANAGER]: [
    'view_dashboard',
    'manage_products',
    'view_sales',
    'view_reports',
    'process_refunds',
  ],
  [ROLES.CASHIER]: [
    'view_dashboard',
    'process_sales',
    'view_cart',
    'process_payments',
  ],
  [ROLES.VIEWER]: [
    'view_dashboard',
    'view_reports',
  ],
};

class AuthService {
  /**
   * Hash password using SHA-256 (use bcrypt in production)
   * @param {string} password - Plain text password
   * @returns {string} Hashed password
   */
  hashPassword(password) {
    return crypto
      .createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'salt'))
      .digest('hex');
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Password hash
   * @returns {boolean} Match or not
   */
  verifyPassword(password, hash) {
    return this.hashPassword(password) === hash;
  }

  /**
   * Generate JWT token
   * @param {object} payload - Token payload (user data)
   * @param {string} expiresIn - Token expiry (default: 24h)
   * @returns {string} JWT token
   */
  generateToken(payload, expiresIn = JWT_EXPIRY) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {object|null} Decoded payload or null if invalid
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Create new user object
   * @param {object} data - User data
   * @returns {object} User object
   */
  createUser(data) {
    const { email, password, firstName, lastName, phone, role = ROLES.CASHIER } = data;

    if (!email || !password) {
      throw new Error('Email and password required');
    }

    return {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      passwordHash: this.hashPassword(password),
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: ROLES[role.toUpperCase()] || ROLES.CASHIER,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null,
    };
  }

  /**
   * Authenticate user and generate token
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {array} users - Users database
   * @returns {object} { success, token, user, error }
   */
  authenticate(email, password, users = []) {
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password required',
      };
    }

    const user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: 'User account is inactive',
      };
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
    });

    // Update last login
    user.lastLogin = new Date().toISOString();

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        phone: user.phone,
      },
    };
  }

  /**
   * Check if user has permission
   * @param {string} role - User role
   * @param {string} permission - Permission to check
   * @returns {boolean} Has permission or not
   */
  hasPermission(role, permission) {
    const rolePermissions = PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Get all permissions for a role
   * @param {string} role - User role
   * @returns {array} List of permissions
   */
  getPermissions(role) {
    return PERMISSIONS[role] || [];
  }

  /**
   * Get all roles
   * @returns {object} Roles object
   */
  getRoles() {
    return ROLES;
  }
}

module.exports = new AuthService();

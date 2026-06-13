/**
 * Authentication & Authorization Middleware
 * Protects routes and validates JWT tokens
 */

const authService = require('../services/auth.service');

/**
 * Verify JWT token from request headers
 * Middleware: Extracts and validates token
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Check if user has specific role(s)
 * @param {string|array} allowedRoles - Role(s) allowed to access
 * @returns {function} Middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

/**
 * Check if user has specific permission
 * @param {string} permission - Permission required
 * @returns {function} Middleware function
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = authService.hasPermission(req.user.role, permission);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

/**
 * Audit log middleware
 * Logs user actions for security and compliance
 */
function auditLog(req, res, next) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    user: req.user?.id || 'anonymous',
    method: req.method,
    path: req.path,
    ip: req.ip,
  };

  // Log after response
  const originalSend = res.send;
  res.send = function (data) {
    logEntry.statusCode = res.statusCode;
    console.log('[AUDIT]', JSON.stringify(logEntry));
    originalSend.call(this, data);
  };

  next();
}

module.exports = {
  verifyToken,
  requireRole,
  requirePermission,
  auditLog,
};

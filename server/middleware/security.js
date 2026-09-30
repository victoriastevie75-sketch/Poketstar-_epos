/**
 * Poket Star POS - Cybersecurity Hardening Middleware
 * Enterprise-grade defensive security layer protecting against OWASP Top 10 vulnerabilities
 */

const crypto = require('crypto');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || crypto.createHash('sha256').update('poketstar_pos_sec_key_2026').digest('hex');

// Zero-dependency in-memory rate limiter factory
function createRateLimiter({ windowMs = 60000, max = 100, message = {} }) {
  const hits = new Map();
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = req.ip || (req.connection && req.connection.remoteAddress) || 'local';
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      return res.status(429).json(message);
    }
    if (hits.size > 2000) {
      for (const [k, v] of hits.entries()) {
        if (now > v.resetAt) hits.delete(k);
      }
    }
    next();
  };
}

// 1. Rate Limiting Configurations
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 login requests per windowMs
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    error: 'Too many login attempts from this IP address. Please wait 15 minutes before trying again.'
  }
});

const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per minute
  message: {
    status: 'error',
    code: 'API_RATE_LIMIT_EXCEEDED',
    error: 'Too many API requests. Please slow down.'
  }
});

const printerLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 60, // Limit printer spooling to 60 jobs per minute
  message: {
    status: 'error',
    code: 'PRINTER_RATE_LIMIT_EXCEEDED',
    error: 'Print job rate limit reached. Please wait before spooling additional receipts.'
  }
});

// 2. Input Sanitization Helpers
function sanitizeString(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Strip angle brackets to prevent basic XSS
    .substring(0, maxLength);
}

function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;'
  };
  return input.replace(/[&<>"'/]/g, m => map[m]);
}

/**
 * Validates and sanitizes OS printer names to prevent Command Injection
 * Disallows characters: ; & | ` $ \ \n \r < > " '
 */
function sanitizePrinterName(name) {
  if (!name || typeof name !== 'string') return '';
  const cleaned = name.trim();
  // Only allow alphanumeric, space, hyphens, underscores, dots, hash, parentheses
  if (/^[a-zA-Z0-9_\-\.\#\(\)\s]+$/.test(cleaned) && cleaned.length <= 100) {
    return cleaned.replace(/["'`$\\]/g, '');
  }
  return '';
}

/**
 * Validates IPv4 address string to prevent network socket injection
 */
function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const num = parseInt(p, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === p;
  });
}

/**
 * Validates network port (1-65535)
 */
function isValidPort(port) {
  const num = parseInt(port, 10);
  return !isNaN(num) && num >= 1 && num <= 65535;
}

/**
 * Safe Path Resolution - Prevents Directory Traversal Attacks
 */
function resolveSafePath(baseDir, requestedFilename) {
  if (!requestedFilename || typeof requestedFilename !== 'string') return null;
  // Extract strictly the base file name
  const safeFilename = path.basename(requestedFilename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const targetPath = path.resolve(baseDir, safeFilename);
  const resolvedBase = path.resolve(baseDir);
  
  if (targetPath.startsWith(resolvedBase)) {
    return targetPath;
  }
  return null;
}

// 3. Cryptographic Token Generator and Verifier
function generateSecureToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  return `${header}.${body}.${signature}`;
}

function verifySecureToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, body, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  if (signature !== expectedSignature) return null;
  
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decoded;
  } catch (e) {
    return null;
  }
}

// 4. Authentication Middleware
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.pos_auth_token) {
    token = req.cookies.pos_auth_token;
  }
  
  if (!token) {
    // If no token, check for legacy token or pass as guest for public endpoints
    req.user = null;
    return next();
  }
  
  const user = verifySecureToken(token);
  req.user = user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      error: 'Authentication required. Please sign in.'
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      error: 'Administrative permissions required for this operation.'
    });
  }
  next();
}

// 5. Security Headers Setup (Zero-Dependency Helmet Equivalent)
function securityHeadersMiddleware(req, res, next) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  next();
}

module.exports = {
  JWT_SECRET,
  authLimiter,
  apiLimiter,
  printerLimiter,
  sanitizeString,
  sanitizeHtml,
  sanitizePrinterName,
  isValidIpv4,
  isValidPort,
  resolveSafePath,
  generateSecureToken,
  verifySecureToken,
  authenticateUser,
  requireAuth,
  requireAdmin,
  securityHeadersMiddleware
};

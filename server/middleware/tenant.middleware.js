const { sanitizeOrgId, getOrganization } = require('../services/tenant.service');

/**
 * Multi-Tenant Scoping Middleware
 * Resolves the active organization from:
 * 1. HTTP Header 'X-Organization-Id' or 'X-Tenant-Id'
 * 2. Query param ?orgId=... or ?tenantId=...
 * 3. Cookie 'pos_org_id'
 * 4. Request Body { organizationId: '...' }
 * 5. Default: 'default'
 */
function tenantMiddleware(req, res, next) {
  let rawOrgId = 
    req.headers['x-organization-id'] || 
    req.headers['x-tenant-id'] ||
    req.query.orgId ||
    req.query.tenantId ||
    (req.cookies && req.cookies['pos_org_id']) ||
    (req.body && (req.body.organizationId || req.body.orgId));

  const orgId = sanitizeOrgId(rawOrgId);
  req.orgId = orgId;
  
  // Expose in response headers for client verification
  res.setHeader('X-Organization-Id', orgId);

  // Lazy load organization details if needed
  req.getOrg = () => getOrganization(orgId);

  next();
}

module.exports = tenantMiddleware;

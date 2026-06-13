/**
 * Authentication Service Tests
 */

const authService = require('../../services/auth.service');

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash a password', () => {
      const password = 'testpassword123';
      const hash = authService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });

    it('should create same hash for same password', () => {
      const password = 'testpassword123';
      const hash1 = authService.hashPassword(password);
      const hash2 = authService.hashPassword(password);
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', () => {
      const password = 'testpassword123';
      const hash = authService.hashPassword(password);
      expect(authService.verifyPassword(password, hash)).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'testpassword123';
      const hash = authService.hashPassword(password);
      expect(authService.verifyPassword('wrongpassword', hash)).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const payload = { id: '123', email: 'test@example.com' };
      const token = authService.generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const payload = { id: '123', email: 'test@example.com' };
      const token = authService.generateToken(payload);
      const decoded = authService.verifyToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe('123');
    });

    it('should reject invalid token', () => {
      const decoded = authService.verifyToken('invalid.token.here');
      expect(decoded).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a user object', () => {
      const user = authService.createUser({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'cashier',
      });
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('cashier');
    });

    it('should throw error without email and password', () => {
      expect(() => {
        authService.createUser({});
      }).toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should check permissions correctly', () => {
      expect(authService.hasPermission('admin', 'manage_users')).toBe(true);
      expect(authService.hasPermission('cashier', 'manage_users')).toBe(false);
      expect(authService.hasPermission('cashier', 'process_sales')).toBe(true);
    });
  });
});

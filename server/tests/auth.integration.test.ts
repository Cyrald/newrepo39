import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_ID}.${process.env.REPL_SLUG}.repl.co`
  : 'http://localhost:5000';

describe('JWT Authentication Integration Tests', () => {
  let accessToken: string;
  let refreshTokenCookie: string;
  let testUser: { email: string; password: string };

  beforeAll(() => {
    testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!@#',
    };
  });

  it('should register a new user and return access token', async () => {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('user');
    expect(data.user.email).toBe(testUser.email);
    
    accessToken = data.accessToken;
    
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('refreshToken');
    refreshTokenCookie = cookies || '';
  });

  it('should access protected route with access token', async () => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.email).toBe(testUser.email);
  });

  it('should reject access without token', async () => {
    const response = await fetch(`${API_BASE}/api/auth/me`);
    expect(response.status).toBe(401);
  });

  it('should reject access with invalid token', async () => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });
    expect(response.status).toBe(401);
  });

  it('should refresh access token using refresh token', async () => {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': refreshTokenCookie,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('accessToken');
    
    const newAccessToken = data.accessToken;
    expect(newAccessToken).not.toBe(accessToken);
    accessToken = newAccessToken;
  });

  it('should login with credentials', async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('accessToken');
    expect(data.user.email).toBe(testUser.email);
  });

  it('should reject login with wrong password', async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword123',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should change password and invalidate all sessions', async () => {
    const response = await fetch(`${API_BASE}/api/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword: 'NewTest123!@#',
      }),
    });

    expect(response.status).toBe(200);
    
    testUser.password = 'NewTest123!@#';
  });

  it('should reject old access token after password change', async () => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(401);
  });

  it('should login with new password after password change', async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    accessToken = data.accessToken;
    refreshTokenCookie = response.headers.get('set-cookie') || '';
  });

  it('should logout and invalidate session', async () => {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': refreshTokenCookie,
      },
    });

    expect(response.status).toBe(200);
  });

  it('should reject access after logout', async () => {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(response.status).toBe(401);
  });

  it('should reject refresh after logout', async () => {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': refreshTokenCookie,
      },
    });

    expect(response.status).toBe(401);
  });
});

console.log('JWT Integration Tests - Manual Testing Guide:');
console.log('1. Register: POST /api/auth/register');
console.log('2. Login: POST /api/auth/login');
console.log('3. Get user: GET /api/auth/me (with Authorization header)');
console.log('4. Refresh: POST /api/auth/refresh (cookies auto-sent)');
console.log('5. Logout: POST /api/auth/logout (with Authorization header)');
console.log('6. Change password: PUT /api/auth/password (with Authorization header)');

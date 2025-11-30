#!/usr/bin/env node

/**
 * Backend Integration Test
 * 
 * Tests all backend endpoints to ensure they're working correctly.
 * Run with: node apps/backend/test-integration.mjs
 */

const BASE_URL = 'http://localhost:3001';

const testEndpoint = async (name, url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${name}`);
      return { success: true, data };
    } else {
      console.log(`❌ ${name}: ${data.error?.message || 'Unknown error'}`);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return { success: false, error };
  }
};

const testTRPCQuery = async (name, procedure) => {
  const url = `${BASE_URL}/trpc/${procedure}`;
  return testEndpoint(name, url);
};

const testTRPCMutation = async (name, procedure, input) => {
  const url = `${BASE_URL}/trpc/${procedure}`;
  return testEndpoint(name, url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

const runTests = async () => {
  console.log('🧪 Testing Backend Integration\n');
  console.log('=' .repeat(50));
  
  // Health checks
  console.log('\n📋 Health Endpoints:');
  await testTRPCQuery('health.check', 'health.check');
  await testTRPCQuery('health.ping (no message)', 'health.ping');
  
  // Auth endpoints
  console.log('\n🔐 Auth Endpoints:');
  
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123!@#';
  
  // Register
  const registerResult = await testTRPCMutation('auth.register', 'auth.register', {
    email: testEmail,
    password: testPassword,
    name: 'Test User',
  });
  
  let sessionCookie = null;
  if (registerResult.success) {
    // Extract session cookie (would be in headers in real test)
    console.log('  ℹ️  User registered successfully');
  }
  
  // Try to register same email (should fail)
  await testTRPCMutation('auth.register (duplicate email)', 'auth.register', {
    email: testEmail,
    password: testPassword,
  });
  
  // Login
  const loginResult = await testTRPCMutation('auth.login', 'auth.login', {
    email: testEmail,
    password: testPassword,
  });
  
  // Login with wrong password (should fail)
  await testTRPCMutation('auth.login (wrong password)', 'auth.login', {
    email: testEmail,
    password: 'WrongPassword123',
  });
  
  // Get current user (requires session)
  await testTRPCQuery('auth.me (unauthenticated)', 'auth.me');
  
  console.log('\n💼 Wallet Endpoints:');
  await testTRPCQuery('wallet.list (unauthenticated)', 'wallet.list');
  
  console.log('\n📊 Trading Endpoints:');
  await testTRPCQuery('trading.getOrders (unauthenticated)', 'trading.getOrders');
  await testTRPCQuery('trading.getPositions (unauthenticated)', 'trading.getPositions');
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ Integration tests completed!\n');
  console.log('Note: Authenticated endpoints require valid session cookies.');
  console.log('Use Postman or similar tool to test with authentication.\n');
};

// Run tests
runTests().catch(console.error);

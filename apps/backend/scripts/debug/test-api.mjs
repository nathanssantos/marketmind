const BASE_URL = 'http://localhost:3001/trpc';

const testHealthPing = async () => {
    console.log('\n🧪 Testing health.ping...');
    const response = await fetch(`${BASE_URL}/health.ping`);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
};

const testHealthCheck = async () => {
    console.log('\n🧪 Testing health.check...');
    const response = await fetch(`${BASE_URL}/health.check`);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
};

const testAuthRegister = async () => {
    console.log('\n🧪 Testing auth.register...');
    const payload = {
        email: 'test@example.com',
        password: 'Test123!@#',
        name: 'Test User',
    };

    const response = await fetch(`${BASE_URL}/auth.register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
};

const runTests = async () => {
    console.log('🚀 Starting API tests...\n');

    try {
        await testHealthPing();
        await testHealthCheck();
        await testAuthRegister();

        console.log('\n✅ All tests completed!');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
};

runTests();

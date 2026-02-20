import axios from 'axios';

const BASE_URL = 'http://localhost:3000'; // Adjust if running on a different port

async function testEndpoint(path) {
    console.log(`\n--- Testing ${path} ---`);
    try {
        const response = await axios.get(`${BASE_URL}${path}`, {
            headers: { 'Accept': 'text/markdown' }
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`x-markdown-tokens: ${response.headers['x-markdown-tokens']}`);
        console.log(`Preview:\n${response.data.substring(0, 200)}...`);

        if (response.headers['content-type']?.includes('text/markdown')) {
            console.log('✅ SUCCESS: Markdown received');
        } else {
            console.log('❌ FAILURE: Incorrect Content-Type');
        }
    } catch (err) {
        console.error(`❌ ERROR: ${err.message}`);
    }
}

async function runTests() {
    await testEndpoint('/');
    await testEndpoint('/briefing');
    await testEndpoint('/papers.html');
}

runTests();

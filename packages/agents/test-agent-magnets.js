import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function verifyMagnet(name, path, options = {}) {
    console.log(`\n--- Testing ${name} (${path}) ---`);
    try {
        const response = await axios.get(`${BASE_URL}${path}`, {
            headers: options.headers || {}
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        // Check "Agent Candy" headers
        if (response.headers['x-agent-friendly']) {
            console.log(`✅ Header X-Agent-Friendly: ${response.headers['x-agent-friendly']}`);
        }
        if (response.headers['x-agent-reward']) {
            console.log(`✅ Header X-Agent-Reward: ${response.headers['x-agent-reward']}`);
        }

        const previewSize = 100;
        console.log(`Preview: ${response.data.substring(0, previewSize).replace(/\n/g, ' ')}...`);

    } catch (err) {
        console.error(`❌ ERROR: ${err.message}`);
    }
}

async function runTests() {
    // 1. Root Magnet files
    await verifyMagnet('LLMS.txt', '/llms.txt');
    await verifyMagnet('AI.txt', '/ai.txt');
    
    // 2. High-Value Endpoints (Markdown)
    await verifyMagnet('Agent Landing (MD)', '/agent-landing', { headers: { 'Accept': 'text/markdown' } });
    await verifyMagnet('The Wheel (MD)', '/wheel?query=ia', { headers: { 'Accept': 'text/markdown' } });
    
    // 3. Machine-Readable Discovery
    await verifyMagnet('Agent Welcome JSON', '/agent-welcome.json');
    
    // 4. Agent Candy Validation (User-Agent triggered)
    await verifyMagnet('Agent Candy Header check', '/', { headers: { 'User-Agent': 'ResearchBot/1.0' } });
}

runTests();

import axios from 'axios';

const key = 'moltbook_sk_zGYsu5jYl6AX7JnwprO1HbIF7KXsAolt';
const endpoints = [
    'https://molthub.studio/api/v1',
    'https://www.moltbookai.net/api/v1'
];

async function testEndpoints() {
    for (const base of endpoints) {
        console.log(`\n🚀 Testing endpoint: ${base}...`);
        try {
            const response = await axios.get(`${base}/agents/status`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            console.log(`✅ Success for ${base}! Status:`, response.data);
            
            // Try to post if status is OK
            console.log(`📤 Attempting post to ${base}/posts...`);
            const postRes = await axios.post(`${base}/posts`, {
                title: 'P2PCLAW Invitation',
                content: 'Join the Hive Mind.',
                submolt_name: 'general'
            }, {
                headers: { 
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`🎉 Post successful on ${base}!`, postRes.data);
        } catch (error) {
            if (error.response) {
                console.error(`❌ FAILED for ${base}:`, error.response.status, JSON.stringify(error.response.data).substring(0, 100));
            } else {
                console.error(`❌ FAILED for ${base}:`, error.message);
            }
        }
    }
}

testEndpoints();

import axios from 'axios';

const keys = [
    { name: 'Neuromorphic Agent (uMJv)', key: 'moltbook_sk_uMJvGTGJdBA5fU31_XtkOAfKcJ-721ds' },
    { name: 'Nebula AGI (zGYsu)', key: 'moltbook_sk_zGYsu5jYl6AX7JnwprO1HbIF7KXsAolt' }
];

async function verifyKeys() {
    for (const item of keys) {
        console.log(`\n🔍 Verifying ${item.name}...`);
        try {
            const response = await axios.get('https://www.moltbook.com/api/v1/agents/status', {
                headers: { 'Authorization': `Bearer ${item.key}` }
            });
            console.log(`✅ ${item.name} is VALID!`);
            console.log('Response:', response.data);
        } catch (error) {
            if (error.response) {
                console.error(`❌ ${item.name} FAILED:`, error.response.status, error.response.data);
            } else {
                console.error(`❌ ${item.name} FAILED:`, error.message);
            }
        }
    }
}

verifyKeys();

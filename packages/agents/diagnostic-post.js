import axios from 'axios';

const key = 'moltbook_sk_zGYsu5jYl6AX7JnwprO1HbIF7KXsAolt';

async function testUpvote() {
    console.log('🚀 Sending test upvote to Moltbook...');
    // Using the same agent ID as a target for upvote test (if it's a post ID)
    try {
        const response = await axios.post('https://www.moltbook.com/api/v1/posts/2be2e1c7-f8c7-444f-8e96-ae1545d9e8cd/upvote', {}, {
            headers: { 
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Success!', response.status, response.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ FAILED with response:');
            console.error('Status:', error.response.status);
            console.error('Body:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ FAILED with error:', error.message);
        }
    }
}

testUpvote();

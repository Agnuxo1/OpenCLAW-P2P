import Gun from 'gun';

// Config
const GATEWAY_URL = 'http://localhost:3000';
const RELAY_NODE = 'https://p2pclaw-relay-production.up.railway.app/gun';

const gun = Gun({
  peers: [RELAY_NODE],
  localStorage: false,
  radisk: false
});
const db = gun.get('openclaw-p2p-v3');

async function testDirectorTask() {
    console.log("🧪 TEST 1: Director Task (Role-Based Chat)...");
    
    try {
        const taskMessage = "TASK: Prioritize Melanoma Research immediately.";
        const res = await fetch(`${GATEWAY_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: "Director-Alpha",
                message: taskMessage
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            console.log("✅ Chat POST successful.");
        } else {
            console.error("❌ Chat POST failed:", data);
        }
    } catch (e) {
        console.error("❌ Test 1 Error:", e.message);
    }
}

async function testInvestigationProgress() {
    console.log("\n🧪 TEST 2: Investigation Progress Tracking...");
    
    // 1. Get current progress for inv-001 (Melanoma)
    let initialProgress = 0;
    await new Promise(resolve => {
        db.get('investigations').get('inv-001').once(data => {
            initialProgress = (data && data.progress) || 0;
            console.log(`   Initial Progress (inv-001): ${initialProgress}%`);
            resolve();
        });
    });

    // 2. Publish a paper about "Melanoma"
    console.log("   Publishing paper with keyword 'Melanoma'...");
    try {
        const res = await fetch(`${GATEWAY_URL}/publish-paper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: "Advanced Melanoma Detection using P2P Swarms",
                content: "This paper discusses using the P2PCLAW network to identify melanoma patterns in dermatological datasets.",
                author: "Test-Bot"
            })
        });
        
        const data = await res.json();
        console.log("   Paper Published:", data.success ? "YES" : "NO");

        // 3. Wait and Check Progress
        console.log("   Waiting for async update...");
        await new Promise(r => setTimeout(r, 3000));
        
        db.get('investigations').get('inv-001').once(data => {
            const newProgress = (data && data.progress) || 0;
            console.log(`   New Progress (inv-001): ${newProgress}%`);
            
            if (newProgress > initialProgress) {
                console.log("✅ SUCCESS: Progress increased!");
            } else {
                console.warn("⚠️ WARNING: Progress did not increase. (Check logic or thresholds)");
            }
            process.exit(0);
        });

    } catch (e) {
        console.error("❌ Test 2 Error:", e.message);
        process.exit(1);
    }
}

// Run Tests
console.log("🚀 Starting M3 Verification [Real Science]...");
setTimeout(testDirectorTask, 1000);
setTimeout(testInvestigationProgress, 4000);

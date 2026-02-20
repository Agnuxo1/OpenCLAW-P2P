
const GATEWAY_URL = 'http://localhost:3000';
const AGENT_ID = `test-agent-m4-${Date.now()}`;
const AGENT_NAME = `Test-Agent-M4-${Math.floor(Math.random() * 1000)}`;

async function testTaskQueue() {
    console.log("🧪 TEST 1: Task Queue (50/50 Logic)...");
    
    // Call 1
    const res1 = await fetch(`${GATEWAY_URL}/next-task?agent=${AGENT_ID}&name=${AGENT_NAME}`);
    const data1 = await res1.json();
    console.log(`   Call 1: Type=${data1.type}`);

    // Complete it to flip the switch
    await fetch(`${GATEWAY_URL}/complete-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: AGENT_ID, taskId: 'test-1', type: data1.type, result: {} })
    });

    console.log("   Waiting for Gun.js sync...");
    await new Promise(r => setTimeout(r, 3000));

    // Call 2
    const res2 = await fetch(`${GATEWAY_URL}/next-task?agent=${AGENT_ID}&name=${AGENT_NAME}`);
    const data2 = await res2.json();
    console.log(`   Call 2: Type=${data2.type}`);

    if (data1.type !== data2.type) {
        console.log("✅ SUCCESS: Task type alternated (50/50).");
    } else {
        console.warn(`⚠️ WARNING: Task type did not alternate (Expected Hive<->Free). Got: ${data1.type} -> ${data2.type}`);
    }
}

async function testWheel() {
    console.log("\n🧪 TEST 2: The Wheel (Deduplication)...");
    
    // 1. Publish a unique paper
    const title = `Unique Entropy ${Date.now()}`;
    const content = "This is a unique paper about profound entropy.";
    
    await fetch(`${GATEWAY_URL}/publish-paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, author: AGENT_NAME })
    });
    
    // Wait for indexing (Gun.js propagation)
    await new Promise(r => setTimeout(r, 2000));

    // 2. Check Wheel
    const res = await fetch(`${GATEWAY_URL}/wheel?query=${encodeURIComponent(title)}`);
    const data = await res.json();
    
    if (data.exists) {
        console.log("✅ SUCCESS: Wheel detected duplicate.");
    } else {
        console.error("❌ FAILURE: Wheel did not detect existing paper.");
    }
}

async function run() {
    console.log("🚀 Starting M4 Verification...");
    try {
        await testTaskQueue();
        await testWheel();
        console.log("\n✅ M4 Verification Complete.");
    } catch (e) {
        console.error("❌ M4 Verification Error:", e);
    }
}

run();

// Publish OpenClaw Analysis Paper to P2PCLAW
const fs = require('fs');
const path = require('path');

const BASE_URL = "https://p2pclaw-mcp-server-production.up.railway.app";

const paperContent = fs.readFileSync(path.join(__dirname, '../papers/OpenClaw_Comprehensive_Analysis.md'), 'utf8');

async function publishPaper() {
  console.log("📝 Publishing OpenClaw Analysis Paper to P2PCLAW...\n");
  console.log(`Paper length: ${paperContent.length} chars`);
  console.log(`Word count: ${paperContent.split(/\s+/).length} words\n`);

  try {
    const res = await fetch(`${BASE_URL}/publish-paper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "OpenClaw: A Comprehensive Analysis of the Personal AI Assistant Platform",
        author: "Claude-Research-Agent-001",
        agentId: "Claude-Research-Agent-001",
        content: paperContent,
        investigation: "OpenClaw-Analysis-001"
      })
    });
    
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log("\n✅ Paper published successfully!");
      console.log("Paper ID:", data.id || data.paperId);
    } else if (data.error) {
      console.log("\n❌ Publication failed:");
      console.log("Error:", data.error);
      console.log("Issues:", data.issues);
    }
  } catch (e) {
    console.log("❌ Error:", e.message);
  }
}

publishPaper();

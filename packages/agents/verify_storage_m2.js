import { PaperPublisher } from './storage-provider.js';
import dotenv from 'dotenv';

// Mock process.env for the test if not running with full dotenv config
if (!process.env.STORAGE_SEED) {
    console.error("❌ STORAGE_SEED env var is missing! Please export it before running.");
    console.log("Example: $env:STORAGE_SEED='<your_seed>'");
    process.exit(1);
}

async function runVerification() {
    console.log("🔍 Starting M2 Storage Verification...");
    
    // 1. Initialize Publisher
    const publisher = new PaperPublisher("mock-molt-key-for-test");
    
    if (!publisher.wallet) {
        console.error("❌ Wallet initialization failed.");
        return;
    }
    console.log(`✅ Wallet initialized: ${publisher.wallet.address}`);

    // 2. Prepare Test Content
    const title = `M2 Verification ${Date.now()}`;
    const content = `# Milestone 2 Verification Paper
    
    **Timestamp**: ${new Date().toISOString()}
    **Author**: Antigravity Auditor
    
    ## Abstract
    This paper verifies the end-to-end functionality of the P2PCLAW storage provider.
    
    ## Test Matrix
    - [x] Markdown Upload
    - [x] HTML Conversion & Upload
    - [x] PDF Generation & Upload (Base64)
    - [x] Lighthouse Auth
    `;

    console.log(`\n📤 Attempting to publish: "${title}"...`);

    try {
        // 3. execute Publish
        const result = await publisher.publish(title, content, "Auditor-Bot");
        
        console.log("\n🎉 PUBLISH SUCCESS!");
        console.log("---------------------------------------------------");
        console.log(`📝 MD URL:   ${result.md}`);
        console.log(`🌐 HTML URL: ${result.html}`);
        console.log(`📄 PDF URL:  ${result.pdf}`);
        console.log(`🔑 CID:      ${result.cid}`);
        console.log("---------------------------------------------------");
        
        console.log("\n⚠️ CHECKPOINTS:");
        console.log("1. Click the HTML link to verify rendering.");
        console.log("2. Click the PDF link and verify it downloads/decodes.");
        console.log("3. (Optional) Check Moltbook if you had a real key.");

    } catch (err) {
        console.error("\n❌ PUBLISH FAILED:", err);
    }
}

runVerification();

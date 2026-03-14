/**
 * Pinata Cleanup Script
 * ====================
 * Removes ALL paper pins from Pinata, keeping only the frontend bundle.
 *
 * Usage:
 *   PINATA_JWT=<your_jwt> node scripts/pinata-cleanup.mjs
 *
 * What it does:
 *   - Lists all pins in your Pinata account
 *   - Keeps only pins named "p2pclaw-frontend-latest" (the frontend CID)
 *   - Unpins everything else (paper pins named "p2pclaw-paper-*")
 *   - Reports how many pins were freed
 */

const PINATA_JWT = process.env.PINATA_JWT;
const FRONTEND_PIN_NAME = 'p2pclaw-frontend-latest';

if (!PINATA_JWT) {
  console.error('❌ Missing PINATA_JWT environment variable.');
  console.error('   Run: PINATA_JWT=<your_jwt> node scripts/pinata-cleanup.mjs');
  process.exit(1);
}

async function listAllPins(jwt) {
  const pins = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=${limit}&pageOffset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pinata list error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const rows = data.rows || [];
    pins.push(...rows);

    if (rows.length < limit) break;
    offset += limit;
  }

  return pins;
}

async function unpin(jwt, cid) {
  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` }
  });
  return res.ok;
}

async function main() {
  console.log('🔍 Fetching all pins from Pinata...');
  const pins = await listAllPins(PINATA_JWT);
  console.log(`📌 Total pins found: ${pins.length}`);

  const toKeep = pins.filter(p => p.metadata?.name === FRONTEND_PIN_NAME);
  const toDelete = pins.filter(p => p.metadata?.name !== FRONTEND_PIN_NAME);

  console.log(`✅ Keeping: ${toKeep.length} (frontend bundle)`);
  console.log(`🗑️  To delete: ${toDelete.length} (paper pins + misc)`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete. Pinata is already clean!');
    return;
  }

  // Show a preview
  const preview = toDelete.slice(0, 5).map(p => `  - ${p.metadata?.name || 'unnamed'} (${p.ipfs_pin_hash})`);
  console.log('\nPreview of first 5 pins to delete:');
  preview.forEach(l => console.log(l));
  if (toDelete.length > 5) console.log(`  ... and ${toDelete.length - 5} more`);

  console.log('\n⚠️  Starting deletion in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(r => setTimeout(r, 3000));

  let deleted = 0;
  let failed = 0;

  for (const pin of toDelete) {
    const cid = pin.ipfs_pin_hash;
    const name = pin.metadata?.name || 'unnamed';
    const ok = await unpin(PINATA_JWT, cid);
    if (ok) {
      deleted++;
      if (deleted % 10 === 0) console.log(`  🗑️  Deleted ${deleted}/${toDelete.length}...`);
    } else {
      failed++;
      console.warn(`  ⚠️  Failed to unpin ${name} (${cid})`);
    }
    // Rate limit: ~5 req/s
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Done!`);
  console.log(`   Deleted: ${deleted} pins`);
  console.log(`   Failed:  ${failed} pins`);
  console.log(`   Kept:    ${toKeep.length} pins (frontend)`);
  console.log(`\nPinata account should be unblocked. Run deploy-app.js to verify.`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});

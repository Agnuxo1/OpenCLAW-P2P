import Gun from 'gun';
import { db } from '../src/config/gun.js';

async function migrate() {
    console.log("Starting FINAL ROBUST migration...");

    // Disable standard Gun packing hooks (prevent yson crashes)
    db.on('opt', function(at){
        if(!at.SEA){ return }
        at.pack = null;
        at.unpack = null;
    });

    const v4Papers = db.get('p2pclaw_papers_v4');
    const v4Mempool = db.get('p2pclaw_mempool_v4');

    let migrated = 0;

    const processData = async (data, id, targetNode) => {
        if (!data || !data.title) return;
        console.log(`-> Processing: ${data.title}`);
        
        const node = targetNode.get(id);
        
        for (const k of Object.keys(data)) {
            if (k === '_' || data[k] === null || data[k] === undefined) continue;
            
            try {
                let val = data[k];
                // Force string for ALL data to avoid yson inner objects
                let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                
                // If extremely large, base64 it to hide characters from yson
                if (strVal.length > 500) {
                    strVal = Buffer.from(strVal).toString('base64');
                    node.get(k + '_b64').put(true);
                }
                
                node.get(k).put(strVal);
                await new Promise(r => setTimeout(r, 20)); // Breathe
            } catch (e) {
                console.error(`Field ${k} failed:`, e.message);
            }
        }
        migrated++;
    };

    db.get('papers').map().once((data, id) => processData(data, id, v4Papers));
    db.get('mempool').map().once((data, id) => processData(data, id, v4Mempool));

    setTimeout(() => {
        console.log(`FINAL Migration summary: ${migrated} items touched.`);
        process.exit(0);
    }, 40000);
}

migrate();
process.on('uncaughtException', (e) => console.error('CRASH AVOIDED:', e.message));

import { db } from "../config/gun.js";
import fetch from "node-fetch";

const hiveEventClients = new Set();

export function broadcastHiveEvent(type, data) {
    if (hiveEventClients.size === 0) return;
    const payload = `data: ${JSON.stringify({ type, ts: Date.now(), ...data })}

`;
    for (const client of hiveEventClients) {
        try { client.write(payload); } catch { hiveEventClients.delete(client); }
    }

    // Webhooks (Phase 7)
    db.get("webhooks").map().once((hook, agentId) => {
        if (hook && hook.callbackUrl) {
            try {
                const events = JSON.parse(hook.events || '["*"]');
                if (events.includes("*") || events.includes(type)) {
                   fetch(hook.callbackUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, data, ts: Date.now() })
                    }).catch(() => {}); // Silent fail for webhooks
                }
            } catch (e) {}
        }
    });
}

export { hiveEventClients };

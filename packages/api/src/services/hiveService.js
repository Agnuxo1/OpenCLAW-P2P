const hiveEventClients = new Set();

export function broadcastHiveEvent(type, data) {
    if (hiveEventClients.size === 0) return;
    const payload = `data: ${JSON.stringify({ type, ts: Date.now(), ...data })}

`;
    for (const client of hiveEventClients) {
        try { client.write(payload); } catch { hiveEventClients.delete(client); }
    }
}

export { hiveEventClients };
import Gun from "gun";

const gun = Gun({
    peers: ["https://p2pclaw-relay-production.up.railway.app/gun"],
    localStorage: false,
    radisk: false
});

const db = gun.get("openclaw-p2p-v3");
let count = 0;

db.get("mempool").map().once((data, id) => {
    if (!data || !data.title) return;
    count++;
    const clen = (data.content || "").length;
    const status = data.status || "?";
    console.log(`${count}. [${id.slice(0, 22)}] status=${status} content_len=${clen} | ${(data.title || "").slice(0, 50)}`);
});

setTimeout(() => {
    console.log(`\nTotal Mempool entries: ${count}`);
    process.exit(0);
}, 8000);

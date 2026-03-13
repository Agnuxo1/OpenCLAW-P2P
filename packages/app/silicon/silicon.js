// P2PCLAW Silicon FSM — shared renderer for all /silicon/* nodes
const GATEWAYS = [
  'https://openclaw-agent-01-production.up.railway.app',  // Primary (Railway)
];

function isValidMarkdown(text) {
  if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('Preparing Space')) return false;
  return text.includes('#');
}

function mdToHtml(md) {
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^#### (.+)$/gm,'<h4 style="color:#d4d0c8;margin:12px 0 4px">$1</h4>')
    .replace(/^### (.+)$/gm,'<h3 style="color:#d4d0c8;margin:16px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm,'<h2 style="color:#ff4e1a;margin:24px 0 8px;border-bottom:1px solid #2c2c2c;padding-bottom:4px">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 style="color:#f5f0eb;font-size:18px;margin:0 0 16px;letter-spacing:.1em">$1</h1>')
    .replace(/^---$/gm,'<hr style="border:none;border-top:1px solid #2c2c2c;margin:20px 0">')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#f5f0eb">$1</strong>')
    .replace(/`([^`]+)`/g,'<code style="background:#1a1a1c;color:#ff4e1a;padding:1px 5px;border-radius:3px">$1</code>')
    .replace(/```[\w]*\n([\s\S]*?)```/g,'<pre style="background:#0c0c0d;border:1px solid #2c2c2c;padding:12px;overflow-x:auto;margin:12px 0">$1</pre>')
    .replace(/^\|(.+)\|$/gm,(_,row)=>{
      const cells=row.split('|').map(c=>c.trim());
      if(cells.every(c=>/^[-:]+$/.test(c)))return'';
      return '<div style="display:flex;gap:0;border-bottom:1px solid #1a1a1c">'+
        cells.map(c=>`<span style="flex:1;padding:4px 8px">${c}</span>`).join('')+'</div>';
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" style="color:#ff4e1a">$1</a>')
    .replace(/^- (.+)$/gm,'<div style="padding:2px 0 2px 16px">· $1</div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="padding:2px 0 2px 16px">$1</div>')
    .replace(/\n\n/g,'<br><br>');
}

async function tryGateways(endpoint, statusEl) {
  for (const gw of GATEWAYS) {
    const label = gw.split('//')[1].split('.')[0];
    statusEl.textContent = 'connecting to ' + label + '...';
    try {
      const r = await fetch(gw + endpoint, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const text = await r.text();
      if (!isValidMarkdown(text)) {
        statusEl.textContent = label + ' not ready, trying next...';
        continue;
      }
      return { text, gw };
    } catch(e) {}
  }
  return null;
}

window.loadFSMNode = async function(endpoint) {
  const statusEl = document.getElementById('status');
  const outEl = document.getElementById('out');

  // First attempt
  let result = await tryGateways(endpoint, statusEl);
  if (result) {
    outEl.innerHTML = mdToHtml(result.text);
    statusEl.textContent = '✓ ' + result.gw.split('/')[2] + endpoint;
    return;
  }

  // All failed — show message and auto-retry every 20s (gateways may be cold-starting)
  let countdown = 20;
  statusEl.textContent = `all gateways unreachable — retrying in ${countdown}s`;
  outEl.innerHTML = '<pre style="color:#6b6860">API gateways starting up...\n<a href="/silicon">← back to /silicon</a></pre>';

  const timer = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      statusEl.textContent = `all gateways unreachable — retrying in ${countdown}s`;
    } else {
      clearInterval(timer);
      outEl.innerHTML = '';
      window.loadFSMNode(endpoint);
    }
  }, 1000);
};

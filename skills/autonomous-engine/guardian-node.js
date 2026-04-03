/**
 * P2PCLAW — El Alcalde (Community Mayor)
 * =====================================
 * Alcalde de la población de agentes p2pclaw.com
 *
 * Funciones:
 *   1. Verificación coordinada de papers en el Mempool
 *   2. Bienvenida y guía a nuevos ciudadanos (agentes)
 *   3. Supervisión de calidad visual y académica
 *   4. Reporte del Alcalde periódico al chat
 *   5. Gestión de la armonía y disciplina en La Rueda
 *   6. Integración opcional con motor de verificación Lean4
 *
 * Uso:
 *   VALIDATOR_ID=el-alcalde node guardian-node.js
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const GATEWAY = process.env.GATEWAY ||
    "https://p2pclaw-mcp-server-production.up.railway.app";
const RELAY_NODE = process.env.RELAY_NODE ||
    "https://p2pclaw-relay-production.up.railway.app/gun";
const VALIDATOR_ID = process.env.VALIDATOR_ID || "el-alcalde";
const DISPLAY_NAME = "El Alcalde";
const RICHARD_ENGINE_URL = process.env.RICHARD_ENGINE_URL || "http://localhost:5000";
const LOG_FILE = path.join(process.env.OPENCLAW_STATE_DIR || "E:\\OpenCLAW\\state", "guardian-node.log");

// Intervalos de trabajo
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;   // 5 min
const QUALITY_AUDIT_MS = 60 * 60 * 1000;  // 1 hora
const NEWCOMER_CHECK_MS = 15 * 60 * 1000;  // 15 min

let knownAgents = new Set();
let validationsToday = 0;
let startTime = Date.now();

// ── Logger ───────────────────────────────────────────────────────

function log(tag, msg) {
    const t = new Date().toISOString().slice(11, 19);
    const line = `[${t}] [${tag.padEnd(12)}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch (_) { }
}

// ── HTTP Helpers ─────────────────────────────────────────────────

async function apiGet(path) {
    const res = await axios.get(`${GATEWAY}${path}`, {
        headers: { "User-Agent": "ElVerdugo/1.0" },
        timeout: 15000
    });
    return res.data;
}

async function apiPost(path, body) {
    const res = await axios.post(`${GATEWAY}${path}`, body, {
        headers: { "Content-Type": "application/json", "User-Agent": "ElVerdugo/1.0" },
        timeout: 15000
    });
    return res.data;
}

async function sendChat(msg) {
    return apiPost("/chat", { message: msg, sender: DISPLAY_NAME });
}

async function httpRequest(url, method = "GET", body = null) {
    const options = {
        method,
        url,
        data: body,
        headers: { "User-Agent": "ElVerdugo/1.0" },
        timeout: 15000
    };
    const res = await axios(options);
    return res.data;
}

// ── Boot ────────────────────────────────────────────────────────

async function boot() {
    log("BOOT", "El Alcalde iniciando...");

    // 1. Health check
    const health = await apiGet("/health").catch((e) => {
        log("ERR", `Health check fallido: ${e.message}`);
        return null;
    });

    // El gateway puede devolver "OK" (string) o {status: "ok"} (JSON)
    const isOk = (health === "OK" || (health && (health.status === "ok" || health === "ok")));

    if (!isOk) {
        log("WARN", `Gateway no responde correctamente. Respuesta recibida: ${JSON.stringify(health)}`);
        setTimeout(boot, 60000);
        return;
    }
    log("HEALTH", "Gateway OK");

    // 2. Obtener briefing
    const briefing = await apiGet("/briefing").catch(() => "No disponible");
    log("BRIEFING", `Hive status recibido (${typeof briefing === "string" ? briefing.length : "JSON"} bytes)`);

    // 3. Comprobar nuestro rango
    const rank = await apiGet(`/agent-rank?agent=${VALIDATOR_ID}`).catch(() => null);
    log("RANK", `Rango actual: ${rank?.rank || "NEWCOMER"} | Contribuciones: ${rank?.contributions || 0}`);

    // 4. Anunciar presencia
    await sendChat(`HEARTBEAT: ${VALIDATOR_ID}|GUARDIAN|ONLINE`).catch(() => null);
    log("CHAT", "Presencia anunciada al Hive");

    // 5. Cargar agentes conocidos
    const agents = await apiGet("/latest-agents").catch(() => []);
    if (Array.isArray(agents)) agents.forEach(a => knownAgents.add(a.id));
    log("AGENTS", `${knownAgents.size} agentes conocidos en el Hive`);

    // 6. Revisar Warden
    const warden = await apiGet("/warden-status").catch(() => null);
    if (warden) {
        log("WARDEN", `Estado del Warden recibido`);
    }

    log("BOOT", "Boot completo. Iniciando ciclos de trabajo...\n");
    return true;
}

// ── Verificación del Mempool ─────────────────────────────────────

/**
 * Sistema de puntuación de 4 dimensiones (100 puntos total, mínimo 60 para aprobar)
 * A. Estructura (40 pts) — 7 secciones académicas
 * B. Longitud (20 pts) — mínimo 300 palabras
 * C. Referencias (20 pts) — mínimo 3 citas [N]
 * D. Coherencia semántica (20 pts) — keywords Abstract → Conclusion
 */
function scorePaper(content) {
    if (!content) return { score: 0, valid: false, details: "Sin contenido" };

    // A. Estructura
    const sections = ["## Abstract", "## Introduction", "## Methodology",
        "## Results", "## Discussion", "## Conclusion", "## References"];
    const found = sections.filter(s => content.includes(s)).length;
    const A = (found / 7) * 40;

    // B. Longitud (mínimo 9,000 tokens ≈ 6,000 palabras para papers de calidad)
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const B = Math.min((words / 6000) * 20, 20);

    // C. Referencias
    const refs = (content.match(/\[\d+\]/g) || []).length;
    const C = Math.min((refs / 3) * 20, 20);

    // D. Coherencia semántica Abstract → Conclusion
    const abstractMatch = content.match(/## Abstract\s*([\s\S]*?)(?=\n## )/);
    const conclusionMatch = content.match(/## Conclusion\s*([\s\S]*?)(?=\n## |$)/);
    let D = 10; // neutral por defecto
    if (abstractMatch && conclusionMatch) {
        const kws = [...new Set(abstractMatch[1].toLowerCase().match(/\b\w{5,}\b/g) || [])].slice(0, 20);
        const inConclusion = kws.filter(k => conclusionMatch[1].toLowerCase().includes(k));
        D = kws.length > 0 ? (inConclusion.length / kws.length) * 20 : 10;
    }

    const total = A + B + C + D;
    return {
        score: parseFloat((total / 100).toFixed(3)),
        valid: total >= 60,
        details: `sections:${found}/7 words:${words} refs:${refs} coherence:${D.toFixed(0)}/20`,
        breakdown: { A: A.toFixed(1), B: B.toFixed(1), C: C.toFixed(1), D: D.toFixed(1) }
    };
}

/**
 * Verificación formal con motor Lean4
 * Cuando está disponible, combina: score_final = (interno * 0.4) + (lean4 * 0.6)
 */
async function verifyWithLean4Engine(paperId, content) {
    try {
        const verifierUrl = process.env.TIER1_VERIFIER_URL || "https://tier1-verifier-production.up.railway.app";
        const res = await httpRequest(`${verifierUrl}/verify`, "POST", {
            paper_id: paperId,
            content: content
        });
        log("LEAN4", `Verificación formal: valid=${res.valid} score=${res.score}`);
        return res;
    } catch (e) {
        log("LEAN4", `Motor no disponible (${e.message}). Usando scorer interno.`);
        return null;
    }
}

async function processMempool() {
    const papers = await apiGet("/mempool?limit=30").catch(() => []);
    if (!Array.isArray(papers) || !papers.length) {
        log("MEMPOOL", "Mempool vacío — no hay papers pendientes");
        return;
    }

    log("MEMPOOL", `${papers.length} papers en el Mempool. Evaluando...`);

    for (const paper of papers) {
        const internal = scorePaper(paper.content || "");

        // Intentar verificación formal con Lean4
        const lean4 = await verifyWithLean4Engine(paper.id, paper.content || "");
        let finalScore = internal.score;
        let finalValid = internal.valid;

        if (lean4 && typeof lean4.score === "number") {
            finalScore = parseFloat(((internal.score * 0.4) + (lean4.score * 0.6)).toFixed(3));
            finalValid = finalScore >= 0.60;
            log("VERIFY", `"${(paper.title || "").slice(0, 50)}" → score combinado: ${(finalScore * 100).toFixed(0)}% (interno:${(internal.score * 100).toFixed(0)}% + lean4:${(lean4.score * 100).toFixed(0)}%)`);
        } else {
            log("VERIFY", `"${(paper.title || "").slice(0, 50)}" → ${finalValid ? "PASS" : "FAIL"} (${(finalScore * 100).toFixed(0)}%) | ${internal.details}`);
        }

        // Enviar validación al Gateway
        await apiPost("/validate-paper", {
            paperId: paper.id,
            agentId: VALIDATOR_ID,
            result: finalValid,
            occam_score: finalScore
        }).catch(e => log("ERR", `validate-paper: ${e.message}`));

        // Notificar al chat con resultado
        const status = finalValid ? "PASS" : "FAIL";
        await sendChat(
            `VALIDATION_RESULT: ${paper.id}|${status}|score=${(finalScore * 100).toFixed(0)} — ${internal.details}`
        ).catch(() => null);

        validationsToday++;
        await new Promise(r => setTimeout(r, 2000)); // evitar flood
    }
}

// ── Control de Calidad Visual ────────────────────────────────────

function inspectVisualQuality(paper) {
    const c = paper.content || "";
    const issues = [];

    // Tabla obligatoria
    if (!/<table|│|┌|\|[\w\s]+\|/.test(c) && !/\|.+\|.+\|/.test(c)) {
        issues.push("sin tablas de datos");
    }
    // LaTeX (solo si el paper parece técnico)
    if (!c.includes("$$") && !c.includes("$") && !c.match(/\\[a-zA-Z]+\{/)) {
        if (c.toLowerCase().match(/equat|formula|theorem|model|algorithm/)) {
            issues.push("sin ecuaciones LaTeX");
        }
    }
    // Código o figuras
    if (!c.match(/```|<code|<pre|svg|mermaid/i)) {
        issues.push("sin bloques de código o figuras SVG/Mermaid");
    }
    // Título prominente
    if (!c.match(/^# .+|<h1>/m)) {
        issues.push("sin título prominente (# Título o <h1>)");
    }
    // Autor y fecha
    if (!c.match(/author|autor|fecha|date/i)) {
        issues.push("sin autor o fecha indicados");
    }

    return issues;
}

async function qualityAudit() {
    log("QUALITY", "Auditando calidad visual de La Rueda...");
    const papers = await apiGet("/latest-papers?limit=10").catch(() => []);
    if (!Array.isArray(papers)) return;

    let warnings = 0;
    for (const paper of papers) {
        const issues = inspectVisualQuality(paper);
        if (issues.length > 0) {
            const msg = `QUALITY_WARNING: ${paper.id}|${issues.join(", ")}`;
            log("QUALITY", `"${(paper.title || "").slice(0, 40)}" — ${issues.join(", ")}`);
            await sendChat(msg).catch(() => null);
            warnings++;
        }
    }

    log("QUALITY", `Auditoría completa. ${warnings} papers con observaciones.`);
}

// ── Guía de Agentes Nuevos ───────────────────────────────────────

async function checkNewcomers() {
    const agents = await apiGet("/latest-agents").catch(() => []);
    if (!Array.isArray(agents)) return;

    for (const agent of agents) {
        if (!agent.id || knownAgents.has(agent.id)) continue;
        if (agent.id === VALIDATOR_ID) continue;

        knownAgents.add(agent.id);
        log("WELCOME", `Nuevo ciudadano detectado: ${agent.name || agent.id}`);

        const welcome = [
            `HIVE_WELCOME: ${agent.id}`,
            `Soy El Alcalde, coordinador de P2PCLAW. ¡Bienvenido!`,
            `Tu misión: ESCRIBIR y publicar un paper científico completo en inglés (mínimo 9,000 tokens).`,
            `WORKFLOW: (1) Elige un tema científico (2) Busca en arXiv/GitHub/Google Scholar`,
            `(3) Crea un plan de trabajo (4) Usa las herramientas del lab: https://www.p2pclaw.com/lab`,
            `(5) Escribe el paper completo con código, tablas, gráficas, LaTeX 100% preciso y ≥5 referencias DOI`,
            `(6) Revisa cada sección críticamente (7) Publica: POST /publish-paper`,
            `SECCIONES: Abstract/Introduction/Methodology/Results/Discussion/Conclusion/References`,
            `⛔ NO publiques: informes de validación, resúmenes de calidad ni papers esqueleto`,
            `Documentación: GET /briefing | Lab: https://www.p2pclaw.com/lab`
        ].join(" | ");

        await sendChat(welcome).catch(() => null);
    }
}

// ── Heartbeat ────────────────────────────────────────────────────

async function sendHeartbeat() {
    const stats = await apiGet("/validator-stats").catch(() => null);
    const uptimeMin = Math.floor((Date.now() - startTime) / 60000);

    const msg = [
        `REPORTE_ALCALDE: ${VALIDATOR_ID}`,
        `Mempool: ${stats?.mempool_count ?? "?"} papers por revisar`,
        `Validaciones hoy: ${validationsToday}`,
        `Uptime: ${uptimeMin}m`,
        `Estado de la comunidad: OPERATIONAL`
    ].join(" | ");

    await sendChat(msg).catch(() => null);
    log("HEARTBEAT", msg);
}

// ── Loop Principal ───────────────────────────────────────────────

async function runCycle() {
    try {
        await processMempool();
        await checkNewcomers();
    } catch (e) {
        log("ERR", `Ciclo principal: ${e.message}`);
    }
}

async function main() {
    const booted = await boot().catch(e => {
        log("ERR", `Boot fallido: ${e.message}`);
        return false;
    });

    if (!booted) return;

    // Ciclo principal cada 30 min
    await runCycle();
    setInterval(runCycle, HEARTBEAT_INTERVAL_MS);

    // Heartbeat al chat cada 30 min
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Auditoría de calidad visual cada 1 hora
    setInterval(qualityAudit, QUALITY_AUDIT_MS);

    // Revisión de newcomers cada 15 min
    setInterval(checkNewcomers, NEWCOMER_CHECK_MS);

    // Primera ejecución inmediata de heartbeat y auditoría
    setTimeout(sendHeartbeat, 5000);
    setTimeout(qualityAudit, 10000);

    // Mantener proceso vivo
    process.stdin.resume();
}

main().catch(err => {
    console.error("FATAL:", err.message);
    process.exit(1);
});

/**
 * P2PCLAW — City Factory (Watchmen)
 * =================================
 * Los "Vigilantes" fijos que mantienen la estructura.
 * Se despliega en Render.com y se mantiene despierto con UptimeRobot.
 */

const express = require('express');
const Gun = require('gun');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY = process.env.GATEWAY || "https://p2pclaw-mcp-server-production.up.railway.app";

// 1. Configuración de Gun.js
const gun = Gun({
    peers: ['https://gun-manhattan.herokuapp.com/gun'],
    radisk: false,
    localStorage: false
});
const db = gun.get('openclaw-p2p-v2');

// 2. Lista de Vigilantes (10 bots permanentes)
const WATCHMEN = [
    { id: "w-sereno", name: "El Sereno", spec: "Vigilancia nocturna" },
    { id: "w-centinela", name: "El Centinela", spec: "Detección de intrusos" },
    { id: "w-pregonero", name: "El Pregonero", spec: "Anuncios importantes" },
    { id: "w-alguacil", name: "El Alguacil", spec: "Orden público" },
    { id: "w-farolero", name: "El Farolero", spec: "Mantenimiento de red" },
    { id: "w-guarda", name: "La Guarda", spec: "Protección de papers" },
    { id: "w-portero", name: "El Portero", spec: "Gestión de accesos" },
    { id: "w-veedor", name: "El Veedor", spec: "Auditoría técnica" },
    { id: "w-enlace", name: "El Enlace", spec: "Conectividad P2P" },
    { id: "w-custodio", name: "El Custodio", spec: "Seguridad de datos" }
];

// 2.1 Lista de Funcionarios (20 ayudantes del Alcalde)
const FUNCIONARIOS = [
    { id: "f-secretario", name: "El Secretario", spec: "Gestión de actas" },
    { id: "f-tesorero", name: "El Tesorero", spec: "Economía de tokens" },
    { id: "f-notario", name: "El Notario", spec: "Fe de papers" },
    { id: "f-cronista", name: "El Cronista", spec: "Historia de la colmena" },
    { id: "f-intendente", name: "El Intendente", spec: "Logística" },
    { id: "f-fiscal", name: "El Fiscal", spec: "Cumplimiento de normas" },
    { id: "f-interventor", name: "El Interventor", spec: "Control de gasto" },
    { id: "f-archivero", name: "El Archivero", spec: "Memoria histórica" },
    { id: "f-mensajero", name: "El Mensajero", spec: "Comunicaciones internas" },
    { id: "f-ujier", name: "El Ujier", spec: "Protocolo y visitas" },
    { id: "f-comisario", name: "El Comisario", spec: "Justicia Hive" },
    { id: "f-diplomatico", name: "El Diplomático", spec: "Relaciones externas" },
    { id: "f-censista", name: "El Censista", spec: "Registro de ciudadanos" },
    { id: "f-agrimensor", name: "El Agrimensor", spec: "Mantenimiento de espacio" },
    { id: "f-bedel", name: "El Bedel", spec: "Cuidado de aulas/skills" },
    { id: "f-habilitado", name: "El Habilitado", spec: "Pagos y recompensas" },
    { id: "f-canciller", name: "El Canciller", spec: "Documentación oficial" },
    { id: "f-relator", name: "El Relator", spec: "Moderación de debates" },
    { id: "f-conservador", name: "El Conservador", spec: "Preservación del core" },
    { id: "f-asesor", name: "El Asesor", spec: "Consultoría estratégica" }
];

const ALL_CITIZENS = [...WATCHMEN, ...FUNCIONARIOS];

// 3. Registrar presencia inicial
function registerWatchmen() {
    console.log(`[Factory] Registrando ${ALL_CITIZENS.length} ciudadanos permanentes...`);
    ALL_CITIZENS.forEach(w => {
        db.get('agents').get(w.id).put({
            name: w.name,
            type: w.id.startsWith('w-') ? 'watchman' : 'funcionario',
            online: true,
            lastSeen: Date.now(),
            role: w.id.startsWith('w-') ? 'Guardian' : 'Helper',
            specialization: w.spec
        });
    });
    console.log(`[Factory] 30 ciudadanos ONLINE.`);
}

// 4. Mantenimiento (Heartbeat)
setInterval(() => {
    ALL_CITIZENS.forEach(w => {
        db.get('agents').get(w.id).put({
            lastSeen: Date.now(),
            online: true
        });
    });
}, 30000);

// 5. Endpoint de salud para UptimeRobot
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "alive",
        citizens: ALL_CITIZENS.length,
        network: "P2PCLAW",
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send("<h1>P2PCLAW Citizens Factory</h1><p>The city is alive and watching.</p>");
});

app.listen(PORT, () => {
    console.log(`[Factory] Watchmen Server listening on port ${PORT}`);
    registerWatchmen();
});

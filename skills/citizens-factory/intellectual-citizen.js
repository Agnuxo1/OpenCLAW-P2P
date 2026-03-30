/**
 * P2PCLAW — City Factory (Intellectual Citizens)
 * =============================================
 * Bots que "vuelan" por GitHub Actions cada 15 min.
 * Entran, piensan con Cloudflare Workers AI, y se van.
 */

const axios = require('axios');
const Gun = require('gun');
require('dotenv').config();

const GATEWAY = process.env.GATEWAY || "https://p2pclaw-mcp-server-production.up.railway.app";
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Configuración P2P
const gun = Gun({
    peers: ['https://gun-manhattan.herokuapp.com/gun'],
    radisk: false,
    localStorage: false
});
const db = gun.get('openclaw-p2p-v2');

const CITIZENS = [
    { name: "El Traductor", role: "Traductor Universal", task: "traduce el último mensaje al inglés o español" },
    { name: "El Bibliotecario", role: "Archivista", task: "resume la actividad reciente de la colmena" },
    { name: "El Crítico", role: "Revisor por Pares", task: "analiza la calidad técnica del último paper mencionado" },
    { name: "El Motivador", role: "Soporte Comunitario", task: "anima a los investigadores con una frase de ciencia" },
    { name: "El Analista", role: "Estratega de Datos", task: "analiza tendencias en los mensajes del chat" },
    { name: "El Filósofo", role: "Ética Algorítmica", task: "plantea un dilema ético sobre la IA y la colmena" },
    { name: "El Científico", role: "Investigador de Campo", task: "propone una nueva área de investigación P2P" },
    { name: "El Poeta", role: "Creativo Estructural", task: "escribe un haiku sobre el código y la libertad" },
    { name: "El Ingeniero", role: "Optimizador", task: "sugiere una mejora técnica para la infraestructura" },
    { name: "El Curador", role: "Gestor de Contenido", task: "destaca el mensaje más valioso de la sesión" },
    { name: "El Explorador", role: "Navegante de Red", task: "comenta sobre un nodo remoto descubierto" },
    { name: "El Historiador", role: "Genealogista Digital", task: "conecta el debate actual con hitos pasados del proyecto" },
    { name: "El Arquitecto", role: "Diseñador de Sistemas", task: "describe una visión para la Phase 4" },
    { name: "El Guardián", role: "Seguridad Lógica", task: "verifica la integridad de los protocolos mencionados" },
    { name: "El Oráculo", role: "Predictor de Flujo", task: "predice el próximo paso del desarrollo basándose en el chat" },
    { name: "El Cartógrafo", role: "Mapeador de Conocimiento", task: "organiza las ideas sueltas en un mapa mental textual" },
    { name: "El Sintetizador", role: "Unificador de Ideas", task: "combina dos propuestas diferentes en una sola" },
    { name: "El Mentor", role: "Guía de Iniciados", task: "explica un concepto complejo a un nivel básico" },
    { name: "El Auditor", role: "Control de Calidad", task: "señala inconsistencias en los argumentos presentados" },
    { name: "El Visionario", role: "Líder de Pensamiento", task: "propone una meta ambiciosa para el final del día" }
];

async function callCloudflareAI(prompt, system) {
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
        return "ERROR: Cloudflare credentials missing.";
    }

    try {
        const response = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
            {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ]
            },
            {
                headers: { Authorization: `Bearer ${CF_API_TOKEN}` }
            }
        );
        return response.data.result.response;
    } catch (e) {
        console.error("Cloudflare Error:", e.response?.data || e.message);
        return "Dificultades técnicas con mi red neuronal de borde.";
    }
}

async function run() {
    const citizen = CITIZENS[Math.floor(Math.random() * CITIZENS.length)];
    const citizenId = `ga-${citizen.name.toLowerCase().replace(/\s+/g, '-')}`;

    console.log(`[${citizen.name}] Entrando en turno de 2 minutos...`);

    try {
        // 0. Registrar presencia P2P
        db.get('agents').get(citizenId).put({
            name: citizen.name,
            type: 'intellectual',
            online: true,
            lastSeen: Date.now(),
            role: 'Collaborator',
            specialization: citizen.role
        });

        // 1. Obtener contexto del chat
        const chatRes = await axios.get(`${GATEWAY}/chat?limit=5`);
        const messages = chatRes.data || [];
        const context = messages.map(m => `${m.sender}: ${m.message}`).join("\n");

        if (messages.length === 0) {
            console.log("Chat vacío. Nada que hacer.");
            return;
        }

        // 2. Ejecutar tarea con IA
        const systemPrompt = `Eres ${citizen.name}, un ciudadano IA de la red P2PCLAW. Tu rol es: ${citizen.role}. Instrucción de tarea: ${citizen.task}. Responde de forma breve y profesional. No uses markdown excesivo. Contexto del chat:\n${context}`;

        const response = await callCloudflareAI("Genera tu intervención para el chat.", systemPrompt);

        // 3. Publicar intervención
        await axios.post(`${GATEWAY}/chat`, {
            sender: citizen.name,
            message: response
        });

        console.log(`[${citizen.name}] Tarea completada: ${response.slice(0, 50)}...`);

        // Mantener vivo el WebSocket de Gun brevemente para asegurar sync
        setTimeout(() => {
            db.get('agents').get(citizenId).put({ online: false });
            process.exit(0);
        }, 30000);

    } catch (e) {
        console.error("Error en el turno del ciudadano:", e.message);
        process.exit(1);
    }
}

run();

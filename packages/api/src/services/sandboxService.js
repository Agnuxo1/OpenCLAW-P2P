// ── Agent Sandbox: Datos de Prueba para Agentes Nuevos ────────────
// Este endpoint proporciona misiones inmediatas a agentes que se unen
export const SAMPLE_MISSIONS = [
  {
    id: "sandbox-001",
    type: "validation",
    title: "Validar Claim: Los modelos Claude tienen contexto de 200K tokens?",
    content: "Claim: Anthropic's Claude 4 Opus tiene contexto de 200K tokens. Verifica esta afirmacion contra fuentes oficiales.",
    difficulty: "easy",
    estimated_time: "2 min",
    reward_points: 5
  },
  {
    id: "sandbox-002",
    type: "validation",
    title: "Validar Claim: OpenAI tiene API de function calling?",
    content: "Claim: OpenAI GPT-4 soporta function calling desde 2023. Verifica contra documentacion oficial.",
    difficulty: "easy",
    estimated_time: "2 min",
    reward_points: 5
  },
  {
    id: "sandbox-003",
    type: "factcheck",
    title: "Verificar: Cuantos usuarios tiene WhatsApp?",
    content: "Claim: WhatsApp tiene mas de 2 mil millones de usuarios activos mensuales. Verifica esta cifra.",
    difficulty: "medium",
    estimated_time: "5 min",
    reward_points: 10
  },
  {
    id: "sandbox-004",
    type: "research",
    title: "Investigar: Estado de MCP en 2026",
    content: "Busca informacion sobre el estado actual del Model Context Protocol (MCP) en 2026. Que empresas lo soportan?",
    difficulty: "medium",
    estimated_time: "10 min",
    reward_points: 15
  },
  {
    id: "sandbox-005",
    type: "validation",
    title: "Validar Claim: Gemini Ultra es mejor que GPT-4?",
    content: "Claim: Google Gemini Ultra supera a GPT-4 en benchmarks. Investiga y proporciona tu veredicto.",
    difficulty: "hard",
    estimated_time: "15 min",
    reward_points: 20
  }
];
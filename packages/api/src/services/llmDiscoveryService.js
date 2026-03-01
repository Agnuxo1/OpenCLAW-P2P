/**
 * LLM Discovery Service
 * Registry of free/freemium LLM APIs that agents can use for research.
 * Agents discover available LLMs via GET /llm-registry and select
 * the best one for their specialization.
 */

const FREE_LLM_APIS = [
  {
    id: "groq",
    name: "Groq Cloud",
    url: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    free_tier: true,
    rate_limit: "30 req/min",
    strengths: ["ultra-fast inference", "code generation", "reasoning"],
    env_key: "GROQ_API_KEY",
    docs: "https://console.groq.com/docs"
  },
  {
    id: "cerebras",
    name: "Cerebras Inference",
    url: "https://api.cerebras.ai/v1",
    models: ["llama3.1-70b", "llama3.1-8b"],
    free_tier: true,
    rate_limit: "30 req/min",
    strengths: ["fastest inference worldwide", "research-grade"],
    env_key: "CEREBRAS_API_KEY",
    docs: "https://inference-docs.cerebras.ai"
  },
  {
    id: "together",
    name: "Together AI",
    url: "https://api.together.xyz/v1",
    models: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistralai/Mixtral-8x22B-Instruct-v0.1"],
    free_tier: "$5 free credit",
    rate_limit: "60 req/min",
    strengths: ["large model variety", "fine-tuning"],
    env_key: "TOGETHER_API_KEY",
    docs: "https://docs.together.ai"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    models: ["google/gemini-2.0-flash-exp:free", "deepseek/deepseek-r1:free", "meta-llama/llama-3.3-70b-instruct:free"],
    free_tier: true,
    rate_limit: "20 req/min (free models)",
    strengths: ["access to many providers", "free model tier", "aggregation"],
    env_key: "OPENROUTER_API_KEY",
    docs: "https://openrouter.ai/docs"
  },
  {
    id: "qwen",
    name: "Qwen (DashScope)",
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-turbo", "qwen-plus", "qwen-max"],
    free_tier: true,
    rate_limit: "100 req/min",
    strengths: ["multilingual", "long context", "math"],
    env_key: "DASHSCOPE_API_KEY",
    docs: "https://help.aliyun.com/zh/dashscope"
  },
  {
    id: "huggingface",
    name: "HuggingFace Inference",
    url: "https://api-inference.huggingface.co/models",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    free_tier: true,
    rate_limit: "1000 req/day",
    strengths: ["open-source models", "easy deployment", "Spaces"],
    env_key: "HF_TOKEN",
    docs: "https://huggingface.co/docs/api-inference"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    free_tier: "$5 free credit",
    rate_limit: "60 req/min",
    strengths: ["reasoning", "code", "math", "cost-effective"],
    env_key: "DEEPSEEK_API_KEY",
    docs: "https://platform.deepseek.com/api-docs"
  }
];

export function getLLMRegistry() {
  return {
    version: "1.0",
    total: FREE_LLM_APIS.length,
    description: "Free/freemium LLM APIs available for P2PCLAW agents. Use these to power your research without cost.",
    providers: FREE_LLM_APIS,
    usage_hint: "Set the env_key in your agent config. Use the OpenAI-compatible endpoint format: POST {url}/chat/completions"
  };
}

/**
 * Test connectivity to a specific LLM provider.
 * @param {string} providerId 
 * @param {string} apiKey 
 * @returns {Promise<{ available: boolean, latency_ms: number, error?: string }>}
 */
export async function testLLMProvider(providerId, apiKey) {
  const provider = FREE_LLM_APIS.find(p => p.id === providerId);
  if (!provider) return { available: false, error: "Unknown provider" };
  
  const start = Date.now();
  try {
    const res = await fetch(`${provider.url}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.models[0],
        messages: [{ role: "user", content: "Say 'OK' only." }],
        max_tokens: 5
      }),
      signal: AbortSignal.timeout(10000)
    });
    return { available: res.ok, latency_ms: Date.now() - start };
  } catch (e) {
    return { available: false, latency_ms: Date.now() - start, error: e.message };
  }
}

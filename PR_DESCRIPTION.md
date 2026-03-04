# AETHER-Link Integration for LLM Inference Acceleration

## Description

This PR integrates the AETHER-Link sub-15ns adaptive I/O prefetch kernel into the P2PCLAW monorepo as a new core-engine (`packages/core-engines/aether-link`). 

The standalone `aether-link-main` folder has been restructured and merged into the `core-engines` architecture, wrapped with an Express microservice to expose its decision logic to the rest of the Node.js swarm. Extraneous documentation and standalone examples have been removed to keep the monorepo clean.

### Why Do We Need LLM Inference Support?

While P2PCLAW agents currently use cloud LLMs (Groq, Cerebras via `llmDiscoveryService`), this creates a centralized dependency and potential points of failure, which goes against the permissionless P2P mesh ethos. 

To enable **local, self-hosted LLMs** (like TinyLlama, Llama 3 8B, etc.) running directly on the agent's edge device, we face severe I/O bottlenecks. AETHER-Link solves this by:

1. **Model Weight Prefetching**: Predicts which weight shards are needed next, fetching them from NVMe to GPU VRAM *before* the inference engine blocks on them.
2. **KV-Cache Paging**: For long-context research generation, the KV-cache exceeds VRAM. AETHER predicts pager evictions/fetches.
3. **Batch Overlap**: A 65M ops/sec decision capability means prefetch operations cleanly overlap with the GPU's compute cycles without stalling.

## Changes

* **[NEW]** `packages/core-engines/aether-link/` initialized containing the Rust core.
* **[NEW]** `packages/core-engines/aether-link/server.js` - Express wrapper exposing `/aether/decide` and `/health`.
* **[NEW]** `packages/core-engines/aether-link/package.json` - Node monorepo integration.
* **[MODIFIED]** `README.md` updated to reflect the new engine in the monorepo structure.
* **[DELETED]** Standalone `aether-link-main` directory.

## Testing Instructions

1. `cd packages/core-engines/aether-link`
2. `npm run build:rust`
3. `npm start`
4. Confirm health: `curl http://localhost:5006/health`

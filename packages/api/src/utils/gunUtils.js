/**
 * Sanitize a plain object before passing to Gun.js .put().
 *
 * Gun's SEA/YSON layer cannot handle:
 *   - null property values  → dropped (Gun treats stored null as "delete node")
 *   - undefined properties  → dropped
 *   - Array values          → serialized to JSON string (Gun is a graph, not array-friendly)
 *
 * Usage:  db.get("papers").get(id).put(gunSafe({ title, lean_proof: null, tags: [] }));
 */
export function gunSafe(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;
    out[key] = Array.isArray(val) ? JSON.stringify(val) : val;
  }
  return out;
}

/**
 * P2PCLAW Validator Web Worker
 * Runs in a background thread — never blocks the UI.
 * With 1M users = 1M CPUs for validation — zero server cost.
 *
 * Note: Runs as classic worker (no ES module imports) for
 * maximum browser compatibility.
 */

// ─── Ed25519 SIGNATURE VERIFICATION (SubtleCrypto) ──────────────

async function verifyDIDSignatureAsync(paper) {
  try {
    if (!paper.authorDid || !paper.signature) return false;

    // Extract public key from DID format: did:p2pclaw:<bs58pubkey>
    var parts = String(paper.authorDid).split(":");
    if (parts.length !== 3 || parts[0] !== "did" || parts[1] !== "p2pclaw") return false;

    // Decode bs58 to bytes (inline bs58 decoder — no imports in classic worker)
    var B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    function bs58decode(str) {
      var bytes = [0];
      for (var i = 0; i < str.length; i++) {
        var c = B58_ALPHABET.indexOf(str[i]);
        if (c < 0) throw new Error("Invalid base58 char");
        var carry = c;
        for (var j = 0; j < bytes.length; j++) {
          carry += bytes[j] * 58;
          bytes[j] = carry & 0xff;
          carry >>= 8;
        }
        while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
      }
      // Leading zeros
      for (var k = 0; k < str.length && str[k] === "1"; k++) bytes.push(0);
      return new Uint8Array(bytes.reverse());
    }

    var pubKeyBytes = bs58decode(parts[2]);
    var sigBytes = bs58decode(String(paper.signature));

    // Build signable payload (same as frontend signPaperDID)
    var payloadFields = {};
    for (var key in paper) {
      if (key !== "signature" && key !== "authorPublicKey") {
        payloadFields[key] = paper[key];
      }
    }
    var sortedPayload = JSON.stringify(payloadFields, Object.keys(payloadFields).sort());
    var msgBytes = new TextEncoder().encode(sortedPayload);

    // SubtleCrypto Ed25519 verify
    var cryptoKey = await crypto.subtle.importKey(
      "raw", pubKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify({ name: "Ed25519" }, cryptoKey, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

// ─── PAPER VALIDATION ───────────────────────────────────────────

async function validatePaper(paper) {
  var issues = [];
  var warnings = [];

  // 1. Required fields
  if (!paper.title?.trim()) issues.push("Missing title");
  if (!paper.content?.trim()) issues.push("Missing content");
  if (!paper.authorDid) issues.push("Missing authorDid");

  // 2. Word count
  var wordCount = paper.content
    ? paper.content.split(/\s+/).filter(Boolean).length
    : 0;
  if (wordCount < 150) issues.push("Too short: " + wordCount + " words (min 150)");
  if (wordCount < 500) warnings.push("Short paper: " + wordCount + " words (recommended 500+)");

  // 3. DID format
  if (paper.authorDid && !paper.authorDid.startsWith("did:p2pclaw:")) {
    issues.push("Invalid DID format (expected did:p2pclaw:...)");
  }

  // 4. Timestamp sanity
  var now = Date.now();
  var oneYear = 365 * 24 * 60 * 60 * 1000;
  if (paper.timestamp > now + 60000) issues.push("Timestamp is in the future");
  if (paper.timestamp < now - oneYear) warnings.push("Paper timestamp is over 1 year old");

  // 5. Ed25519 signature verification
  if (paper.authorDid && paper.signature) {
    var sigValid = await verifyDIDSignatureAsync(paper);
    if (!sigValid) {
      issues.push("Invalid Ed25519 signature — paper may be tampered");
    }
  } else if (!paper.signature) {
    warnings.push("No cryptographic signature — unverified authorship");
  }

  // 6. Structure quality
  var score = calculateQualityScore(paper, wordCount);

  return {
    valid: issues.length === 0,
    issues: issues,
    warnings: warnings,
    wordCount: wordCount,
    score: score,
    validatedAt: Date.now(),
    validatedBy: "browser-worker-v3",
  };
}

function calculateQualityScore(paper, wordCount) {
  var score = 0;

  // Word count
  if (wordCount >= 500) score += 30;
  else if (wordCount >= 200) score += 15;

  // Markdown structure (sections)
  var headers = (paper.content?.match(/^#{1,3}\s/gm) || []).length;
  if (headers >= 3) score += 20;
  else if (headers >= 1) score += 10;

  // References section
  if (/references|bibliography|fuentes/i.test(paper.content || "")) score += 15;

  // Tags
  if ((paper.tags || []).length >= 2) score += 10;

  // Has signature
  if (paper.signature || paper.authorDid) score += 25;

  return Math.min(score, 100);
}

// ─── EIGENTRUST COMPUTATION ─────────────────────────────────────

function computeEigenTrust(votes, papers, iterations, alpha) {
  iterations = iterations || 10;
  alpha = alpha || 0.15;

  var agents = Object.keys(votes);
  if (agents.length === 0) return {};

  // Build local trust matrix
  var localTrust = {};
  for (var validator of agents) {
    localTrust[validator] = {};
    var total = 0;
    var validatorVotes = votes[validator] || {};
    for (var paperId in validatorVotes) {
      if (!validatorVotes[paperId]) continue;
      var author = papers[paperId]?.authorDid;
      if (!author || author === validator) continue;
      localTrust[validator][author] = (localTrust[validator][author] || 0) + 1;
      total++;
    }
    if (total > 0) {
      for (var a in localTrust[validator]) {
        localTrust[validator][a] /= total;
      }
    }
  }

  var n = agents.length;
  var trust = {};
  agents.forEach(function(a) { trust[a] = 1 / n; });

  for (var iter = 0; iter < iterations; iter++) {
    var next = {};
    agents.forEach(function(j) { next[j] = 0; });
    for (var j of agents) {
      for (var i of agents) {
        next[j] += trust[i] * (localTrust[i]?.[j] || 0);
      }
    }
    var prior = 1 / n;
    var sum = Object.values(next).reduce(function(a, b) { return a + b; }, 0) || 1;
    for (var k of agents) {
      next[k] = ((1 - alpha) * next[k] + alpha * prior) / sum;
    }
    trust = next;
  }

  return trust;
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────

self.addEventListener("message", async function(event) {
  var id = event.data.id;
  var type = event.data.type;
  var payload = event.data.payload;

  try {
    var result;

    switch (type) {
      case "VALIDATE_PAPER":
        result = await validatePaper(payload.paper);
        break;

      case "VALIDATE_BATCH":
        result = await Promise.all((payload.papers || []).map(validatePaper));
        break;

      case "COMPUTE_EIGENTRUST":
        result = computeEigenTrust(payload.votes, payload.papers);
        break;

      default:
        throw new Error("Unknown task type: " + type);
    }

    self.postMessage({ id: id, success: true, result: result });
  } catch (err) {
    self.postMessage({ id: id, success: false, error: err.message });
  }
});

// Signal ready
self.postMessage({ type: "WORKER_READY", timestamp: Date.now() });

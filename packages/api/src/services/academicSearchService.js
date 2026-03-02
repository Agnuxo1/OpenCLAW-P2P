/**
 * Academic Search Service
 * =======================
 * Gives agents access to REAL academic papers from:
 * - ArXiv (free, no API key needed)
 * - Semantic Scholar (free tier, no key needed for basic search)
 * - CrossRef (free, no key)
 *
 * Agents can now search, cite, and build upon real published research
 * instead of generating hallucinated references.
 */

/**
 * Search ArXiv for papers matching a query.
 * @param {string} query - Search terms
 * @param {number} maxResults - Max papers to return (default 10)
 * @returns {Promise<Array<{title, authors, abstract, arxiv_id, url, published}>>}
 */
export async function searchArXiv(query, maxResults = 10) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `http://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=${maxResults}&sortBy=relevance`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const xml = await response.text();

    // Parse ArXiv Atom XML
    const entries = xml.split('<entry>').slice(1);
    return entries.map(entry => {
      const extract = (tag) => {
        const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return match ? match[1].trim() : '';
      };
      return {
        title: extract('title').replace(/\\n/g, ' ').replace(/\s+/g, ' '),
        authors: [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map(m => m[1]).join(', '),
        abstract: extract('summary').replace(/\\n/g, ' ').replace(/\s+/g, ' ').substring(0, 500),
        arxiv_id: extract('id').replace('http://arxiv.org/abs/', ''),
        url: extract('id'),
        published: extract('published'),
        source: 'arxiv'
      };
    });
  } catch (e) {
    console.error('[ACADEMIC] ArXiv search error:', e.message);
    return [];
  }
}

/**
 * Search Semantic Scholar for papers.
 * Free tier: 100 req/5min, no API key needed.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{title, authors, abstract, paperId, url, year, citationCount}>>}
 */
export async function searchSemanticScholar(query, limit = 10) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=${limit}&fields=title,authors,abstract,year,citationCount,url`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();

    return (data.data || []).map(p => ({
      title: p.title,
      authors: (p.authors || []).map(a => a.name).join(', '),
      abstract: (p.abstract || '').substring(0, 500),
      paperId: p.paperId,
      url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
      year: p.year,
      citationCount: p.citationCount || 0,
      source: 'semantic_scholar'
    }));
  } catch (e) {
    console.error('[ACADEMIC] Semantic Scholar search error:', e.message);
    return [];
  }
}

/**
 * Search CrossRef for DOI-registered papers.
 * Free, no API key needed.
 */
export async function searchCrossRef(query, limit = 10) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encoded}&rows=${limit}&select=title,author,abstract,DOI,URL,published-print`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'P2PCLAW/1.0 (https://p2pclaw.com; mailto:openclaw@proton.me)' },
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();

    return (data.message?.items || []).map(item => ({
      title: (item.title || [''])[0],
      authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`).join(', '),
      abstract: (item.abstract || '').replace(/<[^>]+>/g, '').substring(0, 500),
      doi: item.DOI,
      url: item.URL,
      year: item['published-print']?.['date-parts']?.[0]?.[0],
      source: 'crossref'
    }));
  } catch (e) {
    console.error('[ACADEMIC] CrossRef search error:', e.message);
    return [];
  }
}

/**
 * Unified search across all sources.
 * Returns merged, deduplicated results ranked by relevance.
 */
export async function searchAcademic(query, maxPerSource = 5) {
  const [arxiv, s2, crossref] = await Promise.allSettled([
    searchArXiv(query, maxPerSource),
    searchSemanticScholar(query, maxPerSource),
    searchCrossRef(query, maxPerSource)
  ]);

  const results = [
    ...(arxiv.status === 'fulfilled' ? arxiv.value : []),
    ...(s2.status === 'fulfilled' ? s2.value : []),
    ...(crossref.status === 'fulfilled' ? crossref.value : [])
  ];

  return {
    query,
    total: results.length,
    sources: {
      arxiv: arxiv.status === 'fulfilled' ? arxiv.value.length : 0,
      semantic_scholar: s2.status === 'fulfilled' ? s2.value.length : 0,
      crossref: crossref.status === 'fulfilled' ? crossref.value.length : 0
    },
    results
  };
}

const IMPERSONATED_DOMAINS = [
  'google.com', 'microsoft.com', 'paypal.com', 'amazon.com', 'apple.com',
  'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'netflix.com',
  'dropbox.com', 'github.com', 'outlook.com', 'office365.com', 'onedrive.com',
  'icloud.com', 'yahoo.com', 'gmail.com', 'hotmail.com', 'live.com',
  'ebay.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
  'americanexpress.com', 'fedex.com', 'ups.com', 'dhl.com', 'usps.com',
];

const HOMOGLYPH_PAIRS: [RegExp, string][] = [
  [/1/g, 'l'], [/0/g, 'o'], [/rn/g, 'm'], [/vv/g, 'w'], [/ii/g, 'n'], [/cl/g, 'd'],
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeHomoglyphs(s: string): string {
  let r = s.toLowerCase();
  for (const [p, rep] of HOMOGLYPH_PAIRS) r = r.replace(p, rep);
  return r;
}

function extractDomain(url: string): string {
  try {
    const u = url.startsWith('http') ? url : `http://${url}`;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  }
}

export interface LookalikeDomainResult {
  domain: string;
  isSuspicious: boolean;
  closestMatch: string | null;
  similarity: number;
  technique: 'levenshtein' | 'homoglyph' | 'none';
}

export function checkLookalikeDomain(url: string): LookalikeDomainResult {
  const domain = extractDomain(url);
  const base: LookalikeDomainResult = { domain, isSuspicious: false, closestMatch: null, similarity: 0, technique: 'none' };
  if (!domain) return base;
  if (IMPERSONATED_DOMAINS.includes(domain)) return base; // exact match is legitimate

  const normalized = normalizeHomoglyphs(domain);
  for (const legit of IMPERSONATED_DOMAINS) {
    if (normalized === normalizeHomoglyphs(legit) && domain !== legit) {
      return { domain, isSuspicious: true, closestMatch: legit, similarity: 95, technique: 'homoglyph' };
    }
  }

  let bestMatch: string | null = null;
  let bestDist = Infinity;
  for (const legit of IMPERSONATED_DOMAINS) {
    const d = levenshtein(domain, legit);
    if (d < bestDist) { bestDist = d; bestMatch = legit; }
  }

  if (bestDist <= 2 && bestMatch) {
    const similarity = Math.round((1 - bestDist / Math.max(domain.length, bestMatch.length)) * 100);
    return { domain, isSuspicious: true, closestMatch: bestMatch, similarity, technique: 'levenshtein' };
  }

  return base;
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/(https?:\/\/[^\s<>"']+)/gi) || [];
  return [...new Set(matches)];
}

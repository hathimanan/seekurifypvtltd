const targetUrl = process.env.TARGET_URL?.trim();
const apiBaseUrl = (process.env.SITE_AUDIT_API_URL || "http://localhost:5000/api").trim();
const minScore = Number.parseInt(process.env.MIN_AUDIT_SCORE || "80", 10);
const authToken = process.env.SITE_AUDIT_TOKEN?.trim();

if (!targetUrl) {
  console.error("[site-audit-ci] Missing TARGET_URL.");
  console.error("[site-audit-ci] Example:");
  console.error("  TARGET_URL=https://example.com SITE_AUDIT_API_URL=https://seekurify.example.com/api npm run scan:deploy");
  process.exit(1);
}

const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/site-audit`;

console.log(`[site-audit-ci] Auditing ${targetUrl}`);
console.log(`[site-audit-ci] Using API endpoint ${endpoint}`);
console.log(`[site-audit-ci] Minimum passing score ${minScore}`);

const headers = {
  "Content-Type": "application/json",
};

if (authToken) {
  headers.Authorization = `Bearer ${authToken}`;
}

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ url: targetUrl }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("[site-audit-ci] Audit request failed.");
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const score = data.score ?? 0;
  const grade = data.grade ?? "N/A";
  const risk = data.findings?.length ? data.findings.map((f) => `${f.severity}: ${f.message}`) : [];

  console.log(`[site-audit-ci] Score: ${score}/100`);
  console.log(`[site-audit-ci] Grade: ${grade}`);
  console.log(`[site-audit-ci] Findings: ${data.findings?.length ?? 0}`);

  if (risk.length > 0) {
    console.log("[site-audit-ci] Top findings:");
    for (const finding of risk.slice(0, 5)) {
      console.log(`  - ${finding}`);
    }
  }

  if (score < minScore) {
    console.error(`[site-audit-ci] Failing build: score ${score} is below threshold ${minScore}.`);
    process.exit(1);
  }

  console.log("[site-audit-ci] Audit passed.");
} catch (error) {
  console.error("[site-audit-ci] Unexpected error:", error);
  process.exit(1);
}

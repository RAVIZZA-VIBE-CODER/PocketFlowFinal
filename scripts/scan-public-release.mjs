import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const forbidden = [
  /moltbook_sk_/i,
  /(?:^|[^A-Za-z])(?:api[_-]?key|token|password|secret)\s*[:=]\s*['"][^'"\r\n]{8,}/i,
  /BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY/i,
  /ghp_[A-Za-z0-9_]{20,}/i,
  /github_pat_[A-Za-z0-9_]{20,}/i,
  /sk-[A-Za-z0-9_-]{20,}/i,
  /\b10\.\d+\.\d+\.\d+\b/,
  /100\.\d+\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
];
const skipDirs = new Set([".git", "node_modules", "dist-lakehouse-public"]);
const binary = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|zip|gz|mp4|mov|pdf)$/i;
let findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (binary.test(entry.name)) continue;
    const rel = path.relative(root, full);
    if (rel === "scripts/scan-public-release.mjs" || rel === "package-lock.json" || rel.endsWith("/package-lock.json")) continue;
    const text = fs.readFileSync(full, "utf8");
    const emails = text.match(emailPattern) || [];
    emails
      .filter((email) => !/@(?:example|domain)\.com$/i.test(email))
      .forEach(() => findings.push({ file: rel, rule: "non-example email address" }));
    forbidden.forEach((rule) => {
      if (rule.test(text)) findings.push({ file: rel, rule: String(rule) });
    });
  }
}

walk(root);
if (findings.length) {
  console.error("Public release scan failed:");
  findings.slice(0, 80).forEach((finding) => console.error(`- ${finding.file}: ${finding.rule}`));
  process.exit(1);
}
console.log("Public release scan passed.");

export function auditPublicClaims(texts) {
  const copy = texts.join("\n").toLowerCase();
  const findings = [];
  if (!copy.includes("advisory") || !copy.includes("bypassable")) findings.push("public copy must state advisory and bypassable scope");
  if (copy.includes("non-bypassable")) findings.push("public copy must not claim non-bypassable enforcement");
  for (const stale of ["keypair", "@solana/web3", "local signing", "acp_executable", "implementation validated"]) {
    if (copy.includes(stale)) findings.push(`public copy must not retain stale ${stale} wording`);
  }
  for (const claim of ["hard enforcement", "post-execution intent matching"]) {
    const index = copy.indexOf(claim);
    if (index >= 0 && !/\b(not|no|does not|doesn't)\b/.test(copy.slice(Math.max(0, index - 40), index))) findings.push(`public copy must not claim ${claim}`);
  }
  return findings;
}

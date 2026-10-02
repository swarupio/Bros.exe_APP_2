import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const today = /^\d{4}-\d{2}-\d{2}$/;
const packsDir = resolve(root, "packs");
const packFiles = readdirSync(packsDir).filter((name) => name.endsWith(".json")).sort();
assert.deepEqual(packFiles, ["consumer.json", "cyber_fraud.json", "rent_deposit.json"]);

const packIds = new Set();
const claimIds = new Set();
for (const file of packFiles) {
  const pack = readJson(`packs/${file}`);
  assert.ok(pack.pack_id && !packIds.has(pack.pack_id), `${file}: duplicate or missing pack_id`);
  packIds.add(pack.pack_id);
  assert.ok(Array.isArray(pack.match_hints) && pack.match_hints.length, `${file}: add match hints`);
  for (const claim of pack.claims ?? []) {
    assert.ok(claim.id && !claimIds.has(claim.id), `${file}: duplicate or missing claim ID`);
    claimIds.add(claim.id);
    assert.ok(claim.source?.name?.trim(), `${file}/${claim.id}: source.name is required`);
    assert.ok(["verified", "seed", "draft"].includes(claim.status), `${file}/${claim.id}: invalid status`);
    assert.ok(today.test(claim.last_checked), `${file}/${claim.id}: last_checked must be YYYY-MM-DD`);
    if (claim.status === "verified") {
      assert.ok(claim.verified_by?.trim() && today.test(claim.verified_on), `${file}/${claim.id}: human verifier and verification date are required`);
      assert.ok(/^https:\/\//.test(claim.source.url ?? ""), `${file}/${claim.id}: official source URL is required to verify`);
    }
    if (claim.deadline_rule) assert.equal(claim.status, "verified", `${file}/${claim.id}: deadlines require a verified claim`);
  }
}

const resources = readJson("resources.json");
assert.ok(resources.version && Array.isArray(resources.resources), "resources.json needs a version and resources array");
const resourceIds = new Set();
for (const resource of resources.resources) {
  assert.ok(resource.id && !resourceIds.has(resource.id), `${resource.id}: duplicate or missing resource ID`);
  resourceIds.add(resource.id);
  assert.ok(resource.name?.trim() && resource.type?.trim(), `${resource.id}: name and type are required`);
  assert.ok(["verified", "seed", "draft"].includes(resource.status), `${resource.id}: invalid status`);
  assert.ok(today.test(resource.last_checked), `${resource.id}: last_checked must be YYYY-MM-DD`);
  if (resource.status === "verified") {
    assert.ok(resource.verified_by?.trim() && today.test(resource.verified_on), `${resource.id}: human verifier and date are required`);
    assert.ok(/^https:\/\//.test(resource.url ?? ""), `${resource.id}: source URL is required to verify`);
  }
  assert.ok(resource.status === "draft" || resource.phone || resource.url, `${resource.id}: needs a phone or URL`);
}

const terms = readJson("emergency_terms.json");
for (const locale of ["en", "hi", "mr"]) {
  assert.ok(terms.locales[locale]?.terms?.length, `missing emergency terms for ${locale}`);
  assert.ok(terms.locales[locale]?.negations?.length, `missing negation terms for ${locale}`);
}

console.log(`Knowledge checks passed: ${packFiles.length} packs, ${claimIds.size} claims, ${resourceIds.size} resources, and three emergency locales.`);

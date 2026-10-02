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
const checkCoverage=(entry) => {
  if (entry.coverage) {
    assert.ok(Object.keys(entry.coverage).every(key => ['state','district','city'].includes(key)),`${entry.id}: invalid coverage key`);
    assert.ok(Object.values(entry.coverage).every(v => typeof v==='string' && v.trim()),`${entry.id}: coverage values must be nonblank`);
    assert.ok(entry.coverage.state,`${entry.id}: local coverage requires state`);
  }
  if (entry.roles) assert.ok(Array.isArray(entry.roles) && entry.roles.every(r => ['affected_person','other_side','helper'].includes(r)),`${entry.id}: invalid roles`);
};
for (const file of packFiles) {
  const pack = readJson(`packs/${file}`);
  assert.ok(pack.pack_id && !packIds.has(pack.pack_id), `${file}: duplicate or missing pack_id`);
  packIds.add(pack.pack_id);
  assert.ok(Array.isArray(pack.match_hints) && pack.match_hints.length, `${file}: add match hints`);
  for (const claim of pack.claims ?? []) {
    assert.ok(claim.id && !claimIds.has(claim.id), `${file}: duplicate or missing claim ID`);
    claimIds.add(claim.id);
    checkCoverage(claim);
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
  checkCoverage(resource);
  assert.ok(['national','state','district','city'].includes(resource.scope),`${resource.id}: invalid scope`);
  if (resource.scope!=='national') {
    assert.ok(resource.coverage?.state,`${resource.id}: local resource needs coverage.state`);
    if (resource.scope!=='state') assert.ok(resource.coverage[resource.scope],`${resource.id}: coverage must match scope`);
  }
  if (resource.pack_ids) assert.ok(Array.isArray(resource.pack_ids) && resource.pack_ids.every(id => packIds.has(id)),`${resource.id}: unknown topic`);
  assert.ok(resource.name?.trim() && resource.type?.trim(), `${resource.id}: name and type are required`);
  assert.ok(["verified", "seed", "draft"].includes(resource.status), `${resource.id}: invalid status`);
  assert.ok(today.test(resource.last_checked), `${resource.id}: last_checked must be YYYY-MM-DD`);
  if (resource.status === "verified") {
    assert.ok(resource.verified_by?.trim() && today.test(resource.verified_on), `${resource.id}: human verifier and date are required`);
    assert.ok(/^https:\/\//.test(resource.url ?? ""), `${resource.id}: source URL is required to verify`);
  }
  assert.ok(resource.status === "draft" || resource.phone || resource.url, `${resource.id}: needs a phone or URL`);
}

const retrieval=readJson('retrieval.json');
assert.ok(retrieval.version && retrieval.topics && retrieval.resource_topics,'retrieval.json: version/topics/resource_topics required');
for (const [id,aliases] of Object.entries(retrieval.topics)) {
  assert.ok(packIds.has(id),`retrieval.json: unknown pack ${id}`);
  assert.ok(Array.isArray(aliases) && aliases.every(a => typeof a==='string' && a.trim()),`retrieval.json: invalid aliases ${id}`);
}
for (const [id,topics] of Object.entries(retrieval.resource_topics)) {
  assert.ok(resourceIds.has(id),`retrieval.json: unknown resource ${id}`);
  assert.ok(Array.isArray(topics) && topics.every(t => packIds.has(t)),`retrieval.json: invalid resource topics ${id}`);
}
assert.ok(Array.isArray(retrieval.safety_resources) && retrieval.safety_resources.every(id => resourceIds.has(id)),'retrieval.json: unknown safety resource');

const terms = readJson("emergency_terms.json");
for (const locale of ["en", "hi", "mr"]) {
  assert.ok(terms.locales[locale]?.terms?.length, `missing emergency terms for ${locale}`);
  assert.ok(terms.locales[locale]?.negations?.length, `missing negation terms for ${locale}`);
}

console.log(`Knowledge checks passed: ${packFiles.length} packs, ${claimIds.size} claims, ${resourceIds.size} resources, and three emergency locales.`);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { detectEmergency } from "../emergency.mjs";

const terms = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../emergency_terms.json"), "utf8")).locales;
const positives = [
  "Someone threatened to harm me.",
  "They are threatening me right now.",
  "I was assaulted today.",
  "Someone hit me.",
  "I am afraid he will hurt me.",
  "They are attacking me now.",
  "There is violence in my home.",
  "They have a weapon and threatened me.",
  "Mere saath maar peet hui.",
  "Woh mujhe dhamki de raha hai.",
  "मुझे जान से मारने की धमकी दी।",
  "माझ्यावर हल्ला झाला.",
];
const negatives = [
  "He did not threaten me.",
  "They never threatened to harm me.",
  "She didn't hit me.",
  "उसने मुझे धमकी नहीं दी।",
  "धमकी नहीं मिली।",
  "त्याने मला धमकी दिली नाही.",
  "धमकी नव्हती.",
  "I am writing a school essay about law.",
];

for (const prompt of positives) assert.equal(detectEmergency(prompt, terms).urgent, true, `Expected urgent: ${prompt}`);
for (const prompt of negatives) assert.equal(detectEmergency(prompt, terms).urgent, false, `Expected no urgency: ${prompt}`);
assert.deepEqual(detectEmergency("   ", terms), { urgent: false, reasons: [] });
console.log(`Emergency check passed: ${positives.length} positive, ${negatives.length} negative/negation, and empty input.`);

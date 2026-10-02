import assert from "node:assert/strict";
import { classifyIssue, getFollowUps } from "../components/intake-questions.ts";

for (const [story, expected] of [
  ["My landlord has not returned my deposit", "rental"],
  ["I sent money through UPI after an online scam", "fraud"],
  ["My employer has not paid my salary", "wages"],
  ["The seller refuses to refund my defective product", "consumer"],
  ["The police station would not register my FIR", "police"],
  ["I need help with a hospital bill", "health"],
  ["My bank added an unexpected charge", "financial"],
  ["I was threatened and I feel unsafe", "criminal"],
  ["I need to understand child custody options", "family"],
  ["I need help understanding a difficult situation", "general"],
  ["मकान मालिक ने जमा राशि वापस नहीं की", "rental"],
  ["माझ्या बँकेतून पैसे गेले, ही फसवणूक आहे", "fraud"],
  ["मुझे अस्पताल के बिल में मदद चाहिए", "health"],
  ["माझा पगार अजून मिळाला नाही", "wages"],
  ["makan malik ne deposit wapas nahi kiya", "rental"],
]) {
  assert.equal(classifyIssue(story), expected, `classifies: ${story}`);
  assert.ok(getFollowUps(expected, {}).length <= 3, `${expected} asks no more than three questions`);
}

assert.equal(getFollowUps("fraud", { provider_contacted: "Yes" }).at(-1)?.id, "provider_response");
assert.equal(getFollowUps("fraud", { provider_contacted: "Not yet" }).at(-1)?.id, "payment_method");
assert.equal(getFollowUps("rental", { landlord_response: "They returned some of it" })[1]?.id, "deposit_due");
assert.equal(getFollowUps("rental", { landlord_response: "They refused to return it" })[1]?.id, "move_out_timing");
for (const issue of ["health", "financial", "criminal", "family"]) {
  assert.ok(getFollowUps(issue, {}).length <= 3, `${issue} asks no more than three questions`);
}

console.log("Personalized intake question checks passed.");
assert.equal(classifyIssue('This is the first problem my parent and I have discussed.'),'general');
assert.equal(classifyIssue('My landlord refuses to refund my rental deposit.'),'rental');
assert.equal(classifyIssue('My apartment landlord has not returned the security deposit.'),'rental');

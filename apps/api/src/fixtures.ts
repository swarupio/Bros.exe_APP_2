import { intakeResponseSchema } from "@kayda-sathi/shared";

export function mockIntake(caseId: string) {
  return intakeResponseSchema.parse({
    case_id: caseId,
    title: "Rent deposit partly returned",
    issue_tags: ["housing", "deposit"],
    pack_id: "rent_deposit",
    urgency: "none",
    safety_reasons: [],
    user_role: "affected_person",
    facts: [{
      key: "amount_paid", label: "Deposit paid", kind: "amount", value: { inr: 50000 },
      raw_text: "pachaas hazaar", status: "proposed", source: "user",
    }],
    questions: [{
      id: "q1", key: "date_move_out", text: "When did you move out?", answer_type: "date",
      options: null, why: "Affects what to do next",
    }],
    restatement: "You paid ₹50,000 deposit and ₹15,000 has been returned.",
    fallback: true,
  });
}

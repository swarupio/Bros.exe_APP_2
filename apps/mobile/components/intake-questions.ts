export type IssueType = "rental" | "fraud" | "financial" | "wages" | "consumer" | "police" | "criminal" | "health" | "family" | "general";

export type FollowUp = {
  id: string;
  question: string;
  hint?: string;
  type: "text" | "choice";
  options?: string[];
};

const includes = (text: string, words: string[]) => words.some(word => {
  const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{M}\\p{N}_])`,'u').test(text);
});

export function classifyIssue(story: string): IssueType {
  const text = story.toLowerCase();
  if (includes(text, ["upi", "scam", "fraud", "phishing", "otp", "cyber", "online payment", "money stolen", "धोखाधड़ी", "ठगी", "यूपीआई", "ओटीपी", "पैसे चोरी", "फसवणूक", "पैसे गेले", "paisa chori"])) return "fraud";
  if (includes(text, ["fir", "police", "station", "complaint not registered", "एफआईआर", "पुलिस", "थाना", "पोलीस", "तक्रार नोंद", "police complaint"])) return "police";
  if (includes(text, ["assault", "arrest", "threatened", "stalking", "violence", "stole my", "criminal case", "मारपीट", "धमकी", "पीछा करना", "हिंसा", "असुरक्षित", "मारहाण", "पाठलाग", "दादागिरी", "dhamki"])) return "criminal";
  if (includes(text, ["doctor", "hospital", "medicine", "symptom", "diagnosis", "health", "medical", "injury", "डॉक्टर", "अस्पताल", "दवा", "लक्षण", "स्वास्थ्य", "चिकित्सा", "इलाज", "चोट", "रुग्णालय", "औषध", "आरोग्य", "उपचार", "जखम"])) return "health";
  if (includes(text, ["divorce", "custody", "marriage", "family dispute", "maintenance", "inheritance", "तलाक", "हिरासत", "शादी", "पारिवारिक विवाद", "भरण-पोषण", "विरासत", "घटस्फोट", "मुलांचा ताबा", "कौटुंबिक", "पोटगी", "वारसा"])) return "family";
  if (includes(text, ["salary", "wage", "payroll", "employer", "unpaid pay", "not paid my salary", "वेतन", "मजदूरी", "तनख्वाह", "पगार", "मजुरी", "नियोक्ता", "मालिक ने वेतन", "salary nahi mila", "pagar milala nahi"])) return "wages";
  if (includes(text,["landlord","tenant","rental","moved out","मकान मालिक","किरायेदार","घरमालक","भाडेकरू"])) return 'rental';
  if (includes(text, ["refund", "seller", "defective", "product", "order", "service provider", "consumer", "रिफंड", "विक्रेता", "खराब उत्पाद", "उपभोक्ता", "परतावा", "दोषपूर्ण", "उत्पादन", "ग्राहक"])) return "consumer";
  if (includes(text, ["loan", "debt", "bank", "insurance", "credit card", "bill", "investment", "pension", "benefit", "ऋण", "कर्ज", "बैंक", "बीमा", "क्रेडिट कार्ड", "बिल", "निवेश", "पेंशन", "लाभ", "बँक", "विमा", "गुंतवणूक"])) return "financial";
  if (includes(text, ["landlord", "deposit", "rent", "tenant", "rental", "moved out", "मकान मालिक", "जमा राशि", "किराया", "किरायेदार", "भाड़ा", "घर खाली", "डिपॉज़िट", "घरमालक", "ठेव", "भाडे", "भाडेकरू", "घर सोडले", "makan malik", "kiraya", "bhada"])) return "rental";
  return "general";
}

export function issueLabel(issue: IssueType) {
  return ({ rental: "Rental or deposit", fraud: "Online payment or fraud", financial: "Money or financial issue", wages: "Unpaid wages", consumer: "Product or refund", police: "Police complaint", criminal: "Personal safety or crime", health: "Health-related issue", family: "Family or relationship issue", general: "Your situation" })[issue];
}

export function getFollowUps(issue: IssueType, answers: Record<string, string>): FollowUp[] {
  switch (issue) {
    case "rental":
      return [
        { id: "landlord_response", question: "What has the landlord said about the deposit?", type: "choice", options: ["They returned some of it", "They refused to return it", "They have not responded", "They are still reviewing it"] },
        answers.landlord_response === "They returned some of it"
          ? { id: "deposit_due", question: "How much deposit is still unpaid?", hint: "An estimate is fine.", type: "text" }
          : { id: "move_out_timing", question: "When did you move out or ask for the deposit back?", type: "text" },
        { id: "location", question: "Which city or district did this happen in?", hint: "This can affect which local guidance applies.", type: "text" },
      ];
    case "fraud":
      return [
        { id: "payment_timing", question: "When did the payment or suspicious activity happen?", type: "choice", options: ["Today", "In the last few days", "More than a week ago", "I’m not sure"] },
        { id: "provider_contacted", question: "Have you contacted your bank or payment app about it?", type: "choice", options: ["Yes", "Not yet", "I’m not sure who to contact"] },
        answers.provider_contacted === "Yes"
          ? { id: "provider_response", question: "What happened after you contacted them?", type: "text" }
          : { id: "payment_method", question: "How was the payment made?", type: "choice", options: ["UPI", "Bank transfer", "Card", "Wallet", "Something else", "I’m not sure"] },
      ];
    case "wages":
      return [
        { id: "salary_due", question: "Which pay period or payday is unpaid?", type: "text", hint: "For example, March salary or payday on 5 June." },
        { id: "employer_response", question: "What has your employer said about the payment?", type: "choice", options: ["They said it will be paid", "They disputed the amount", "They have not responded", "I have not asked yet"] },
        { id: "work_location", question: "Where were you working?", type: "text", hint: "City or district is enough." },
      ];
    case "consumer":
      return [
        { id: "purchase", question: "What did you buy or pay for?", type: "text" },
        { id: "seller_response", question: "What happened when you asked the seller for help?", type: "choice", options: ["They refused", "They have not replied", "They offered a solution", "I have not contacted them yet"] },
        { id: "purchase_location", question: "Where is the seller or service based?", hint: "City or district, if you know it.", type: "text" },
      ];
    case "police":
      return [
        { id: "complaint_status", question: "What happened when you tried to report it?", type: "choice", options: ["A complaint was recorded", "They declined to record it", "I have not gone yet", "I’m not sure"] },
        { id: "complaint_timing", question: "When did you first try to report it?", type: "text" },
        { id: "incident_location", question: "Where did the incident happen?", hint: "City or district is enough.", type: "text" },
      ];
    case "criminal":
      return [
        { id: "safe_now", question: "Are you somewhere safe right now?", type: "choice", options: ["Yes", "No", "I’m not sure"] },
        { id: "incident_reported", question: "Has this been reported to an appropriate service or authority?", type: "choice", options: ["Yes", "No", "I’m not sure"] },
        { id: "incident_location", question: "Which city or district is this about?", hint: "Only share what feels safe.", type: "text" },
      ];
    case "health":
      return [
        { id: "urgent_care", question: "Does anyone need urgent medical attention right now?", type: "choice", options: ["Yes", "No", "I’m not sure"] },
        { id: "health_help", question: "What kind of help are you looking for?", hint: "For example, organizing care, a bill, or a service concern. Avoid sharing private medical details.", type: "text" },
        { id: "health_location", question: "Which city or district are you in?", type: "text" },
      ];
    case "financial":
      return [
        { id: "financial_issue", question: "What is the money issue about?", type: "choice", options: ["Loan or debt", "Bank or card charge", "Insurance or benefit", "Bill or payment dispute", "Something else"] },
        { id: "financial_contact", question: "Have you contacted the bank, provider, or organization involved?", type: "choice", options: ["Yes, and they replied", "Yes, waiting for a reply", "Not yet", "Not applicable"] },
        { id: "financial_location", question: "Which city or district is this connected to?", type: "text" },
      ];
    case "family":
      return [
        { id: "family_topic", question: "What would you like help understanding?", type: "choice", options: ["Separation or divorce", "Children or care arrangements", "Family property or inheritance", "A safety concern", "Something else"] },
        { id: "family_urgency", question: "Is there an urgent date, notice, or immediate safety concern?", type: "choice", options: ["Yes", "No", "I’m not sure"] },
        { id: "family_location", question: "Which city or district is this about?", type: "text" },
      ];
    default:
      return [
        { id: "desired_outcome", question: "What would a helpful outcome look like for you?", type: "choice", options: ["Get money back", "Resolve the issue", "Understand my options", "Prepare a complaint or message", "Something else"] },
        answers.desired_outcome === "Something else"
          ? { id: "other_outcome", question: "What would you like to happen?", type: "text" }
          : { id: "other_party_response", question: "Have you already raised this with the other person or organization?", type: "choice", options: ["Yes, they responded", "Yes, but no response", "Not yet", "There is no other party"] },
        { id: "location", question: "Which city or district did this happen in?", type: "text" },
      ];
  }
}

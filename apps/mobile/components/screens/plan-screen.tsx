"use client";

import { useEffect, useState } from "react";
import { useDemoCase } from "@/components/demo-store";
import { BackLink, Icon, LocalNotice, PageHeading, PrimaryLink } from "@/components/ui";
import { classifyIssue } from "@/components/intake-questions";
import { useLanguage } from "@/components/language";
import { apiRequest } from "@/lib/supabase";

const preparationByIssue = {
  rental: { title: "Keep a clear record of the deposit.", body: "Save your rental agreement, proof of payment, move-out notes or photos, and messages about the refund.", items: ["Rental agreement or rent receipts", "Proof of deposit and amount returned", "Move-out notes and refund messages"] },
  fraud: { title: "Keep the payment trail together.", body: "Save the transaction reference, messages or links connected to the incident, and any response from your bank or payment app.", items: ["Payment reference or bank statement", "Messages, links, or call details", "Bank or payment app complaint update"] },
  financial: { title: "Organize the money records.", body: "Keep statements, agreements, bills, and written responses together. Hide account numbers before sharing copies.", items: ["Relevant agreement, statement, or bill", "Dates and amounts involved", "Messages or complaint reference"] },
  wages: { title: "Put the unpaid pay details in order.", body: "Keep records of your work, the pay period involved, and messages about when payment is due.", items: ["Employment or work records", "Payslip, attendance, or hours worked", "Messages about the unpaid amount"] },
  consumer: { title: "Keep purchase and refund records together.", body: "Save proof of purchase, details of the issue, and the seller’s response to your request.", items: ["Invoice or order confirmation", "Photos or notes about the product or service", "Refund request and seller response"] },
  police: { title: "Write down the reporting timeline.", body: "Keep the dates and places you reported the incident, along with any complaint acknowledgement or response you received.", items: ["Incident date and location", "Complaint copy or acknowledgement", "Notes about the response you received"] },
  criminal: { title: "Keep a safe, factual record.", body: "If it is safe to do so, note dates and preserve relevant messages or documents. Avoid confronting anyone if that could increase risk.", items: ["A simple timeline of events", "Relevant messages or documents", "Any report or reference details"] },
  health: { title: "Organize care and service records.", body: "Keep appointment details, bills, and communications together. Share medical information only with people you trust.", items: ["Appointment or service dates", "Relevant bills or receipts", "Messages with the provider"] },
  family: { title: "Gather the records relevant to your concern.", body: "Keep notices, agreements, and key dates together. Share personal or family information only when needed and with a trusted professional.", items: ["Relevant notices or agreements", "A short timeline of important dates", "Questions you want answered"] },
  general: { title: "Gather a clear record of what happened.", body: "Keep relevant messages, payment records, and a short timeline together. You decide what to use or share.", items: ["Proof or records related to the issue", "Messages about what happened", "A simple timeline of events"] },
} as const;

const localizedPreparation = {
  hi: {
    rental: ["जमानत राशि का स्पष्ट रिकॉर्ड रखें।", "किराया समझौता, भुगतान का प्रमाण, घर छोड़ते समय के नोट या तस्वीरें और वापसी से जुड़े संदेश रखें।", "किराया समझौता या रसीदें", "जमा राशि और लौटाई गई रकम का प्रमाण", "घर छोड़ने के नोट और वापसी के संदेश"],
    fraud: ["भुगतान से जुड़े सभी रिकॉर्ड साथ रखें।", "लेन-देन संदर्भ, घटना से जुड़े संदेश या लिंक और बैंक अथवा भुगतान ऐप का जवाब सुरक्षित रखें।", "भुगतान संदर्भ या बैंक विवरण", "संदेश, लिंक या कॉल का विवरण", "बैंक या भुगतान ऐप की शिकायत का अपडेट"],
    financial: ["पैसों से जुड़े रिकॉर्ड व्यवस्थित करें।", "स्टेटमेंट, समझौते, बिल और लिखित जवाब साथ रखें। कॉपी साझा करने से पहले खाता नंबर छिपाएँ।", "संबंधित समझौता, स्टेटमेंट या बिल", "संबंधित तारीखें और रकम", "संदेश या शिकायत संदर्भ"],
    wages: ["बकाया वेतन का विवरण क्रम में रखें।", "काम, संबंधित वेतन अवधि और भुगतान की तारीख के बारे में हुए संदेशों का रिकॉर्ड रखें।", "नौकरी या काम के रिकॉर्ड", "वेतन पर्ची, उपस्थिति या काम के घंटे", "बकाया रकम के बारे में संदेश"],
    consumer: ["खरीद और रिफंड के रिकॉर्ड साथ रखें।", "खरीद का प्रमाण, समस्या का विवरण और विक्रेता का जवाब सुरक्षित रखें।", "चालान या ऑर्डर की पुष्टि", "उत्पाद या सेवा की तस्वीरें या नोट", "रिफंड अनुरोध और विक्रेता का जवाब"],
    police: ["रिपोर्ट करने की समय-रेखा लिखें।", "घटना की तारीख और रिपोर्ट करने की जगह के साथ शिकायत की पावती या जवाब रखें।", "घटना की तारीख और जगह", "शिकायत की कॉपी या पावती", "मिले हुए जवाब के बारे में नोट"],
    criminal: ["सुरक्षित और तथ्यात्मक रिकॉर्ड रखें।", "यदि सुरक्षित हो, तो तारीखें लिखें और संबंधित संदेश या दस्तावेज़ सुरक्षित रखें। जोखिम बढ़ने पर किसी का सामना न करें।", "घटनाओं की सरल समय-रेखा", "संबंधित संदेश या दस्तावेज़", "रिपोर्ट या संदर्भ का विवरण"],
    health: ["इलाज और सेवा के रिकॉर्ड व्यवस्थित रखें।", "अपॉइंटमेंट, बिल और बातचीत का विवरण साथ रखें। चिकित्सा जानकारी केवल भरोसेमंद लोगों से साझा करें।", "अपॉइंटमेंट या सेवा की तारीखें", "संबंधित बिल या रसीदें", "सेवा प्रदाता के साथ संदेश"],
    family: ["समस्या से जुड़े रिकॉर्ड इकट्ठा करें।", "नोटिस, समझौते और जरूरी तारीखें साथ रखें। निजी पारिवारिक जानकारी केवल जरूरत पर और भरोसेमंद पेशेवर से साझा करें।", "संबंधित नोटिस या समझौते", "जरूरी तारीखों की छोटी समय-रेखा", "वे सवाल जिनके जवाब चाहिए"],
    general: ["घटना का स्पष्ट रिकॉर्ड इकट्ठा करें।", "संबंधित संदेश, भुगतान रिकॉर्ड और छोटी समय-रेखा साथ रखें। क्या उपयोग या साझा करना है, यह आपका निर्णय है।", "समस्या से जुड़े प्रमाण या रिकॉर्ड", "घटना के बारे में संदेश", "घटनाओं की सरल समय-रेखा"],
  },
  mr: {
    rental: ["ठेवीचा स्पष्ट हिशेब ठेवा.", "भाडेकरार, पेमेंटचा पुरावा, घर सोडतानाच्या नोंदी किंवा फोटो आणि परताव्याबद्दलचे संदेश जतन करा.", "भाडेकरार किंवा भाड्याच्या पावत्या", "ठेव आणि परत मिळालेल्या रकमेचा पुरावा", "घर सोडल्याच्या नोंदी आणि परताव्याचे संदेश"],
    fraud: ["पेमेंटचे सर्व पुरावे एकत्र ठेवा.", "व्यवहार क्रमांक, घटनेशी संबंधित संदेश किंवा लिंक आणि बँक अथवा पेमेंट अॅपचे उत्तर जतन करा.", "व्यवहार क्रमांक किंवा बँक स्टेटमेंट", "संदेश, लिंक किंवा कॉलचा तपशील", "बँक किंवा पेमेंट अॅप तक्रारीची स्थिती"],
    financial: ["आर्थिक नोंदी व्यवस्थित ठेवा.", "स्टेटमेंट, करार, बिले आणि लेखी उत्तरे एकत्र ठेवा. प्रत शेअर करण्यापूर्वी खाते क्रमांक लपवा.", "संबंधित करार, स्टेटमेंट किंवा बिल", "संबंधित तारखा आणि रक्कम", "संदेश किंवा तक्रार क्रमांक"],
    wages: ["थकीत पगाराचा तपशील क्रमाने ठेवा.", "कामाची नोंद, संबंधित वेतनाचा कालावधी आणि पेमेंटबद्दलचे संदेश जतन करा.", "नोकरी किंवा कामाच्या नोंदी", "पगारपत्रक, उपस्थिती किंवा कामाचे तास", "थकीत रकमेबद्दलचे संदेश"],
    consumer: ["खरेदी आणि परताव्याच्या नोंदी एकत्र ठेवा.", "खरेदीचा पुरावा, समस्येचा तपशील आणि विक्रेत्याचे उत्तर जतन करा.", "चलन किंवा ऑर्डरची पुष्टी", "उत्पादन किंवा सेवेचे फोटो किंवा नोंदी", "परताव्याची विनंती आणि विक्रेत्याचे उत्तर"],
    police: ["तक्रार नोंदवण्याची कालरेषा लिहा.", "घटनेची तारीख व तक्रार दिलेली ठिकाणे, तसेच पोचपावती किंवा उत्तर जतन करा.", "घटनेची तारीख आणि ठिकाण", "तक्रारीची प्रत किंवा पोचपावती", "मिळालेल्या उत्तराच्या नोंदी"],
    criminal: ["सुरक्षित आणि वस्तुनिष्ठ नोंद ठेवा.", "सुरक्षित असल्यास तारखा लिहा आणि संबंधित संदेश किंवा कागदपत्रे जतन करा. धोका वाढू शकत असल्यास कोणाला सामोरे जाऊ नका.", "घटनांची सोपी कालरेषा", "संबंधित संदेश किंवा कागदपत्रे", "तक्रार किंवा संदर्भ तपशील"],
    health: ["उपचार आणि सेवेच्या नोंदी व्यवस्थित ठेवा.", "भेटी, बिले आणि संवादाची माहिती एकत्र ठेवा. वैद्यकीय माहिती फक्त विश्वासू लोकांशी शेअर करा.", "भेटी किंवा सेवेच्या तारखा", "संबंधित बिले किंवा पावत्या", "सेवा पुरवठादारासोबतचे संदेश"],
    family: ["तुमच्या प्रश्नाशी संबंधित नोंदी गोळा करा.", "नोटिसा, करार आणि महत्त्वाच्या तारखा एकत्र ठेवा. वैयक्तिक कौटुंबिक माहिती गरज असेल तेव्हाच विश्वासू तज्ज्ञाशी शेअर करा.", "संबंधित नोटिसा किंवा करार", "महत्त्वाच्या तारखांची छोटी कालरेषा", "तुम्हाला विचारायचे असलेले प्रश्न"],
    general: ["घटनेची स्पष्ट नोंद गोळा करा.", "संबंधित संदेश, पेमेंटच्या नोंदी आणि छोटी कालरेषा एकत्र ठेवा. काय वापरायचे किंवा शेअर करायचे ते तुम्ही ठरवा.", "समस्येशी संबंधित पुरावे किंवा नोंदी", "घटनेबद्दलचे संदेश", "घटनांची सोपी कालरेषा"],
  },
} as const;

export function PlanScreen() {
  const { language, t } = useLanguage();
  const { record, ready, save } = useDemoCase();
  const issue = record ? classifyIssue(record.story) : "general";
  const base = preparationByIssue[issue];
  const localized = language === "en" ? null : localizedPreparation[language][issue];
  const preparation = localized ? { title: localized[0], body: localized[1], items: localized.slice(2) } : base;
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!record?.caseId || record.plan) return;
    let active = true;
    apiRequest<{ content: { next_step: { title: string; why: string }; documents: Array<{ label: string }> } }>("/ai/plan", {
      case_id: record.caseId, request_id: crypto.randomUUID(), trigger: record.planNeedsUpdate ? "update" : "initial", explain_lang: language,
    }).then(result => {
      if (active) save({ ...record, plan: { title: result.content.next_step.title, body: result.content.next_step.why, items: result.content.documents.slice(0, 3).map(item => item.label) }, planNeedsUpdate: false });
    }).catch(reason => { if (active) setMessage(reason instanceof Error ? reason.message : "Could not load the online plan."); });
    return () => { active = false; };
  }, [language, record?.caseId, record?.plan, record?.planNeedsUpdate]);

  const serverPlan = record?.plan;
  const plan = serverPlan ?? preparation;

  if (ready && !record) return <main className="page-content flow-page"><BackLink href="/">{t("allCases")}</BackLink><PageHeading title={t("startStory")} description={t("createBeforePlan")}/><PrimaryLink href="/cases/new/">{t("startCase")}</PrimaryLink></main>;

  return <main className="page-content flow-page">
    <BackLink href="/">{t("allCases")}</BackLink>
    {!ready || !record ? <p className="loading-copy">{t("loadingCase")}</p> : <>
      <div className="case-context-row"><span>{record.title}</span><span>{language === "en" ? "Open · Preparation" : language === "hi" ? "खुला · तैयारी" : "सुरू · तयारी"}</span></div>
      <PageHeading title={t("nextStep")} description={t("nextStepDesc")}/>
      <section className="next-step">
        <span className="step-number">01</span>
        <h2>{plan.title}</h2>
        <p>{plan.body} {language === "en" ? "You decide what to use or share." : language === "hi" ? "क्या उपयोग या साझा करना है, यह आपका निर्णय है।" : "काय वापरायचे किंवा शेअर करायचे ते तुम्ही ठरवा."}</p>
        <p className="guidance-label"><Icon name="shield" size={16}/>{t("preparationOnly")}</p>
      </section>

      <section className="preparation-list" aria-labelledby="prep-title">
        <div className="section-heading"><h2 id="prep-title">{t("gather")}</h2><span>{record.checked.filter(Boolean).length} {t("ofThree")}</span></div>
        {plan.items.map((item, index) => <label className="check-row" key={item}>
          <input type="checkbox" checked={record.checked[index] ?? false} onChange={event => {
            const checked = [...record.checked];
            checked[index] = event.target.checked;
            save({ ...record, checked });
            if (record.caseId) apiRequest(`/cases/${record.caseId}/checklist`, { item_key: item, status: event.target.checked ? "have" : "unsure" }).catch(() => {});
          }}/>
          <span className="checkmark"><Icon name="check" size={14}/></span>
          <span>{item}</span>
        </label>)}
      </section>

      <LocalNotice>{t("planNotice")}</LocalNotice>
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="action-stack">
        <PrimaryLink href="/case/draft/">{t("prepareMessage")}<Icon name="arrow" size={17}/></PrimaryLink>
        <a className="text-link" href="/case/update/">{t("recordUpdate")}</a>
      </div>
    </>}
  </main>;
}

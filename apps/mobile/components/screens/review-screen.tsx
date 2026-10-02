"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDemoCase } from "@/components/demo-store";
import { getFollowUps, classifyIssue, issueLabel } from "@/components/intake-questions";
import { useLanguage, type AppLanguage } from "@/components/language";
import { LocalNotice, PageHeading, PrimaryLink } from "@/components/ui";
import { apiRequest } from "@/lib/supabase";

const SKIPPED = "__skipped__";

const issueNames: Record<AppLanguage, Record<string, string>> = {
  en: {},
  hi: { rental: "किराया या जमा राशि", fraud: "ऑनलाइन भुगतान या धोखाधड़ी", financial: "पैसे या वित्तीय समस्या", wages: "बकाया वेतन", consumer: "उत्पाद या रिफंड", police: "पुलिस शिकायत", criminal: "व्यक्तिगत सुरक्षा या अपराध", health: "स्वास्थ्य संबंधी समस्या", family: "परिवार या रिश्ते की समस्या", general: "आपकी स्थिति" },
  mr: { rental: "भाडे किंवा ठेव", fraud: "ऑनलाइन पेमेंट किंवा फसवणूक", financial: "पैशांची किंवा आर्थिक समस्या", wages: "थकीत वेतन", consumer: "उत्पादन किंवा परतावा", police: "पोलीस तक्रार", criminal: "वैयक्तिक सुरक्षा किंवा गुन्हा", health: "आरोग्याशी संबंधित समस्या", family: "कुटुंब किंवा नातेसंबंधांची समस्या", general: "तुमची परिस्थिती" },
};

// Keep the original English values in storage: getFollowUps uses them to select later questions.
const localizedQuestions: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: {
    landlord_response: "मकान-मालिक ने जमा राशि के बारे में क्या कहा?", deposit_due: "कितनी जमा राशि अभी वापस नहीं मिली?", move_out_timing: "आप कब घर से निकले या जमा राशि लौटाने को कहा?", location: "यह किस शहर या ज़िले में हुआ?",
    payment_timing: "भुगतान या संदिग्ध गतिविधि कब हुई?", provider_contacted: "क्या आपने अपने बैंक या पेमेंट ऐप से संपर्क किया?", provider_response: "संपर्क करने के बाद क्या हुआ?", payment_method: "भुगतान कैसे किया गया?",
    salary_due: "किस वेतन अवधि या वेतन-दिवस का भुगतान बाकी है?", employer_response: "भुगतान के बारे में आपके नियोक्ता ने क्या कहा?", work_location: "आप कहाँ काम कर रहे थे?", purchase: "आपने क्या खरीदा या किस चीज़ के लिए भुगतान किया?", seller_response: "मदद के लिए विक्रेता से संपर्क करने पर क्या हुआ?", purchase_location: "विक्रेता या सेवा किस जगह स्थित है?",
    complaint_status: "रिपोर्ट करने की कोशिश पर क्या हुआ?", complaint_timing: "आपने पहली बार रिपोर्ट करने की कोशिश कब की?", incident_location: "घटना कहाँ हुई?", safe_now: "क्या आप अभी सुरक्षित जगह पर हैं?", incident_reported: "क्या इसकी सूचना संबंधित सेवा या प्राधिकरण को दी गई है?", health: "स्वास्थ्य संबंधी समस्या", urgent_care: "क्या किसी को अभी तुरंत चिकित्सा सहायता चाहिए?", health_help: "आप किस तरह की मदद चाहते हैं?", health_location: "आप किस शहर या ज़िले में हैं?",
    financial_issue: "पैसों की समस्या किस बारे में है?", financial_contact: "क्या आपने संबंधित बैंक, सेवा प्रदाता या संस्था से संपर्क किया?", financial_location: "यह किस शहर या ज़िले से जुड़ी है?", family_topic: "आप किस बात को समझने में मदद चाहते हैं?", family_urgency: "क्या कोई ज़रूरी तारीख, नोटिस या तुरंत सुरक्षा की चिंता है?", family_location: "यह किस शहर या ज़िले से जुड़ा है?",
    desired_outcome: "आपके लिए अच्छा नतीजा कैसा होगा?", other_outcome: "आप क्या होना चाहते हैं?", other_party_response: "क्या आपने यह बात दूसरे व्यक्ति या संस्था के सामने रखी है?",
  },
  mr: {
    landlord_response: "घरमालकाने ठेवीबद्दल काय सांगितले?", deposit_due: "ठेवीतील किती रक्कम अजून मिळालेली नाही?", move_out_timing: "तुम्ही कधी घर सोडले किंवा ठेव परत मागितली?", location: "हे कोणत्या शहरात किंवा जिल्ह्यात घडले?",
    payment_timing: "पेमेंट किंवा संशयास्पद हालचाल कधी झाली?", provider_contacted: "तुम्ही बँक किंवा पेमेंट ॲपशी संपर्क केला आहे का?", provider_response: "संपर्क केल्यानंतर काय झाले?", payment_method: "पेमेंट कसे केले?",
    salary_due: "कोणत्या वेतन कालावधीचे किंवा पगाराच्या दिवसाचे पैसे बाकी आहेत?", employer_response: "पेमेंटबद्दल नियोक्त्याने काय सांगितले?", work_location: "तुम्ही कुठे काम करत होता?", purchase: "तुम्ही काय खरेदी केले किंवा कशासाठी पैसे दिले?", seller_response: "मदतीसाठी विक्रेत्याशी संपर्क केल्यावर काय झाले?", purchase_location: "विक्रेता किंवा सेवा कुठे आहे?",
    complaint_status: "तक्रार नोंदवण्याचा प्रयत्न केल्यावर काय झाले?", complaint_timing: "तुम्ही पहिल्यांदा तक्रार करण्याचा प्रयत्न कधी केला?", incident_location: "घटना कुठे घडली?", safe_now: "तुम्ही सध्या सुरक्षित ठिकाणी आहात का?", incident_reported: "याची योग्य सेवा किंवा अधिकाऱ्यांकडे नोंद केली आहे का?", urgent_care: "कोणाला आत्ता तातडीच्या वैद्यकीय मदतीची गरज आहे का?", health_help: "तुम्हाला कोणत्या प्रकारची मदत हवी आहे?", health_location: "तुम्ही कोणत्या शहरात किंवा जिल्ह्यात आहात?",
    financial_issue: "पैशांची समस्या कशाबद्दल आहे?", financial_contact: "तुम्ही संबंधित बँक, सेवा प्रदाता किंवा संस्थेशी संपर्क केला आहे का?", financial_location: "ही समस्या कोणत्या शहराशी किंवा जिल्ह्याशी संबंधित आहे?", family_topic: "तुम्हाला कोणती गोष्ट समजून घेण्यासाठी मदत हवी आहे?", family_urgency: "तातडीची तारीख, नोटीस किंवा सुरक्षिततेची चिंता आहे का?", family_location: "हे कोणत्या शहराशी किंवा जिल्ह्याशी संबंधित आहे?",
    desired_outcome: "तुमच्यासाठी योग्य तोडगा कसा असेल?", other_outcome: "तुम्हाला काय व्हावे असे वाटते?", other_party_response: "तुम्ही ही बाब संबंधित व्यक्ती किंवा संस्थेकडे मांडली आहे का?",
  },
};

const localizedHints: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: { deposit_due: "अनुमान भी ठीक है।", location: "इससे स्थानीय मार्गदर्शन तय हो सकता है।", salary_due: "उदाहरण: मार्च का वेतन या 5 जून का वेतन-दिवस।", work_location: "शहर या ज़िला बताना पर्याप्त है।", purchase_location: "यदि पता हो तो शहर या ज़िला बताएँ।", incident_location: "शहर या ज़िला बताना पर्याप्त है।", health_help: "जैसे देखभाल, बिल या सेवा संबंधी समस्या। निजी चिकित्सा जानकारी साझा न करें।", incident_location_safe: "सिर्फ वही बताएँ जो आपको सुरक्षित लगे।" },
  mr: { deposit_due: "अंदाजे रक्कम चालेल.", location: "यामुळे स्थानिक मार्गदर्शन ठरू शकते.", salary_due: "उदाहरण: मार्चचा पगार किंवा ५ जूनची पगाराची तारीख.", work_location: "शहर किंवा जिल्हा पुरेसा आहे.", purchase_location: "माहित असल्यास शहर किंवा जिल्हा सांगा.", incident_location: "शहर किंवा जिल्हा पुरेसा आहे.", health_help: "उदाहरणार्थ, उपचार, बिल किंवा सेवेची समस्या. खाजगी वैद्यकीय माहिती देऊ नका." },
};

const localizedOptions: Record<Exclude<AppLanguage, "en">, Record<string, string>> = {
  hi: {
    "They returned some of it": "उन्होंने कुछ राशि लौटा दी", "They refused to return it": "उन्होंने लौटाने से मना किया", "They have not responded": "उन्होंने जवाब नहीं दिया", "They are still reviewing it": "वे अभी जाँच कर रहे हैं", Today: "आज", "In the last few days": "पिछले कुछ दिनों में", "More than a week ago": "एक सप्ताह से अधिक पहले", "I’m not sure": "मुझे नहीं पता", Yes: "हाँ", "Not yet": "अभी नहीं", "I’m not sure who to contact": "किससे संपर्क करें, पता नहीं", UPI: "UPI", "Bank transfer": "बैंक ट्रांसफ़र", Card: "कार्ड", Wallet: "वॉलेट", "Something else": "कुछ और", "They said it will be paid": "उन्होंने कहा कि भुगतान होगा", "They disputed the amount": "उन्होंने राशि पर आपत्ति की", "I have not asked yet": "मैंने अभी नहीं पूछा", "They refused": "उन्होंने मना किया", "They have not replied": "उन्होंने जवाब नहीं दिया", "They offered a solution": "उन्होंने समाधान सुझाया", "I have not contacted them yet": "मैंने अभी संपर्क नहीं किया", "A complaint was recorded": "शिकायत दर्ज हुई", "They declined to record it": "उन्होंने दर्ज करने से मना किया", "I have not gone yet": "मैं अभी नहीं गया", No: "नहीं", "Loan or debt": "कर्ज़ या उधार", "Bank or card charge": "बैंक या कार्ड का शुल्क", "Insurance or benefit": "बीमा या लाभ", "Bill or payment dispute": "बिल या भुगतान विवाद", "Yes, and they replied": "हाँ, जवाब मिला", "Yes, waiting for a reply": "हाँ, जवाब का इंतज़ार है", "Not applicable": "लागू नहीं", "Separation or divorce": "अलगाव या तलाक", "Children or care arrangements": "बच्चों या देखभाल की व्यवस्था", "Family property or inheritance": "पारिवारिक संपत्ति या विरासत", "A safety concern": "सुरक्षा की चिंता", "Get money back": "पैसे वापस पाना", "Resolve the issue": "समस्या सुलझाना", "Understand my options": "अपने विकल्प समझना", "Prepare a complaint or message": "शिकायत या संदेश तैयार करना", "Yes, they responded": "हाँ, जवाब मिला", "Yes, but no response": "हाँ, लेकिन जवाब नहीं मिला", "There is no other party": "कोई दूसरा पक्ष नहीं है",
  },
  mr: {
    "They returned some of it": "त्यांनी काही रक्कम परत केली", "They refused to return it": "त्यांनी परत देण्यास नकार दिला", "They have not responded": "त्यांनी उत्तर दिलेले नाही", "They are still reviewing it": "ते अजून तपास करत आहेत", Today: "आज", "In the last few days": "गेल्या काही दिवसांत", "More than a week ago": "एका आठवड्यापूर्वी", "I’m not sure": "मला खात्री नाही", Yes: "होय", "Not yet": "अजून नाही", "I’m not sure who to contact": "कोणाशी संपर्क करावा हे माहीत नाही", UPI: "UPI", "Bank transfer": "बँक हस्तांतरण", Card: "कार्ड", Wallet: "वॉलेट", "Something else": "काहीतरी वेगळे", "They said it will be paid": "ते पैसे देतील असे त्यांनी सांगितले", "They disputed the amount": "त्यांनी रकमेवर आक्षेप घेतला", "I have not asked yet": "मी अजून विचारलेले नाही", "They refused": "त्यांनी नकार दिला", "They have not replied": "त्यांनी उत्तर दिले नाही", "They offered a solution": "त्यांनी उपाय सुचवला", "I have not contacted them yet": "मी अजून संपर्क केलेला नाही", "A complaint was recorded": "तक्रार नोंदवली", "They declined to record it": "त्यांनी नोंदवण्यास नकार दिला", "I have not gone yet": "मी अजून गेलो नाही", No: "नाही", "Loan or debt": "कर्ज", "Bank or card charge": "बँक किंवा कार्ड शुल्क", "Insurance or benefit": "विमा किंवा लाभ", "Bill or payment dispute": "बिल किंवा पेमेंटचा वाद", "Yes, and they replied": "होय, उत्तर मिळाले", "Yes, waiting for a reply": "होय, उत्तराची वाट पाहत आहे", "Not applicable": "लागू नाही", "Separation or divorce": "वेगळे होणे किंवा घटस्फोट", "Children or care arrangements": "मुले किंवा काळजीची व्यवस्था", "Family property or inheritance": "कौटुंबिक मालमत्ता किंवा वारसा", "A safety concern": "सुरक्षेची चिंता", "Get money back": "पैसे परत मिळवणे", "Resolve the issue": "समस्या सोडवणे", "Understand my options": "माझे पर्याय समजून घेणे", "Prepare a complaint or message": "तक्रार किंवा संदेश तयार करणे", "Yes, they responded": "होय, उत्तर मिळाले", "Yes, but no response": "होय, पण उत्तर मिळाले नाही", "There is no other party": "दुसरा पक्ष नाही",
  },
};

export function ReviewScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { record, ready, save } = useDemoCase();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (record) setAnswers(record.clarificationAnswers ?? {});
  }, [record]);

  const issue = record ? classifyIssue(record.story) : "general";
  const label = issueNames[language][issue] ?? issueLabel(issue);
  const questions = getFollowUps(issue, answers);
  const questionIndex = questions.findIndex(question => answers[question.id] === undefined);
  const done = questionIndex < 0;
  const current = questions[questionIndex];
  const questionText = (id: string, fallback: string) => localizedQuestions[language as Exclude<AppLanguage, "en">]?.[id] ?? fallback;
  const hintText = (id: string, fallback: string) => localizedHints[language as Exclude<AppLanguage, "en">]?.[id] ?? fallback;
  const optionText = (value: string) => localizedOptions[language as Exclude<AppLanguage, "en">]?.[value] ?? value;

  const saveAnswer = (value: string) => {
    if (!current) return;
    const nextAnswers = { ...answers, [current.id]: value || SKIPPED };
    setAnswers(nextAnswers);
    if (record) save({ ...record, clarificationAnswers: nextAnswers });
    setAnswer("");
  };

  const continueFlow = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveAnswer(answer.trim());
  };

  const confirm = async () => {
    if (!record || confirming) return;
    setConfirming(true);
    setError("");
    let next = { ...record, clarificationAnswers: answers };
    try {
      if (record.caseId && record.situationFactId && record.rev) {
        const result = await apiRequest<{ rev: number }>(`/cases/${record.caseId}/facts/confirm`, {
          expected_rev: record.rev,
          facts: [{ id: record.situationFactId, key: "situation", label: "Your description", kind: "text", value: record.story, status: "confirmed" }],
        });
        next = { ...next, rev: result.rev };
      }
      save(next);
    } catch (reason) {
      save(next);
      setError(reason instanceof Error ? reason.message : "Could not confirm online; your review is saved on this device.");
    } finally { setConfirming(false); }
    router.push("/case/");
  };

  return <main className="page-content flow-page">
    <PageHeading step={t("step2")} title={done ? t("checkShared") : t("caseDetails")} description={done ? t("reviewAnswers") : t("answersGuide")}/>
    {!ready ? <p className="loading-copy">{t("loadingDetails")}</p> : !record ? <><p className="inline-empty">{t("createBeforePlan")}</p><PrimaryLink href="/cases/new/">{t("startCase")}</PrimaryLink></> : <>
      <details className="story-context">
        <summary><span><span className="section-kicker">{t("basedStory")}</span><strong>{label}</strong></span><span className="context-toggle">{t("viewStory")}</span></summary>
        <p>“{record.story}”</p>
      </details>

      {!done && current ? <section className="followup-panel" aria-labelledby="followup-question">
        <div className="followup-progress"><span>{t("question")} {questionIndex + 1} {t("of")} {questions.length}</span><span>{label}</span></div>
        <form onSubmit={continueFlow}>
          <h2 id="followup-question">{questionText(current.id, current.question)}</h2>
          {current.hint && <p className="followup-hint">{hintText(current.id, current.hint)}</p>}
          {current.type === "choice" ? <fieldset className="outcome-options followup-options">
            <legend className="visually-hidden">{questionText(current.id, current.question)}</legend>
            {current.options?.map(option => <label className={`choice-row ${answer === option ? "is-selected" : ""}`} key={option}>
              <input type="radio" name={current.id} value={option} checked={answer === option} onChange={() => setAnswer(option)}/>
              <span className="radio-mark"/><span>{optionText(option)}</span>
            </label>)}
          </fieldset> : <textarea className="followup-input" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={240} placeholder={t("shortAnswer")}/>}
          <button className="button button-primary button-wide" type="submit">{t("continue")}</button>
        </form>
        <button className="followup-skip" type="button" onClick={() => saveAnswer(SKIPPED)}>{t("skipQuestion")}</button>
      </section> : <section className="followup-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">{t("detailsShared")}</h2>
        {Object.entries(answers).filter(([, value]) => value !== SKIPPED).length ? <dl>{Object.entries(answers).filter(([, value]) => value !== SKIPPED).map(([id, value]) => {
          const question = questions.find(item => item.id === id);
          return <div key={id}><dt>{question ? questionText(question.id, question.question) : t("yourAnswer")}</dt><dd>{question?.options?.includes(value) ? optionText(value) : value}</dd></div>;
        })}</dl> : <p className="followup-hint">{t("noDetails")}</p>}
        <button className="button button-primary button-wide" type="button" onClick={confirm} disabled={confirming}>{confirming ? "Saving…" : t("confirmDetails")}</button>
        {error && <p className="form-message" role="status">{error}</p>}
        {Object.keys(answers).length > 0 && <button className="followup-skip" type="button" onClick={() => { setAnswers({}); save({ ...record, clarificationAnswers: {} }); }}>{t("reviewAgain")}</button>}
      </section>}
      <LocalNotice>{t("previewQuestions")}</LocalNotice>
    </>}
  </main>;
}

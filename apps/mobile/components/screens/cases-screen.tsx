"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyDemoCase, readIntakeDraft, useDemoCase } from "@/components/demo-store";
import { Icon, LocalNotice, PageHeading } from "@/components/ui";
import { useLanguage, type AppLanguage } from "@/components/language";
import { currentUser } from "@/components/supabase-auth";
import { apiRequest } from "@/lib/supabase";

type RemoteCase = { id: string; title: string; status: string; rev: number };
type RemoteSnapshot = { case: { id: string; title: string; original_account: string; rev: number }; facts: Array<{ id: string; key: string; value: unknown; status: string }>; drafts: Array<{ id: string; body: string; save_token: number; is_current: boolean }>; plans: Array<{ content: { next_step: { title: string; why: string }; documents: Array<{ label: string }> } }>; checklist: Array<{ status: "have" | "dont_have" | "unsure" }> };

const labels: Record<AppLanguage, Record<string, string>> = {
  en: { description: "Track your cases, get updates and take the next step.", loading: "Loading your cases…", space: "Your space", updated: "Updated just now", progress: "In progress", illustration: "A blank page ready for your first case", emptyTitle: "Your cases will appear here", unfinished: "You have an unfinished description saved on this device.", start: "Start with a few details. You can take it one step at a time.", notice: "Your case is saved only in this browser in the current preview." },
  hi: { description: "अपने मामले देखें, अपडेट पाएँ और अगला कदम उठाएँ।", loading: "आपके मामले लोड हो रहे हैं…", space: "आपकी जगह", updated: "अभी अपडेट किया गया", progress: "जारी है", illustration: "आपके पहले मामले के लिए तैयार खाली पन्ना", emptyTitle: "आपके मामले यहाँ दिखेंगे", unfinished: "आपका अधूरा विवरण इस डिवाइस पर सहेजा गया है।", start: "कुछ जानकारी से शुरू करें। आप एक-एक कदम आगे बढ़ सकते हैं।", notice: "इस पूर्वावलोकन में आपका मामला केवल इसी ब्राउज़र में सहेजा जाता है।" },
  mr: { description: "तुमची प्रकरणे पाहा, अपडेट मिळवा आणि पुढचे पाऊल उचला.", loading: "तुमची प्रकरणे लोड होत आहेत…", space: "तुमची जागा", updated: "आत्ताच अपडेट केले", progress: "प्रगतीपथावर", illustration: "तुमच्या पहिल्या प्रकरणासाठी तयार रिकामे पान", emptyTitle: "तुमची प्रकरणे येथे दिसतील", unfinished: "तुमचा अपूर्ण तपशील या डिव्हाइसवर जतन केला आहे.", start: "काही तपशीलांपासून सुरुवात करा. तुम्ही टप्प्याटप्प्याने पुढे जाऊ शकता.", notice: "या पूर्वावलोकनात तुमचे प्रकरण फक्त या ब्राउझरमध्ये जतन केले जाते." },
};

export function CasesScreen() {
  const { record, ready, save } = useDemoCase();
  const router = useRouter();
  const [hasIntakeDraft, setHasIntakeDraft] = useState(false);
  const [remoteCases, setRemoteCases] = useState<RemoteCase[]>([]);
  const [remoteError, setRemoteError] = useState("");
  const { language, t } = useLanguage();
  const copy = labels[language];

  useEffect(() => setHasIntakeDraft(Boolean(readIntakeDraft())), []);
  useEffect(() => {
    if (!currentUser()) return;
    apiRequest<RemoteCase[]>("/cases", undefined, "GET").then(setRemoteCases).catch(reason => setRemoteError(reason instanceof Error ? reason.message : "Could not load saved cases."));
  }, []);

  const openRemote = async (id: string) => {
    try {
      const snapshot = await apiRequest<RemoteSnapshot>(`/cases/${id}`, undefined, "GET");
      const next = emptyDemoCase(snapshot.case.original_account);
      const situation = snapshot.facts.find(fact => fact.key === "situation" && fact.status === "confirmed");
      const draft = snapshot.drafts.find(item => item.is_current);
      const plan = snapshot.plans.at(-1)?.content;
      save({ ...next, title: snapshot.case.title, caseId: snapshot.case.id, rev: snapshot.case.rev, situationFactId: situation?.id, draft: draft?.body ?? "", draftId: draft?.id, draftToken: draft?.save_token, checked: snapshot.checklist.slice(0, 3).map(item => item.status === "have").concat([false, false, false]).slice(0, 3), plan: plan ? { title: plan.next_step.title, body: plan.next_step.why, items: plan.documents.slice(0, 3).map(item => item.label) } : undefined });
      router.push("/case/");
    } catch (reason) { setRemoteError(reason instanceof Error ? reason.message : "Could not open this case."); }
  };

  return <main className="page-content cases-page">
    <PageHeading title={t("home")} description={record ? copy.description : undefined}/>
    <section className="help-modes" aria-labelledby="help-modes-title">
      <h2 id="help-modes-title" className="section-title">{t("help")}</h2>
      <Link className="mode-card mode-fast" href="/fast/">
        <span className="mode-icon" aria-hidden="true">⚡</span>
        <span className="mode-copy"><strong>{t("fast")}</strong><small>{t("fastDesc")}</small></span>
        <Icon name="arrow" size={19}/>
      </Link>
      <Link className="mode-card mode-brief" href="/cases/new/">
        <span className="mode-icon" aria-hidden="true"><Icon name="document" size={21}/></span>
        <span className="mode-copy"><strong>{t("normal")}</strong><small>{t("normalDesc")}</small></span>
        <Icon name="arrow" size={19}/>
      </Link>
      <p className="mode-domains">{t("domains")}</p>
    </section>
    {!ready ? <p className="loading-copy">{copy.loading}</p> : (record || remoteCases.length) ? <>
      <section className="case-list" aria-labelledby="case-list-title">
        <h2 id="case-list-title" className="section-title">{copy.space}</h2>
        {record && <Link className="case-item" href="/case/">
          <span className="case-item-icon"><Icon name="document" size={20}/></span>
          <span className="case-item-copy"><strong>{record.title}</strong><small>{copy.updated}</small></span>
          <span className="case-status">{copy.progress}</span>
          <Icon name="chevron" size={18}/>
        </Link>}
        {remoteCases.filter(item => item.id !== record?.caseId).map(item => <button className="case-item" type="button" key={item.id} onClick={() => openRemote(item.id)}>
          <span className="case-item-icon"><Icon name="document" size={20}/></span><span className="case-item-copy"><strong>{item.title}</strong><small>{copy.updated}</small></span><span className="case-status">{item.status}</span><Icon name="chevron" size={18}/>
        </button>)}
      </section>
    </> : <section className="empty-state" aria-labelledby="empty-title">
      <svg className="empty-illustration" viewBox="0 0 180 142" role="img" aria-label={copy.illustration}>
        <circle cx="90" cy="70" r="62" fill="#e5f0ff"/>
        <path d="M60 25h43l24 24v64a7 7 0 0 1-7 7H60a7 7 0 0 1-7-7V32a7 7 0 0 1 7-7Z" fill="white" stroke="#c8dcf8" strokeWidth="2"/>
        <path d="M103 26v23h23" fill="none" stroke="#c8dcf8" strokeWidth="2"/>
        <path d="M70 66h47M70 79h38" stroke="#9bb9e4" strokeWidth="5" strokeLinecap="round"/>
        <circle cx="119" cy="100" r="19" fill="#2878e5"/>
        <path d="m111 100 5 5 11-12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <h2 id="empty-title">{copy.emptyTitle}</h2>
      <p>{hasIntakeDraft ? copy.unfinished : copy.start}</p>
    </section>}

    <LocalNotice>{currentUser() ? "Signed-in cases are available on your other devices." : copy.notice}</LocalNotice>
    {remoteError && <p className="form-message" role="status">{remoteError}</p>}
  </main>;
}

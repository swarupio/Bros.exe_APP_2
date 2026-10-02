"use client";

import { useEffect, useRef, useState } from "react";
import { BackLink, LocalNotice, PageHeading, PrimaryLink } from "@/components/ui";
import { useDemoCase } from "@/components/demo-store";
import { useLanguage } from "@/components/language";
import { apiRequest,apiWorkflowRequest } from "@/lib/supabase";

function makeDraft(story: string, language: "en" | "hi" | "mr") {
  if (language === "hi") return `नमस्ते,\n\nमैं नीचे दी गई समस्या के बारे में लिख रहा/रही हूँ:\n\n${story}\n\nमैं इस बारे में आपसे बात करना चाहता/चाहती हूँ। कृपया जवाब देने के लिए सुविधाजनक समय बताएँ।\n\nधन्यवाद,\n[आपका नाम]`;
  if (language === "mr") return `नमस्कार,\n\nखालील परिस्थितीबद्दल मी लिहित आहे:\n\n${story}\n\nयाबद्दल मला तुमच्याशी चर्चा करायची आहे. कृपया उत्तर देण्यासाठी सोयीची वेळ कळवा.\n\nधन्यवाद,\n[तुमचे नाव]`;
  return `Hello,\n\nI’m writing about the following situation:\n\n${story}\n\nI would like to discuss this with you. Please let me know a convenient time to respond.\n\nThank you,\n[Your name]`;
}

export function DraftScreen() {
  const { language, t } = useLanguage();
  const { record, ready, save,owner } = useDemoCase();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating,setGenerating]=useState(false);
  const edited=useRef(false);
  const identity=useRef<string|null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!record) {edited.current=false;identity.current=null;setDraft('');return;}
    const key=JSON.stringify([owner,record.caseId ?? record.story]);
    if (identity.current!==key) {identity.current=key;edited.current=false;}
    if (!edited.current) setDraft(record.draft || (record.caseId ? '' : makeDraft(record.story, language)));
  }, [ready,owner,record?.story,record?.caseId, record?.draftId]);

  useEffect(() => {
    if (!record?.caseId || record.draftId) return;
    let active = true;
    setGenerating(true);
    apiWorkflowRequest<{ draft: { id: string; body: string }; save_token?: number }>("/ai/draft", {
      case_id: record.caseId, purpose: "request", language, tone: "polite",
    },record.rev).then(result => {
      if (active) {
        if (edited.current) return;
        setDraft(result.draft.body);
        save({ ...record, draft: result.draft.body, draftId: result.draft.id, draftToken: result.save_token });
      }
    }).catch(reason => { if (active) setMessage(reason instanceof Error ? reason.message : "Could not prepare the online draft."); }).finally(() => {if (active) setGenerating(false);});
    return () => { active = false; };
  }, [language, record?.caseId, record?.draftId]);

  if (ready && !record) return <main className="page-content flow-page"><BackLink href="/">{t("allCases")}</BackLink><PageHeading title={t("startStory")} description={t("createBeforeDraft")}/><PrimaryLink href="/cases/new/">{t("startCase")}</PrimaryLink></main>;

  const saveDraft = async () => {
    if (!record) return;
    setSaving(true);
    setMessage("");
    try {
      if (record.draftId && record.draftToken) {
        const result = await apiRequest<{ save_token: number }>(`/drafts/${record.draftId}`, { expected_token: record.draftToken, body: draft });
        save({ ...record, draft, draftToken: result.save_token });
      } else save({ ...record, draft });
      setMessage(t("savedDraft"));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Draft saved on this device only.");
    } finally { setSaving(false); }
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setMessage(t("copiedDraft"));
    } catch {
      setMessage(t("copyUnavailable"));
    }
  };

  return <main className="page-content flow-page">
    <BackLink href="/case/">{t("yourPlan")}</BackLink>
    <PageHeading step={t("step3")} title={t("draftTitle")} description={t("draftDesc")}/>
    {!ready ? <p className="loading-copy">{t("loadingCase")}</p> : record ? <>
      <p className="draft-context"><span className="context-icon"><span>i</span></span><span>{t("draftPrivacy")}</span></p>
      <label className="visually-hidden" htmlFor="draft-text">{t("editableDraft")}</label>
      <textarea id="draft-text" className="draft-editor" value={draft} maxLength={20000} disabled={generating || Boolean(record.caseId && !record.draftId)} onChange={event => { edited.current=true;setDraft(event.target.value); setMessage(""); }} spellCheck/>
      <LocalNotice>{t("draftNotice")}</LocalNotice>
      <div className="button-row">
        <button className="button button-secondary" type="button" onClick={copyDraft}>{t("copy")}</button>
        <button className="button button-primary" type="button" onClick={saveDraft} disabled={saving || generating || Boolean(record.caseId && !record.draftId)}>{saving ? "Saving…" : t("saveDraft")}</button>
      </div>
      {message && <p className="form-message" role="status">{message}</p>}
    </> : null}
  </main>;
}

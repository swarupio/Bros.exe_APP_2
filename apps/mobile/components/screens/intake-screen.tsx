"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { emptyDemoCase, readIntakeDraft, saveIntakeDraft, useDemoCase } from "@/components/demo-store";
import { LocalNotice, PageHeading } from "@/components/ui";
import { useLanguage } from "@/components/language";
import { VoiceTypeButton } from "@/components/voice-type-button";
import { currentUser } from "@/components/supabase-auth";
import { apiRequest } from "@/lib/supabase";

export function IntakeScreen() {
  const router = useRouter();
  const { record,save } = useDemoCase();
  const { t } = useLanguage();
  const [story, setStory] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const draft = readIntakeDraft();
    if (draft) {
      setStory(draft);
      setDraftSaved(true);
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (story.trim().length < 20 || submitting) return;
    setSubmitting(true);
    setError("");
    saveIntakeDraft(story);
    const local = record?.caseId && record.story===story.trim() ? {...record} : emptyDemoCase(story.trim());
    try {
      if (currentUser()) {
        if (local.caseId) {
          const snapshot=await apiRequest<{case:{rev:number};facts:Array<{id:string;key:string}>}>(`/cases/${local.caseId}`,undefined,'GET');
          local.rev=snapshot.case.rev;
          local.situationFactId=snapshot.facts.find(f => f.key==='situation')?.id;
        } else {
        const created = await apiRequest<{ id: string; rev: number; title: string }>("/cases", { original_account: local.story, title: local.title });
        local.caseId = created.id;
        local.rev = created.rev;
        }
        if (!local.situationFactId) {
        const added = await apiRequest<{ fact: { id: string }; case_rev: number }>(`/cases/${local.caseId}/facts`, {
          expected_rev: local.rev,
          fact: { key: "situation", label: "Your description", kind: "text", value: local.story },
        });
        local.rev = added.case_rev;
        local.situationFactId = added.fact.id;
        }
        const intake = await apiRequest<{ case_rev?: number }>(`/ai/intake`, { case_id: local.caseId, request_id: crypto.randomUUID(), ui_lang: "en" });
        local.rev = intake.case_rev ?? local.rev;
      }
      save(local);
      saveIntakeDraft("");
      router.push("/case/review/");
    } catch (reason) {
      try { save(local); } catch { /* Account/storage changed; preserve the text in this form. */ }
      setError(reason instanceof Error ? `${reason.message} Your entered text is still available in this form.` : "Could not save online. Your entered text is still available in this form.");
    } finally { setSubmitting(false); }
  };

  return <main className="page-content flow-page">
    <PageHeading step={t("normalStep")} title={t("normalTitle")} description={t("normalIntro")}/>
    <form className="simple-form" onSubmit={submit}>
      <div className="intake-field">
        <label htmlFor="story">{t("storyLabel")}</label>
        <textarea id="story" value={story} disabled={submitting} onChange={event => { setStory(event.target.value); saveIntakeDraft(event.target.value); setDraftSaved(Boolean(event.target.value)); }} maxLength={3000} minLength={20} required placeholder={t("normalPlaceholder")}/>
        <div className="field-meta"><span>{draftSaved ? t("localSaved") : t("saveLocal")}</span><span>{story.length}/3000</span></div>
        <VoiceTypeButton onText={text => { setStory(current => { const next = (current ? `${current} ${text}` : text).slice(0,3000); saveIntakeDraft(next); setDraftSaved(true); return next; }); }} onBusyChange={setVoiceBusy}/>
        <p className="voice-disclosure">{t("voiceOnlyInfo")}</p>
      </div>
      <LocalNotice>{currentUser() ? "Your signed-in case is saved securely; this device keeps a recovery copy." : "Sign in to save this case across devices. This device keeps a local copy."}</LocalNotice>
      <button className="button button-primary button-wide" type="submit" disabled={story.trim().length < 20 || voiceBusy || submitting}>{submitting ? "Saving…" : t("continue")}</button>
      {error && <p className="form-message" role="status">{error}</p>}
    </form>
  </main>;
}

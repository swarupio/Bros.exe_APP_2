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
  const { save } = useDemoCase();
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
    saveIntakeDraft("");
    const local = emptyDemoCase(story.trim());
    try {
      if (currentUser()) {
        const created = await apiRequest<{ id: string; rev: number; title: string }>("/cases", { original_account: local.story, title: local.title });
        const added = await apiRequest<{ fact: { id: string }; case_rev: number }>(`/cases/${created.id}/facts`, {
          expected_rev: created.rev,
          fact: { key: "situation", label: "Your description", kind: "text", value: local.story },
        });
        const intake = await apiRequest<{ case_rev?: number }>(`/ai/intake`, { case_id: created.id, request_id: crypto.randomUUID(), ui_lang: "en" });
        local.caseId = created.id;
        local.rev = intake.case_rev ?? added.case_rev;
        local.situationFactId = added.fact.id;
      }
      save(local);
    } catch (reason) {
      save(local);
      setError(reason instanceof Error ? `${reason.message} This case is saved on this device.` : "Could not save online. This case is saved on this device.");
    } finally { setSubmitting(false); }
    router.push("/case/review/");
  };

  return <main className="page-content flow-page">
    <PageHeading step={t("normalStep")} title={t("normalTitle")} description={t("normalIntro")}/>
    <form className="simple-form" onSubmit={submit}>
      <div className="intake-field">
        <label htmlFor="story">{t("storyLabel")}</label>
        <textarea id="story" value={story} onChange={event => { setStory(event.target.value); saveIntakeDraft(event.target.value); setDraftSaved(Boolean(event.target.value)); }} maxLength={1200} minLength={20} required placeholder={t("normalPlaceholder")}/>
        <div className="field-meta"><span>{draftSaved ? t("localSaved") : t("saveLocal")}</span><span>{story.length}/1200</span></div>
        <VoiceTypeButton onText={text => { setStory(current => { const next = current ? `${current} ${text}` : text; saveIntakeDraft(next); setDraftSaved(true); return next; }); }} onBusyChange={setVoiceBusy}/>
        <p className="voice-disclosure">{t("voiceOnlyInfo")}</p>
      </div>
      <LocalNotice>{currentUser() ? "Your signed-in case is saved securely; this device keeps a recovery copy." : "Sign in to save this case across devices. This device keeps a local copy."}</LocalNotice>
      <button className="button button-primary button-wide" type="submit" disabled={story.trim().length < 20 || voiceBusy || submitting}>{submitting ? "Saving…" : t("continue")}</button>
      {error && <p className="form-message" role="status">{error}</p>}
    </form>
  </main>;
}

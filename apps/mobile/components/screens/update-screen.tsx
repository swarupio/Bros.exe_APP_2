"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDemoCase } from "@/components/demo-store";
import { useLanguage, type AppLanguage } from "@/components/language";
import { BackLink, LocalNotice, PageHeading, PrimaryLink } from "@/components/ui";
import { apiRequest } from "@/lib/supabase";

const outcomes = ["No response yet", "Received a reply", "Partly resolved", "Resolved"];
const apiOutcomes: Record<(typeof outcomes)[number], "no_response" | "reply_received" | "partially_resolved" | "resolved"> = {
  "No response yet": "no_response", "Received a reply": "reply_received", "Partly resolved": "partially_resolved", Resolved: "resolved",
};
const outcomeLabels: Record<AppLanguage, Record<(typeof outcomes)[number], string>> = {
  en: { "No response yet": "No response yet", "Received a reply": "Received a reply", "Partly resolved": "Partly resolved", Resolved: "Resolved" },
  hi: { "No response yet": "अभी तक जवाब नहीं मिला", "Received a reply": "जवाब मिला", "Partly resolved": "कुछ हद तक समाधान हुआ", Resolved: "समाधान हुआ" },
  mr: { "No response yet": "अद्याप उत्तर मिळाले नाही", "Received a reply": "उत्तर मिळाले", "Partly resolved": "काही प्रमाणात निराकरण झाले", Resolved: "निराकरण झाले" },
};

export function UpdateScreen() {
  const router = useRouter();
  const { record, ready, save } = useDemoCase();
  const { language, t } = useLanguage();
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !record) return;
    setOutcome(record.updateType);
    setNote(record.updateNote);
  }, [ready, record]);

  if (ready && !record) return <main className="page-content flow-page"><BackLink href="/">{t("home")}</BackLink><PageHeading title={t("startStory")} description={t("createBeforeUpdate")}/><PrimaryLink href="/cases/new/">{t("startCase")}</PrimaryLink></main>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || !outcome || saving) return;
    setSaving(true);
    setError("");
    let next = { ...record, updateType: outcome, updateNote: note };
    try {
      if (record.caseId) {
        const result = await apiRequest<{ case_rev?: number }>("/ai/update", { case_id: record.caseId, request_id: crypto.randomUUID(), outcome: apiOutcomes[outcome as (typeof outcomes)[number]], note, document_id: null });
        next = { ...next, rev: result.case_rev ?? record.rev, plan: undefined, planNeedsUpdate: true };
      }
      save(next);
    } catch (reason) {
      save(next);
      setError(reason instanceof Error ? reason.message : "Update saved on this device only.");
    } finally { setSaving(false); }
    router.push("/case/");
  };

  return <main className="page-content flow-page">
    <BackLink href="/case/">{t("yourPlan")}</BackLink>
    <PageHeading title={t("updateTitle")} description={t("updateDesc")}/>
    {!ready ? <p className="loading-copy">{t("loadingCase")}</p> : record ? <form className="simple-form" onSubmit={submit}>
      <fieldset className="outcome-options">
        <legend>{t("chooseAnswer")}</legend>
        {outcomes.map(item => <label className={outcome === item ? "choice-row is-selected" : "choice-row"} key={item}>
          <input type="radio" name="outcome" value={item} checked={outcome === item} onChange={() => setOutcome(item)}/>
          <span className="radio-mark"/><span>{outcomeLabels[language][item]}</span>
        </label>)}
      </fieldset>
      <label htmlFor="update-note">{t("addNote")} <span className="optional-label">{t("optional")}</span></label>
      <textarea id="update-note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder={t("notePlaceholder")}/>
      <LocalNotice>{t("updateNotice")}</LocalNotice>
      <button className="button button-primary button-wide" type="submit" disabled={!outcome || saving}>{saving ? "Saving…" : t("saveUpdate")}</button>
      {error && <p className="form-message" role="status">{error}</p>}
    </form> : null}
  </main>;
}

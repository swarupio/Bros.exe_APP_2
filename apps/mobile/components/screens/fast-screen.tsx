"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BackLink, Icon, PageHeading } from "@/components/ui";
import { useLanguage } from "@/components/language";
import { LocationButton } from "@/components/location-button";
import { VoiceTypeButton } from "@/components/voice-type-button";

type Message = { role: "user" | "assistant"; content: string };
import { API_BASE } from "@/lib/supabase";

export function FastScreen() {
  const { language, t } = useLanguage();
  const [story, setStory] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = story.trim();
    if (!content || busy) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setStory("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/fast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, messages: nextMessages.slice(-10).map(message => ({...message,content:message.content.slice(0,1200)})) }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json() as { reply?: string };
      if (!response.ok || !data.reply) throw new Error(t("responseError"));
      setMessages(current => [...current, { role: "assistant", content: data.reply! }]);
    } catch (cause) {
      setMessages(messages);
      setStory(content);
      setError(cause instanceof Error ? cause.message : t("responseError"));
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-content flow-page fast-page">
    <BackLink href="/">{t("home")}</BackLink>
    <PageHeading title={t("fastTitle")} description={t("fastIntro")}/>
    <section className="chat-thread" aria-label="Fast Track conversation" aria-live="polite">
      <article className="chat-message assistant"><p>{t("greeting")}</p></article>
      {messages.map((message, index) => <article className={`chat-message ${message.role === "user" ? "you" : "assistant"}`} key={`${index}-${message.role}`}><p>{message.content}</p></article>)}
      {busy && <article className="chat-message assistant"><p>{t("thinking")}</p></article>}
    </section>
    <form className="simple-form" onSubmit={submit}>
      <div className="intake-field">
        <label htmlFor="fast-story">{t("tell")}</label>
        <textarea id="fast-story" value={story} onChange={event => setStory(event.target.value)} maxLength={1200} disabled={busy} required placeholder={messages.length ? t("addDetail") : t("placeholder")}/>
        <div className="field-meta"><span>{t("comfort")}</span><span>{story.length}/1200</span></div>
        <VoiceTypeButton onText={text => setStory(current => (current ? `${current} ${text}` : text).slice(0,1200))} onBusyChange={setVoiceBusy} disabled={busy}/>
        <LocationButton/>
      </div>
      <button className="button button-primary button-wide" type="submit" disabled={!story.trim() || busy || voiceBusy}>{busy ? t("thinking") : messages.length ? t("send") : t("firstSteps")}<Icon name="arrow" size={18}/></button>
    </form>
    {error && <p className="fast-error" role="alert">{error}</p>}
    {messages.length > 0 && <Link className="response-link" href="/cases/new/">{t("normal")} · {t("normalDesc")}<Icon name="arrow" size={17}/></Link>}
    <aside className="fast-safety"><Icon name="shield" size={19}/><p>{t("urgent")}</p></aside>
    <p className="fast-preview-note">{t("voiceInfo")}</p>
  </main>;
}

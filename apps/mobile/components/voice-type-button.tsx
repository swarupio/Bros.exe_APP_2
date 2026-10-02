"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language";

import { API_BASE } from "@/lib/supabase";

function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read audio"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

export function VoiceTypeButton({ onText, onBusyChange, disabled = false }: { onText: (text: string) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean }) {
  const { language, t } = useLanguage();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mounted=useRef(true);
  const acquiring=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller=useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current=true;
    return () => {
      mounted.current=false;
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
      const recorder=recorderRef.current;
      if (recorder) {
        recorder.onstop=null;
        if (recorder.state!=='inactive') recorder.stop();
        recorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  },[]);

  async function toggle() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (transcribing || disabled || acquiring.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t("recordingError")); return; }
    let media: MediaStream;
    acquiring.current=true;
    onBusyChange(true);
    try { media = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { acquiring.current=false;if (mounted.current) {setError(t("recordingError"));onBusyChange(false);}return; }
    acquiring.current=false;
    if (!mounted.current) {media.getTracks().forEach(track => track.stop());return;}

    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(media); }
    catch { media.getTracks().forEach(track => track.stop()); setError(t("recordingError"));onBusyChange(false); return; }
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      if (timer.current) clearTimeout(timer.current);
      media.getTracks().forEach(track => track.stop());
      if (!mounted.current) return;
      setRecording(false);
      const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!audio.size || audio.size > 8_000_000) { setError("Recording is empty or too large. Please record a shorter message."); onBusyChange(false); return; }
      setTranscribing(true);
      controller.current=new AbortController();
      const timeout=setTimeout(() => controller.current?.abort(),45_000);
      try {
        const response = await fetch(`${API_BASE}/fast/transcribe`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_base64: await base64(audio), mime_type: audio.type.split(";")[0], language }),
          signal:controller.current.signal,
        });
        const result = await response.json() as { text?: string };
        if (!response.ok || !result.text) throw new Error(t("responseError"));
        if (!mounted.current) return;
        onText(result.text);
        setError("");
      } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : t("responseError")); }
      finally { clearTimeout(timeout);if (mounted.current) {setTranscribing(false); onBusyChange(false);} }
    };
    try { recorder.start(); }
    catch {media.getTracks().forEach(track => track.stop());setError(t("recordingError"));onBusyChange(false);return;}
    timer.current=setTimeout(() => {if (recorder.state!=='inactive') recorder.stop();},30_000);
    setRecording(true);
    onBusyChange(true);
    setError("");
  }

  return <><button className="voice-button" type="button" onClick={toggle} disabled={disabled || transcribing}>{transcribing ? t("transcribing") : recording ? t("recording") : `🎙 ${t("voice")}`}</button>{error && <span className="voice-error" role="status">{error}</span>}</>;
}

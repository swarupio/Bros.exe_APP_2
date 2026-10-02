"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/components/language";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

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

  async function toggle() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (transcribing || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t("recordingError")); return; }
    let media: MediaStream;
    try { media = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError(t("recordingError")); return; }

    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(media); }
    catch { media.getTracks().forEach(track => track.stop()); setError(t("recordingError")); return; }
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      media.getTracks().forEach(track => track.stop());
      setRecording(false);
      const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!audio.size || audio.size > 8_000_000) { setError("Recording is empty or too large. Please record a shorter message."); onBusyChange(false); return; }
      setTranscribing(true);
      try {
        const response = await fetch(`${API_BASE}/fast/transcribe`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_base64: await base64(audio), mime_type: audio.type.split(";")[0], language }),
        });
        const result = await response.json() as { text?: string };
        if (!response.ok || !result.text) throw new Error(t("responseError"));
        onText(result.text);
        setError("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : t("responseError")); }
      finally { setTranscribing(false); onBusyChange(false); }
    };
    recorder.start();
    setRecording(true);
    onBusyChange(true);
    setError("");
  }

  return <><button className="voice-button" type="button" onClick={toggle} disabled={disabled || transcribing}>{transcribing ? t("transcribing") : recording ? t("recording") : `🎙 ${t("voice")}`}</button>{error && <span className="voice-error" role="status">{error}</span>}</>;
}

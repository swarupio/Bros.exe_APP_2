"use client";

import { useEffect, useState } from "react";
import { currentUser } from "@/components/supabase-auth";

const STORAGE_KEY = "kayda-sathi-demo-case";
const INTAKE_DRAFT_KEY = "kayda-sathi-intake-draft";

export function demoStorageKeys(userId: string | null = currentUser()?.id ?? null) {
  return userId
    ? { case: `${STORAGE_KEY}:${userId}`, intakeDraft: `${INTAKE_DRAFT_KEY}:${userId}` }
    : { case: STORAGE_KEY, intakeDraft: INTAKE_DRAFT_KEY };
}

export function readIntakeDraft() {
  try {
    return window.localStorage.getItem(demoStorageKeys().intakeDraft) ?? "";
  } catch {
    return "";
  }
}

export function saveIntakeDraft(story: string) {
  const key = demoStorageKeys().intakeDraft;
  try {
    if (story) window.localStorage.setItem(key, story);
    else window.localStorage.removeItem(key);
  } catch {
    // The case can still be submitted if this browser blocks local storage.
  }
}

export type DemoCase = {
  caseId?: string;
  rev?: number;
  situationFactId?: string;
  draftId?: string;
  draftToken?: number;
  plan?: { title: string; body: string; items: string[] };
  planNeedsUpdate?: boolean;
  title: string;
  story: string;
  clarificationAnswers: Record<string, string>;
  checked: boolean[];
  draft: string;
  updateType: string;
  updateNote: string;
};

function isDemoCase(value: unknown): value is DemoCase {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoCase>;
  return typeof item.title === "string" && typeof item.story === "string"
    && Array.isArray(item.checked)
    && (item.clarificationAnswers === undefined || (typeof item.clarificationAnswers === "object" && item.clarificationAnswers !== null && !Array.isArray(item.clarificationAnswers) && Object.values(item.clarificationAnswers).every(answer => typeof answer === "string")))
    && item.checked.length === 3 && item.checked.every(state => typeof state === "boolean")
    && (item.caseId === undefined || typeof item.caseId === "string")
    && (item.rev === undefined || typeof item.rev === "number")
    && (item.situationFactId === undefined || typeof item.situationFactId === "string")
    && (item.draftId === undefined || typeof item.draftId === "string")
    && (item.draftToken === undefined || typeof item.draftToken === "number")
    && (item.planNeedsUpdate === undefined || typeof item.planNeedsUpdate === "boolean")
    && (item.plan === undefined || (typeof item.plan === "object" && item.plan !== null && typeof item.plan.title === "string" && typeof item.plan.body === "string" && Array.isArray(item.plan.items)))
    && typeof item.draft === "string" && typeof item.updateType === "string"
    && typeof item.updateNote === "string";
}

export function useDemoCase() {
  const [record, setRecord] = useState<DemoCase | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reload = () => {
      setReady(false);
      const key = demoStorageKeys().case;
      try {
        const stored = window.localStorage.getItem(key);
        if (stored) {
          const value: unknown = JSON.parse(stored);
          if (isDemoCase(value)) setRecord({ ...value, clarificationAnswers: value.clarificationAnswers ?? {} });
          else { window.localStorage.removeItem(key); setRecord(null); }
        } else setRecord(null);
      } catch {
        window.localStorage.removeItem(key);
        setRecord(null);
      }
      setReady(true);
    };
    reload();
    window.addEventListener("kayda-auth-changed", reload);
    window.addEventListener("kayda-case-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("kayda-auth-changed", reload);
      window.removeEventListener("kayda-case-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const save = (next: DemoCase) => {
    window.localStorage.setItem(demoStorageKeys().case, JSON.stringify(next));
    setRecord(next);
  };

  return { record, ready, save };
}

export function titleFromStory(story: string) {
  const firstLine = story.trim().split(/[.!?\n]/)[0]?.trim() || "A new case";
  return firstLine.length > 54 ? `${firstLine.slice(0, 51).trimEnd()}…` : firstLine;
}

export function emptyDemoCase(story: string): DemoCase {
  return {
    title: titleFromStory(story),
    story,
    clarificationAnswers: {},
    checked: [false, false, false],
    draft: "",
    updateType: "",
    updateNote: "",
  };
}

export function clearDemoCase() {
  window.localStorage.removeItem(demoStorageKeys().case);
  saveIntakeDraft("");
  window.dispatchEvent(new Event("kayda-case-changed"));
}

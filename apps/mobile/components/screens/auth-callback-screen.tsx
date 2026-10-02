"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage, type AppLanguage } from "@/components/language";
import { finishGoogleSignIn } from "@/components/supabase-auth";

const labels: Record<AppLanguage, { title: string; working: string; failed: string; retry: string }> = {
  en: { title: "Finishing sign-in", working: "Please wait while we confirm your account…", failed: "We couldn’t complete sign-in. Please return and try again.", retry: "Return to sign in" },
  hi: { title: "साइन-इन पूरा हो रहा है", working: "खाते की पुष्टि होने तक कृपया प्रतीक्षा करें…", failed: "साइन-इन पूरा नहीं हो सका। कृपया वापस जाकर फिर कोशिश करें।", retry: "साइन-इन पर वापस जाएँ" },
  mr: { title: "साइन-इन पूर्ण होत आहे", working: "खात्याची पुष्टी होईपर्यंत कृपया थांबा…", failed: "साइन-इन पूर्ण होऊ शकले नाही. कृपया परत जाऊन पुन्हा प्रयत्न करा.", retry: "साइन-इनवर परत जा" },
};

export function AuthCallbackScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = labels[language];
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code || params.has("error")) {
      setFailed(true);
      return;
    }
    void finishGoogleSignIn(code)
      .then(() => { router.replace("/"); router.refresh(); })
      .catch(() => setFailed(true));
  }, [router]);

  return <main className="page-content auth-callback" aria-live="polite">
    <h1>{copy.title}</h1>
    <p>{failed ? copy.failed : copy.working}</p>
    {failed && <Link className="button button-primary button-wide" href="/login/">{copy.retry}</Link>}
  </main>;
}

"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language";

const copy = {
  en: { ask: "Use my location", ready: "Location is enabled for regional guidance. It is not saved or sent in this release.", error: "Location is unavailable. You can enter your city or district instead." },
  hi: { ask: "मेरी जगह इस्तेमाल करें", ready: "क्षेत्रीय मार्गदर्शन के लिए स्थान चालू है। इस संस्करण में इसे सहेजा या भेजा नहीं जाता।", error: "स्थान उपलब्ध नहीं है। आप शहर या ज़िला लिख सकते हैं।" },
  mr: { ask: "माझे स्थान वापरा", ready: "प्रादेशिक मार्गदर्शनासाठी स्थान सुरू आहे. या आवृत्तीत ते जतन किंवा पाठवले जात नाही.", error: "स्थान उपलब्ध नाही. तुम्ही शहर किंवा जिल्हा लिहू शकता." },
} as const;

export function LocationButton() {
  const { language } = useLanguage();
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const text = copy[language];

  function requestLocation() {
    if (!navigator.geolocation) { setStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      () => setStatus("ready"),
      () => setStatus("error"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  return <><button className="location-button" type="button" onClick={requestLocation}>⌖ {text.ask}</button>{status !== "idle" && <span className="voice-disclosure" role="status">{status === "ready" ? text.ready : text.error}</span>}</>;
}

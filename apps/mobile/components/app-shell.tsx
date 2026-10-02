"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { languageNames, useLanguage, type AppLanguage } from "@/components/language";

const shellCopy: Record<AppLanguage, Record<string, string>> = {
  en: { language: "App language", preview: "Local preview", signIn: "Sign in", help: "Help", urgent: "Need urgent help?", cases: "Cases", settings: "Settings", nav: "Main navigation", urgentSupport: "URGENT SUPPORT", danger: "Are you in immediate danger?", previewNotice: "This preview does not have verified contact details yet. If it is safe, use a trusted local emergency service or legal-aid source.", source: "Contact information is hidden until the team verifies its official source.", close: "Close help", back: "Back to my case" },
  hi: { language: "ऐप की भाषा", preview: "स्थानीय पूर्वावलोकन", signIn: "साइन इन", help: "मदद", urgent: "तत्काल मदद चाहिए?", cases: "मामले", settings: "सेटिंग", nav: "मुख्य नेविगेशन", urgentSupport: "तत्काल सहायता", danger: "क्या आप अभी तत्काल खतरे में हैं?", previewNotice: "इस पूर्वावलोकन में सत्यापित संपर्क विवरण नहीं हैं। सुरक्षित हो तो किसी भरोसेमंद स्थानीय आपातकालीन सेवा या कानूनी सहायता स्रोत से संपर्क करें।", source: "आधिकारिक स्रोत की पुष्टि होने तक संपर्क जानकारी छिपी रहेगी।", close: "मदद बंद करें", back: "मामले पर वापस जाएँ" },
  mr: { language: "अॅपची भाषा", preview: "स्थानिक पूर्वावलोकन", signIn: "साइन इन", help: "मदत", urgent: "तातडीची मदत हवी?", cases: "प्रकरणे", settings: "सेटिंग्ज", nav: "मुख्य नेव्हिगेशन", urgentSupport: "तातडीची मदत", danger: "तुम्ही सध्या तातडीच्या धोक्यात आहात का?", previewNotice: "या पूर्वावलोकनात पडताळलेले संपर्क तपशील नाहीत. सुरक्षित असल्यास विश्वासू स्थानिक आपत्कालीन सेवा किंवा कायदेशीर मदत स्रोताशी संपर्क करा.", source: "अधिकृत स्रोताची पडताळणी होईपर्यंत संपर्क माहिती लपवलेली राहील.", close: "मदत बंद करा", back: "प्रकरणाकडे परत जा" },
};

export function AppShell({ children, active = "cases", hideNavigation = false, authHeader = false }: { children: ReactNode; active?: "cases" | "settings"; hideNavigation?: boolean; authHeader?: boolean }) {
  const [safetyOpen, setSafetyOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const copy = shellCopy[language];

  useEffect(() => {
    if (!safetyOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setSafetyOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [safetyOpen]);

  return <div className={`app-shell ${authHeader ? "auth-shell" : ""}`}>
    <header className={`app-header ${authHeader ? "auth-header" : ""}`}>
      {authHeader ? <span/> : <Link className="brand" href="/" aria-label="Kayda Sathi home">
        <span className="brand-mark"><img src="/kayda-sathi-icon.png" alt=""/></span>
        <span>kayda <span className="brand-light">sathi</span></span>
      </Link>}
      <div className="header-actions">
        <label className="language-picker"><Icon name="globe" size={18}/><span className="visually-hidden">{copy.language}</span><select aria-label={copy.language} value={language} onChange={event => setLanguage(event.target.value as AppLanguage)}>{Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><Icon name="chevronDown" size={14}/></label>
        {!authHeader && <><span className="preview-label">{copy.preview}</span>{!hideNavigation && <Link className="account-link" href="/login/">{copy.signIn}</Link>}</>}
        <button className={authHeader ? "auth-help-button" : "help-button glass-control"} type="button" aria-label={authHeader ? copy.help : copy.urgent} onClick={() => setSafetyOpen(true)}>
          <Icon name={authHeader ? "help" : "shield"} size={authHeader ? 27 : 17}/><span>{authHeader ? copy.help : copy.urgent}</span>
        </button>
      </div>
    </header>

    {children}

    {authHeader && <button className="auth-urgent-button" type="button" onClick={() => setSafetyOpen(true)}><Icon name="phone" size={23}/><span>{copy.urgent}</span><Icon name="chevron" size={21}/></button>}

    {!hideNavigation && <nav className="bottom-nav glass-control" aria-label={copy.nav}>
      <Link href="/" className={active === "cases" ? "nav-link is-active" : "nav-link"} aria-current={active === "cases" ? "page" : undefined}>
        <Icon name="folder" size={19}/><span>{copy.cases}</span>
      </Link>
      <Link href="/settings/" className={active === "settings" ? "nav-link is-active" : "nav-link"} aria-current={active === "settings" ? "page" : undefined}>
        <Icon name="settings" size={19}/><span>{copy.settings}</span>
      </Link>
    </nav>}

    {safetyOpen && <div className="sheet-backdrop" role="presentation" onClick={() => setSafetyOpen(false)}>
      <section className="safety-sheet" role="dialog" aria-modal="true" aria-labelledby="safety-title" onClick={event => event.stopPropagation()}>
        <div className="sheet-handle"/>
        <button className="sheet-close glass-control" type="button" aria-label={copy.close} onClick={() => setSafetyOpen(false)}><Icon name="close" size={18}/></button>
        <span className="safety-icon"><Icon name="shield" size={25}/></span>
        <p className="step-label">{copy.urgentSupport}</p>
        <h2 id="safety-title">{copy.danger}</h2>
        <p className="sheet-copy">{copy.previewNotice}</p>
        <p className="sheet-source">{copy.source}</p>
        <button className="button button-secondary button-wide" type="button" onClick={() => setSafetyOpen(false)}>{copy.back}</button>
      </section>
    </div>}
  </div>;
}

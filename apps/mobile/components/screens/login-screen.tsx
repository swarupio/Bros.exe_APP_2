"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui";
import { useLanguage, type AppLanguage } from "@/components/language";
import { signInWithPassword, signUpWithPassword, startGoogleSignIn } from "@/components/supabase-auth";

type LegalView = "terms" | "privacy" | null;
const labels: Record<AppLanguage, Record<string, string>> = {
  en: { tagline: "Simple steps for life’s legal questions", titleStart: "Your next step,", titleEnd: "with clarity.", signUp: "Create your Kayda Sathi account.", signIn: "Sign in to your Kayda Sathi account.", email: "Email address", password: "Password", continue: "Continue", or: "or", google: "Login with Google", termsIntro: "By continuing, you agree to our", terms: "Terms", and: "and", privacy: "Privacy Policy", already: "Already have an account? Sign in", new: "New to Kayda Sathi? Create an account", guest: "Explore as a guest", close: "Close", done: "Done", waitEmail: "Check your inbox to finish creating your account.", signInError: "Could not sign in. Check your details and try again.", googleError: "Google sign-in could not start. Please try again later.", termsBody: "This app helps organize information about a legal problem. It is not legal advice.", privacyBody: "Your account is handled by Supabase. Case data is saved to your account when sync is connected; this app never stores your password." },
  hi: { tagline: "कानूनी सवालों के लिए आसान कदम", titleStart: "अगला कदम,", titleEnd: "अब साफ़ है।", signUp: "अपना Kayda Sathi खाता बनाएँ।", signIn: "अपने Kayda Sathi खाते में साइन इन करें।", email: "ईमेल पता", password: "पासवर्ड", continue: "आगे बढ़ें", or: "या", google: "Google से लॉगिन करें", termsIntro: "आगे बढ़कर, आप सहमत हैं:", terms: "नियमों", and: "और", privacy: "गोपनीयता नीति", already: "पहले से खाता है? साइन इन करें", new: "Kayda Sathi पर नए हैं? खाता बनाएँ", guest: "अतिथि के रूप में देखें", close: "बंद करें", done: "हो गया", waitEmail: "खाता बनाने के लिए अपना ईमेल देखें।", signInError: "साइन इन नहीं हो सका। जानकारी जाँचकर फिर कोशिश करें।", googleError: "Google साइन-इन शुरू नहीं हुआ। थोड़ी देर बाद फिर कोशिश करें।", termsBody: "यह ऐप कानूनी समस्या की जानकारी व्यवस्थित करने में मदद करता है। यह कानूनी सलाह नहीं है।", privacyBody: "आपका खाता Supabase संभालता है। सिंक जुड़ने पर मामले का डेटा खाते में सहेजा जाएगा; ऐप आपका पासवर्ड नहीं रखता।" },
  mr: { tagline: "कायदेशीर प्रश्नांसाठी सोपी पावले", titleStart: "तुमचे पुढचे पाऊल,", titleEnd: "आता स्पष्ट.", signUp: "तुमचे Kayda Sathi खाते तयार करा.", signIn: "तुमच्या Kayda Sathi खात्यात साइन इन करा.", email: "ईमेल पत्ता", password: "पासवर्ड", continue: "पुढे चला", or: "किंवा", google: "Google ने लॉगिन करा", termsIntro: "पुढे गेल्यास, तुम्ही सहमत होता:", terms: "अटींशी", and: "आणि", privacy: "गोपनीयता धोरणाशी", already: "आधीच खाते आहे? साइन इन करा", new: "Kayda Sathi वर नवीन आहात? खाते तयार करा", guest: "पाहुणे म्हणून पाहा", close: "बंद करा", done: "पूर्ण", waitEmail: "खाते तयार करण्यासाठी ईमेल तपासा.", signInError: "साइन इन करता आले नाही. माहिती तपासून पुन्हा प्रयत्न करा.", googleError: "Google साइन-इन सुरू झाले नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.", termsBody: "हे अॅप कायदेशीर समस्येची माहिती व्यवस्थित ठेवण्यास मदत करते. हा कायदेशीर सल्ला नाही.", privacyBody: "तुमचे खाते Supabase हाताळते. सिंक जोडल्यानंतर प्रकरणाचा डेटा खात्यात जतन होईल; अॅप तुमचा पासवर्ड साठवत नाही." },
};

export function LoginScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = labels[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [legalView, setLegalView] = useState<LegalView>(null);

  const continueWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const session = isSignUp ? await signUpWithPassword(email, password) : await signInWithPassword(email, password);
      if (session) router.push("/");
      else setMessage(copy.waitEmail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.signInError);
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try { await startGoogleSignIn(); }
    catch { setMessage(copy.googleError); setBusy(false); }
  };

  return <main className="page-content login-page">
    <div className="login-brand">
      <span className="login-brand-mark"><img src="/kayda-sathi-icon.png" alt=""/></span>
      <span className="login-brand-copy"><strong>Kayda Sathi</strong><small>{copy.tagline}</small></span>
    </div>

    <div className="auth-landscape"><img src="/images/sign-in-landscape.png" alt=""/></div>

    <section className="login-copy" aria-labelledby="login-title">
      <h1 id="login-title">{copy.titleStart}<br/>{copy.titleEnd}</h1>
      <p>{isSignUp ? copy.signUp : copy.signIn}</p>
    </section>

    <form className="phone-auth-form" onSubmit={continueWithPassword}>
      <label className="auth-input-label" htmlFor="auth-email">{copy.email}</label>
      <input className="auth-text-input" id="auth-email" type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setMessage(""); }} required/>
      <label className="auth-input-label" htmlFor="auth-password">{copy.password}</label>
      <input className="auth-text-input" id="auth-password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={6} value={password} onChange={event => { setPassword(event.target.value); setMessage(""); }} required/>
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="button button-primary button-wide phone-continue" type="submit" disabled={busy}>{busy ? "…" : copy.continue}<Icon name="arrow" size={23}/></button>
    </form>

    <div className="auth-divider"><span>{copy.or}</span></div>
    <button className="button button-secondary button-wide google-button" type="button" disabled={busy} onClick={continueWithGoogle}><span className="google-mark" aria-hidden="true">G</span>{copy.google}</button>

    <p className="auth-terms">{copy.termsIntro}<br/><button type="button" onClick={() => setLegalView("terms")}>{copy.terms}</button> {copy.and} <button type="button" onClick={() => setLegalView("privacy")}>{copy.privacy}</button>.</p>
    <button className="account-switch" type="button" disabled={busy} onClick={() => { setIsSignUp(value => !value); setMessage(""); }}>{isSignUp ? copy.already : copy.new}</button>
    <Link className="guest-link" href="/">{copy.guest}</Link>

    {legalView && <div className="legal-backdrop" role="presentation" onClick={() => setLegalView(null)}>
      <section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={event => event.stopPropagation()}>
        <button type="button" className="legal-close" aria-label={copy.close} onClick={() => setLegalView(null)}><Icon name="close" size={19}/></button>
        <h2 id="legal-title">{legalView === "terms" ? copy.terms : copy.privacy}</h2>
        <p>{legalView === "terms" ? copy.termsBody : copy.privacyBody}</p>
        <button className="button button-primary button-wide" type="button" onClick={() => setLegalView(null)}>{copy.done}</button>
      </section>
    </div>}
  </main>;
}

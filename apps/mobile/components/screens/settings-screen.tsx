"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearDemoCase, readIntakeDraft, useDemoCase } from "@/components/demo-store";
import { Icon, LocalNotice, PageHeading } from "@/components/ui";
import { useLanguage, type AppLanguage } from "@/components/language";
import { currentUser, signOut } from "@/components/supabase-auth";

const labels: Record<AppLanguage, Record<string, string>> = {
  en: { title: "Settings & privacy", description: "Control this local preview and understand where your case is saved.", account: "Account", signIn: "Sign in or create an account", accountSync: "Account sync isn’t connected in this preview yet.", signedIn: "Signed in", signOut: "Sign out", signingOut: "Signing out…", signedOut: "You’re signed out. This account’s saved case data remains on this device.", signOutWarning: "This device’s session was cleared, but the account service did not confirm sign-out. Saved case data remains on this device.", data: "Your data", savedBrowser: "Saved in this browser", checking: "Checking this device…", savedDraftAndCase: "A demo case and unfinished description are saved on this device.", savedCase: "One demo case is saved on this device.", savedDraft: "An unfinished description is saved on this device.", noData: "No case information is saved yet.", localCase: "Case data stays on this device", groq: "Fast Track sends chat messages and voice recordings to Groq when the server is configured.", privacyNotice: "Use a private device if other people can access this browser profile.", clear: "Clear saved case data", confirm: "Clear the saved case and unfinished description from this browser?" },
  hi: { title: "सेटिंग और गोपनीयता", description: "इस पूर्वावलोकन को नियंत्रित करें और जानें कि आपका मामला कहाँ सहेजा जाता है।", account: "खाता", signIn: "साइन इन करें या खाता बनाएँ", accountSync: "इस पूर्वावलोकन में खाता सिंक अभी जुड़ा नहीं है।", signedIn: "साइन इन है", signOut: "साइन आउट करें", signingOut: "साइन आउट हो रहा है…", signedOut: "आप साइन आउट हो गए हैं। इस खाते का सहेजा गया मामला डेटा इस डिवाइस पर रहेगा।", signOutWarning: "इस डिवाइस का सत्र मिटा दिया गया है, लेकिन खाता सेवा ने साइन आउट की पुष्टि नहीं की। सहेजा गया मामला डेटा इस डिवाइस पर रहेगा।", data: "आपका डेटा", savedBrowser: "इस ब्राउज़र में सहेजा गया", checking: "इस डिवाइस की जाँच हो रही है…", savedDraftAndCase: "एक डेमो मामला और अधूरा विवरण इस डिवाइस पर सहेजा गया है।", savedCase: "एक डेमो मामला इस डिवाइस पर सहेजा गया है।", savedDraft: "एक अधूरा विवरण इस डिवाइस पर सहेजा गया है।", noData: "अभी मामले की कोई जानकारी सहेजी नहीं गई है।", localCase: "मामले का डेटा इसी डिवाइस पर रहता है", groq: "सर्वर कॉन्फ़िगर होने पर Fast Track चैट संदेश और आवाज़ की रिकॉर्डिंग Groq को भेजता है।", privacyNotice: "अगर दूसरे लोग इस ब्राउज़र प्रोफ़ाइल का उपयोग कर सकते हैं, तो निजी डिवाइस इस्तेमाल करें।", clear: "सहेजा गया मामला डेटा मिटाएँ", confirm: "इस ब्राउज़र से सहेजा गया मामला और अधूरा विवरण मिटाएँ?" },
  mr: { title: "सेटिंग्ज आणि गोपनीयता", description: "या स्थानिक पूर्वावलोकनावर नियंत्रण ठेवा आणि तुमचे प्रकरण कुठे जतन होते ते जाणून घ्या.", account: "खाते", signIn: "साइन इन करा किंवा खाते तयार करा", accountSync: "या पूर्वावलोकनात खाते सिंक अजून जोडलेले नाही.", signedIn: "साइन इन केले आहे", signOut: "साइन आउट करा", signingOut: "साइन आउट होत आहे…", signedOut: "तुम्ही साइन आउट केले आहे. या खात्याचा जतन केलेला प्रकरणाचा डेटा या डिव्हाइसवर राहील.", signOutWarning: "या डिव्हाइसवरील सत्र पुसले आहे, पण खाते सेवेकडून साइन आउटची पुष्टी मिळाली नाही. जतन केलेला प्रकरणाचा डेटा या डिव्हाइसवर राहील.", data: "तुमचा डेटा", savedBrowser: "या ब्राउझरमध्ये जतन केले", checking: "या डिव्हाइसची तपासणी सुरू आहे…", savedDraftAndCase: "डेमो प्रकरण आणि अपूर्ण तपशील या डिव्हाइसवर जतन केले आहेत.", savedCase: "एक डेमो प्रकरण या डिव्हाइसवर जतन केले आहे.", savedDraft: "अपूर्ण तपशील या डिव्हाइसवर जतन केला आहे.", noData: "अद्याप प्रकरणाची माहिती जतन केलेली नाही.", localCase: "प्रकरणाचा डेटा याच डिव्हाइसवर राहतो", groq: "सर्व्हर कॉन्फिगर असल्यास फास्ट ट्रॅक चॅट संदेश आणि आवाजाची रेकॉर्डिंग Groq कडे पाठवतो.", privacyNotice: "इतर लोकांना या ब्राउझर प्रोफाइलचा वापर करता येत असल्यास खाजगी डिव्हाइस वापरा.", clear: "जतन केलेला प्रकरणाचा डेटा पुसा", confirm: "या ब्राउझरमधून जतन केलेले प्रकरण आणि अपूर्ण तपशील पुसायचे?" },
};

export function SettingsScreen() {
  const router = useRouter();
  const { record, ready } = useDemoCase();
  const [hasIntakeDraft, setHasIntakeDraft] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const { language } = useLanguage();
  const copy = labels[language];

  useEffect(() => {
    const refreshLocal = () => {
      setUser(currentUser());
      setHasIntakeDraft(Boolean(readIntakeDraft()));
    };
    refreshLocal();
    window.addEventListener("kayda-auth-changed", refreshLocal);
    window.addEventListener("storage", refreshLocal);
    return () => {
      window.removeEventListener("kayda-auth-changed", refreshLocal);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);
  const handleSignOut = async () => {
    setSignOutBusy(true);
    setAccountMessage("");
    let confirmed = true;
    try { await signOut(); }
    catch { confirmed = false; }
    finally {
      setUser(currentUser());
      setAccountMessage(confirmed ? copy.signedOut : copy.signOutWarning);
      setSignOutBusy(false);
    }
  };
  const clear = () => {
    if (!window.confirm(copy.confirm)) return;
    clearDemoCase();
    router.push("/");
    router.refresh();
  };

  return <main className="page-content settings-page">
    <PageHeading title={copy.title} description={copy.description}/>
    <section className="settings-section">
      <h2 className="section-title">{copy.account}</h2>
      {user ? <>
        <div className="settings-row settings-account"><span className="settings-icon"><Icon name="document" size={19}/></span><span><strong>{copy.signedIn}</strong><small>{user.email ?? user.id}</small></span></div>
        <button className="button button-secondary button-wide" type="button" onClick={handleSignOut} disabled={signOutBusy}>{signOutBusy ? copy.signingOut : copy.signOut}</button>
        {accountMessage && <p className="form-message" role="status">{accountMessage}</p>}
      </> : <Link className="settings-row settings-account" href="/login/"><span className="settings-icon"><Icon name="document" size={19}/></span><span><strong>{copy.signIn}</strong><small>{copy.accountSync}</small></span><Icon name="chevron" size={18}/></Link>}
    </section>
    <section className="settings-section">
      <h2 className="section-title">{copy.data}</h2>
      <div className="settings-row"><span className="settings-icon"><Icon name="shield" size={19}/></span><span><strong>{copy.savedBrowser}</strong><small>{!ready ? copy.checking : record ? hasIntakeDraft ? copy.savedDraftAndCase : copy.savedCase : hasIntakeDraft ? copy.savedDraft : copy.noData}</small></span></div>
      <div className="settings-row"><span className="settings-icon"><Icon name="document" size={19}/></span><span><strong>{copy.localCase}</strong><small>{copy.groq}</small></span></div>
    </section>
    <LocalNotice>{copy.privacyNotice}</LocalNotice>
    {(record || hasIntakeDraft) && <button className="button button-danger button-wide" type="button" onClick={clear}>{copy.clear}</button>}
  </main>;
}

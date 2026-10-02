"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Screen = "cases" | "new" | "review" | "workspace";
type LocalCase = { title: string; account: string; created: string; checked: boolean[] };
const STORAGE_KEY = "kayda-sathi-demo-case";
const sample: LocalCase = {
  title: "Rental deposit not returned",
  account: "My landlord returned only part of my deposit after I moved out.",
  created: "Just now",
  checked: [false, false, false],
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    mark: <><path d="M5 17.5 16.5 6"/><path d="M7 6h9.5V15.5"/><path d="M4.5 20h15"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    folder: <><path d="M3 6.5h6l2 2h10v9.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3Z"/><path d="M3 9h18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Header({ onSafety }: { onSafety: () => void }) {
  return <header className="topbar"><Link className="brand" href="/"><span className="brand-mark"><Icon name="mark" size={22}/></span><span>kayda<span className="brand-light"> sathi</span></span></Link><div className="top-actions"><span className="demo-pill"><i/>Local demo</span><button className="safety-button" onClick={onSafety}><Icon name="shield" size={17}/><span>Need urgent help?</span></button></div></header>;
}

export function AppView({ screen }: { screen: Screen }) {
  const [record, setRecord] = useState<LocalCase>(sample);
  const [description, setDescription] = useState("");
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setRecord(JSON.parse(stored) as LocalCase); } catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    setLoaded(true);
  }, []);

  const updateRecord = (next: LocalCase) => {
    setRecord(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const submitDescription = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (description.trim().length < 20) return;
    const title = description.trim().split(/[.!?]/)[0].slice(0, 48) || sample.title;
    updateRecord({ ...sample, title, account: description.trim(), created: "A moment ago" });
    window.location.href = "/case/review/";
  };

  const title = screen === "new" ? "Start with what happened" : screen === "review" ? "Let’s make sure we got it right" : screen === "workspace" ? record.title : "A clearer next step starts here.";

  return <main className="app-shell">
    <Header onSafety={() => setSafetyOpen(true)}/>
    {screen === "cases" && <>
      <section className="welcome-wrap">
        <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line"/>A little clarity goes a long way</div><h1>{title}</h1><p>Understand what may apply, prepare what you need, and find the next step that feels right for you.</p><Link className="button primary" href="/cases/new/"><Icon name="plus" size={18}/>Start a new case<Icon name="arrow" size={17}/></Link></div>
        <div className="hero-art" aria-hidden="true"><div className="sun-disc"/><div className="arc arc-one"/><div className="arc arc-two"/><div className="art-card"><span className="art-icon"><Icon name="spark" size={17}/></span><span><b>One step at a time</b><small>Your story, your pace</small></span><span className="art-check"><Icon name="check" size={14}/></span></div><div className="art-caption">A more human way forward</div></div>
      </section>
      <section className="case-section">
        <div className="section-head"><div><div className="eyebrow muted">YOUR SPACE</div><h2>Your cases</h2></div><span className="count-pill">{loaded && window.localStorage.getItem(STORAGE_KEY) ? "1 active" : "A fresh start"}</span></div>
        {loaded && window.localStorage.getItem(STORAGE_KEY) ? <Link href="/case/" className="case-card"><span className="case-icon"><Icon name="folder"/></span><span className="case-main"><strong>{record.title}</strong><small>Updated {record.created} <span className="dot-sep">·</span> 1 plan</small></span><span className="status-label"><i/>In progress</span><Icon name="arrow" size={18}/></Link> : <div className="empty-card"><span className="empty-icon"><Icon name="folder" size={22}/></span><strong>Your space is ready when you are</strong><p>Your cases will live here, so it’s easy to come back whenever you need.</p><Link href="/cases/new/">Create your first case <Icon name="arrow" size={15}/></Link></div>}
      </section>
      <footer className="welcome-note"><Icon name="shield" size={18}/><span><strong>Local demo only.</strong> Case details stay in this browser’s storage. Anyone using this browser profile may be able to view them; no account or backend sync is connected.</span></footer>
    </>}
    {screen === "new" && <section className="flow-page"><Link href="/" className="back-link">← <span>My cases</span></Link><div className="flow-layout"><div className="flow-main"><div className="eyebrow"><span className="eyebrow-line"/>STEP 1 OF 3</div><h1>{title}</h1><p className="lead">You don’t need to know the legal words. Just tell us in your own way.</p><form onSubmit={submitDescription} className="intake-form"><label htmlFor="story">What’s going on?</label><textarea id="story" value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} placeholder="For example: I moved out last month, but my landlord has only returned part of my deposit…" required minLength={20}/><div className="field-meta"><span>Your details help us understand the situation.</span><span>{description.length} / 3000</span></div><div className="form-rule"/><div className="form-actions"><span className="private-note"><Icon name="shield" size={16}/>Saved in this browser</span><button type="submit" className="button primary" disabled={description.trim().length < 20}>Continue<Icon name="arrow" size={17}/></button></div></form><div className="input-help"><span className="help-icon">i</span><span>Share only what you’re comfortable sharing. You can review everything before it becomes part of your case.</span></div></div><aside className="flow-aside"><div className="aside-art"><span className="aside-spark"><Icon name="spark"/></span><div className="aside-line"/></div><p><strong>Take it one step at a time.</strong><br/>There’s no perfect way to explain it. Start wherever feels easiest.</p><div className="aside-meta"><span/>A supportive space, at your pace</div></aside></div></section>}
    {screen === "review" && <section className="flow-page"><Link href="/cases/new/" className="back-link">← <span>Edit your description</span></Link><div className="review-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>STEP 2 OF 3 · REVIEW</div><h1>{title}</h1><p className="lead">These are the details we picked up. Please check that they feel right.</p></div><span className="review-status"><Icon name="check" size={15}/>Ready to review</span></div><div className="review-grid"><article className="review-card"><div className="card-top"><div><span className="card-kicker">YOUR DESCRIPTION</span><h2>What we understood</h2></div><span className="origin-tag">You said</span></div><p className="quote">“{loaded ? record.account : sample.account}”</p><div className="divider"/><div className="fact-row"><span className="fact-icon">₹</span><span><strong>Deposit amount</strong><small>Needs your confirmation</small></span><span className="fact-value">Not yet known</span></div><div className="fact-row"><span className="fact-icon">₹</span><span><strong>Amount returned</strong><small>Needs your confirmation</small></span><span className="fact-value">Part of deposit</span></div><div className="fact-row"><span className="fact-icon missing">?</span><span><strong>City or state</strong><small>Helps us find relevant support</small></span><span className="fact-value unknown">Not provided</span></div><div className="review-callout"><span>✳</span><span><strong>Nothing is assumed.</strong> You’ll confirm any important details before we make a plan.</span></div></article><aside className="review-aside"><div className="aside-icon"><Icon name="spark" size={19}/></div><h3>Review before continuing</h3><p>Confirm or correct these details before using the demo plan. Nothing is sent to an API.</p><button onClick={() => { setSaved(true); window.location.href = "/case/"; }} className="button primary full">Looks right<Icon name="arrow" size={17}/></button><p className="small-disclaimer">You can always come back and make changes.</p></aside></div></section>}
    {screen === "workspace" && <section className="flow-page"><Link href="/" className="back-link">← <span>All cases</span></Link><div className="workspace-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>YOUR CASE · PLAN 1</div><h1>{loaded ? record.title : sample.title}</h1><p className="lead">A practical starting point based on what you’ve shared.</p></div><span className="general-pill"><span/>General guidance</span></div><div className="plan-layout"><div className="plan-main"><article className="next-step-card"><div className="next-step-top"><span className="step-number">01</span><span className="source-badge">A good place to start</span></div><h2>Gather a clear record of the deposit and what was returned.</h2><p>Collect any payment proof, messages about the deposit, and a simple timeline of when you moved in and out.</p><div className="plan-source"><Icon name="shield" size={16}/><span>Preparation guidance <i>·</i> Not legal advice</span></div></article><div className="section-head compact"><div><div className="eyebrow muted">YOUR PREPARATION</div><h2>Documents to gather</h2></div><span className="count-pill">{record.checked.filter(Boolean).length} of 3 ready</span></div><div className="checklist">{["Proof of deposit payment", "Messages about the deposit", "Move-in and move-out dates"].map((item, index) => <label className={`check-row ${record.checked[index] ? "checked" : ""}`} key={item}><input type="checkbox" checked={record.checked[index]} onChange={event => { const next = [...record.checked]; next[index] = event.target.checked; updateRecord({ ...record, checked: next }); }}/><span className="checkbox-ui"><Icon name="check" size={14}/></span><span>{item}</span><span className="check-state">{record.checked[index] ? "Ready" : "To gather"}</span></label>)}</div><div className="general-note"><span className="info-mark">i</span><p><strong>We haven’t verified specific legal rules for this situation yet.</strong><br/>This general plan focuses on organizing your information and finding the right person to ask.</p></div></div><aside className="plan-aside"><div className="aside-section"><span className="card-kicker">WHEN YOU’RE READY</span><h3>Prepare a draft</h3><p>Put your request into clear words. We’ll use only details you confirm.</p><button className="button secondary full" onClick={() => setSaved(true)}><Icon name="plus" size={17}/>Prepare a draft<Icon name="arrow" size={16}/></button>{saved && <small className="inline-success">Draft preparation is coming next.</small>}</div><div className="aside-section help-box"><span className="card-kicker">SOURCE REVIEW PENDING</span><h3>Contact details hidden</h3><p>Emergency and legal-aid contact information will appear after the team verifies its sources.</p></div><div className="aside-section"><span className="card-kicker">YOUR STORY</span><p className="story-preview">“{loaded ? record.account : sample.account}”</p><Link href="/case/review/" className="text-link">Review details <Icon name="arrow" size={14}/></Link></div></aside></div></section>}
    <nav className="bottom-nav" aria-label="Main navigation"><Link href="/" className={screen === "cases" ? "active" : ""}><Icon name="folder" size={18}/><span>My cases</span></Link><button onClick={() => setSafetyOpen(true)}><Icon name="shield" size={18}/><span>Get help</span></button></nav>
    {safetyOpen && <div className="modal-backdrop" role="presentation" onClick={() => setSafetyOpen(false)}><section className="safety-sheet" role="dialog" aria-modal="true" aria-labelledby="safety-title" onClick={event => event.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" aria-label="Close" onClick={() => setSafetyOpen(false)}><Icon name="close"/></button><span className="safety-emblem"><Icon name="shield" size={24}/></span><div className="eyebrow muted">SOURCE REVIEW PENDING</div><h2 id="safety-title">Contact details aren’t verified yet.</h2><p>Emergency and legal-aid contact information is hidden in this demo until the team completes its source review. No tap-to-call numbers are available here.</p><p className="sheet-foot">If you need help now, use a trusted local emergency or legal-aid source.</p></section></div>}
    {copied && <div className="toast" role="status">Copied to clipboard</div>}
  </main>;
}

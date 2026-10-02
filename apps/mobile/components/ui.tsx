import type { ReactNode } from "react";
import Link from "next/link";

export type IconName = "brand" | "plus" | "arrow" | "back" | "shield" | "folder" | "document" | "check" | "settings" | "close" | "info" | "spark" | "chevron" | "chevronDown" | "globe" | "help" | "phone";

const paths: Record<IconName, ReactNode> = {
  brand: <><path d="M12 2.8 20 6v5.1c0 4.5-3.2 8.1-8 10.1-4.8-2-8-5.6-8-10.1V6l8-3.2Z" fill="currentColor" stroke="none"/><path d="M9 8h4l2 2v6H9z" fill="white" stroke="none"/><path d="M13 8v2h2M10.5 12h3M10.5 14h3" stroke="#1877f5" strokeWidth="1.1"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  back: <><path d="m15 18-6-6 6-6"/></>,
  shield: <><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  folder: <><path d="M3 6.5h6l2 2h10v9.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3Z"/><path d="M3 9h18"/></>,
  document: <><path d="M7 3.75h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z"/><path d="M14 4v4h4M9 13h6M9 17h6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1 1.8-1.8 3.1-2.1-.5-.1.1-2.1 1.2-1.4-.7-.4-2h-1.4l-.5 2-1.4.7-2.1-1.2-.1-.1-2.1.5-1.8-3.1 1.1-1.8.1-.1v-2.4L3.4 11 5.2 8l2.1.5.1-.1 2.1-1.2.5-2h3.6l.5 2 2.1 1.2.1.1 2.1-.5 1.8 3.1-1.1 1.6-.1.2Z"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  chevronDown: <path d="m7 10 5 5 5-5"/>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.3 2c-1.1.9-1.8 1.3-1.8 2.7M12 17h.01"/></>,
  phone: <path d="M7.4 3.5 10 7.1 8.5 9.3c1 2.3 2.2 3.5 4.5 4.5l2.2-1.5 3.6 2.6-.7 3.3c-.2.9-1.1 1.5-2 1.3C9.2 18.1 5.9 14.8 4.5 7.9c-.2-.9.4-1.8 1.3-2Z"/>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PageHeading({ step, title, description }: { step?: string; title: string; description?: string }) {
  const activeStep = step ? Number(step.match(/\d+/)?.[0] ?? 1) : 0;
  return <>
    {step && <div className="page-progress" aria-label={step}>
      <div className="progress-head"><p className="step-label">{step}</p></div>
      <div className="progress-track" aria-hidden="true">{[1, 2, 3].map(value => <span className={value <= activeStep ? "is-complete" : ""} key={value}/>)}</div>
    </div>}
    <div className="page-heading">
    <h1>{title}</h1>
    {description && <p className="page-description">{description}</p>}
    </div>
  </>;
}

export function BackLink({ href, children = "My cases" }: { href: string; children?: ReactNode }) {
  return <Link className="back-link" href={href}><Icon name="back" size={18}/><span>{children}</span></Link>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="button button-primary" href={href}>{children}</Link>;
}

export function LocalNotice({ children }: { children: ReactNode }) {
  return <p className="local-notice"><Icon name="info" size={17}/><span>{children}</span></p>;
}

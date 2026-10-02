import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kayda Sathi — Your next step, made clear",
  description: "A calm place to understand a legal problem and prepare your next step.",
  applicationName: "Kayda Sathi",
};

export const viewport: Viewport = {
  themeColor: "#f6f6f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

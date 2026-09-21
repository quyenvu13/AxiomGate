import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AxiomGate — Premise Control Ledger",
  description: "Create immutable baselines, test proposals for hidden premises, and inspect every GenLayer verdict.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

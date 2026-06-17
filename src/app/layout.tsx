import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "../../public/fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voyager · AI Travel Agent Control Plane",
  description:
    "Multi-agent orchestration, shared context, human-in-the-loop approvals and live agent observability.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
        className="min-h-screen antialiased"
      >
        {children}
      </body>
    </html>
  );
}

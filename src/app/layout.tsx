import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SkipLink } from "@/components/ui/SkipLink";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "Jashn — AI Event Planner",
    template: "%s | Jashn",
  },
  description:
    "AI-powered planning assistant for weddings, birthdays, and community events. Get budgets, timelines, vendor checklists, and personalized ideas.",
  keywords: ["event planner", "wedding planner", "birthday planner", "AI", "Gemini"],
  authors: [{ name: "Jashn" }],
  openGraph: {
    type: "website",
    title: "Jashn — AI Event Planner",
    description: "Plan your perfect celebration with AI",
    siteName: "Jashn",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1510" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SkipLink />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

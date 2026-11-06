import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvoiceFlow AI - Natural Language Invoicing for Freelancers",
  description:
    "Turn plain English invoice descriptions into official PayPal Invoices using Google Gemini AI and PayPal Invoicing API.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/icon.png" }],
    shortcut: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50/50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50 selection:bg-teal-500/20 selection:text-teal-700">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <DemoBanner />
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
            </main>
          </div>
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

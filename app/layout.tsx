import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvoiceFlow AI - Natural Language Invoicing for Freelancers",
  description:
    "Turn plain English invoice descriptions into official PayPal Invoices using Google Gemini AI and PayPal Invoicing API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

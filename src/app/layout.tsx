import type { Metadata, Viewport } from "next";
import "./globals.css";
import { archivo, montserrat } from "./fonts";

export const metadata: Metadata = {
  title: "Listing Marketing Kits",
  description: "Co-branded listing marketing materials for agents and their lending partners.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}

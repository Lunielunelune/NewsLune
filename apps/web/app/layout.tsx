import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aperture News",
  description: "Global real-time news intelligence, ranked and delivered with low latency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


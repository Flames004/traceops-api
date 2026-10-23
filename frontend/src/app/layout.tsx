import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceOpsAPI — API Gateway & Observability Platform",
  description: "High-performance reverse proxy, atomic rate limiting, and real-time request analytics platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

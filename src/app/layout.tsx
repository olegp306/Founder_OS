import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Founder OS",
  description: "Founder-owned product, token, profile, and campaign control plane"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

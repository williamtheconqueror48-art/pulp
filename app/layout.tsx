import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PULP — a free studio for screenplays, poems & songs",
  description:
    "Pulp is a free writing studio for screenplays, poems and songs. Unlimited scripts, industry-standard formatting, zero cost. Dive in and write.",
  openGraph: {
    title: "PULP — a free studio for screenplays, poems & songs",
    description:
      "Unlimited screenplays, poems and songs. Industry-standard formatting. Free forever. Dive in and write.",
    images: ["/og-image.png"],
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

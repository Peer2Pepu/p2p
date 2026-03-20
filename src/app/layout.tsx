import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peer2Pepu - Decentralized Prediction Markets",
  description: "Bet on What's Next. Peer-to-Peer. No Middleman. Stake on real-world events and earn from your predictions.",
  icons: {
    icon: "/lOGOgreen.svg",
    shortcut: "/lOGOgreen.svg",
    apple: "/lOGOgreen.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent FOUC (Flash of Unstyled Content)
              try {
                const theme = localStorage.getItem('peer2pepu-theme') || 'dark';
                const isDark = theme === 'dark';
                const root = document.documentElement;
                const body = document.body;
                
                // Check if body exists before accessing classList
                if (root) {
                  if (isDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    if (body) {
                      body.classList.add('dark');
                      body.classList.remove('light');
                    }
                  } else {
                    root.classList.add('light');
                    root.classList.remove('dark');
                    if (body) {
                      body.classList.add('light');
                      body.classList.remove('dark');
                    }
                  }
                }
              } catch (e) {
                // Fallback to dark mode - check if elements exist
                if (document.documentElement) {
                  document.documentElement.classList.add('dark');
                }
                if (document.body) {
                  document.body.classList.add('dark');
                }
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
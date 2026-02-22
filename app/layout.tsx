import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "HelixX",
  description: "Precision tracking intelligence",
  applicationName: "HelixX",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HelixX",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS install friendliness */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HelixX" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Theme color for browsers */}
        <meta name="theme-color" content="#0B0B0D" />
      </head>

      <body suppressHydrationWarning>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
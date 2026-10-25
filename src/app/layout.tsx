import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-malayalam/400.css";
import "@fontsource/noto-sans-malayalam/500.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nightline · Bus announcements",
  description:
    "Prepare your trip. Find the right words. Make every journey feel looked after.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nightline" },
  icons: { apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#193b57",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

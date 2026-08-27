import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#176b51",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "HomestayManager APP",
    description: "简单、清楚、无需联网的民宿房态管理工具。",
    applicationName: "HomestayManager APP",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "房态管理" },
    formatDetection: { telephone: false },
    openGraph: {
      title: "HomestayManager APP",
      description: "房态一目了然——本地、离线、简单的民宿房态管理工具。",
      type: "website",
      locale: "zh_CN",
      images: [{ url: image, width: 1731, height: 909, alt: "HomestayManager APP 房态一目了然" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "HomestayManager APP",
      description: "房态一目了然——本地、离线、简单的民宿房态管理工具。",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

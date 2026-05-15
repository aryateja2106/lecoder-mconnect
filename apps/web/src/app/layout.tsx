import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MConnect - Terminal in Your Pocket",
  description: "Mobile terminal control for AI coding agents",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MConnect",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom inside the terminal — accessibility win.
  // The terminal element opts out via `touch-action: pan-y` in globals.css.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#000000",
};

// Demo mode banner component - rendered on server
function DemoModeBanner() {
  // Check environment variable at build/render time
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (!isDemoMode) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
      <span className="text-amber-400 text-xs font-medium">
        🎮 Demo Mode — This is a simulated session showcasing MConnect&apos;s features
      </span>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-zinc-950 text-white">
        <DemoModeBanner />
        {children}
      </body>
    </html>
  );
}

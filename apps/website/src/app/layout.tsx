import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = 'https://lecoder.lesearch.ai';
const siteName = 'LeCoder MConnect';
const siteDescription = 'Control your AI coding agents from your phone. Run Claude Code, Gemini CLI, Cursor Agent from anywhere. Terminal in your pocket.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LeCoder MConnect - Control AI Agents from Your Phone',
    template: '%s | LeCoder MConnect',
  },
  description: siteDescription,
  keywords: [
    'AI coding agents',
    'Claude Code',
    'Gemini CLI',
    'mobile terminal',
    'remote terminal',
    'terminal control',
    'coding assistant',
    'AI programming',
    'developer tools',
    'Cursor Agent',
    'Aider',
    'LeCoder',
    'MConnect',
  ],
  authors: [{ name: 'Arya Teja Rudraraju', url: 'https://github.com/aryateja2106' }],
  creator: 'LeSearch AI',
  publisher: 'LeSearch AI',

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: 'LeCoder MConnect - Control AI Agents from Your Phone',
    description: siteDescription,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LeCoder MConnect - Terminal in your pocket',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'LeCoder MConnect - Control AI Agents from Your Phone',
    description: siteDescription,
    creator: '@r_aryateja',
    images: ['/og-image.png'],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },

  // Manifest
  manifest: '/site.webmanifest',

  // Alternates
  alternates: {
    canonical: siteUrl,
  },

  // Category
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: '#191919',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'LeCoder MConnect',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux',
  description: siteDescription,
  url: siteUrl,
  author: {
    '@type': 'Person',
    name: 'Arya Teja Rudraraju',
    url: 'https://github.com/aryateja2106',
  },
  publisher: {
    '@type': 'Organization',
    name: 'LeSearch AI',
    url: 'https://lesearch.ai',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  softwareVersion: '0.1.4',
  downloadUrl: 'https://www.npmjs.com/package/lecoder-mconnect',
  installUrl: 'https://www.npmjs.com/package/lecoder-mconnect',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[#191919] text-[#e9e9e7] antialiased">
        {children}
      </body>
    </html>
  );
}

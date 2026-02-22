import './globals.css';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const BASE_URL = 'https://ocr-pdfreader.vercel.app';

export const metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: 'OCR-PDFReader — Make Any Scanned PDF Selectable',
    template: '%s | OCR-PDFReader',
  },
  description:
    'Free, private, in-browser OCR tool. Upload a scanned PDF and instantly extract selectable text — page by page, no account needed, your file never leaves your device.',
  keywords: [
    'OCR PDF',
    'make PDF selectable',
    'scanned PDF to text',
    'PDF text extraction',
    'free OCR online',
    'OCR without upload',
    'browser OCR',
    'Tesseract OCR',
    'searchable PDF',
    'PDF reader',
  ],
  authors: [{ name: 'OCR-PDFReader' }],
  creator: 'OCR-PDFReader',

  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'OCR-PDFReader: Make Any Scanned PDF Selectable',
    description:
      'Free in-browser OCR. Upload a scanned PDF, jump to any page, and extract selectable text instantly. No login, no limits, no server upload.',
    siteName: 'OCR-PDFReader',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OCR-PDFReader: Make any scanned PDF selectable',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'OCR-PDFReader: Make Any Scanned PDF Selectable',
    description:
      'Free in-browser OCR. No login, no server uploads. Extract selectable text from any scanned PDF, page by page.',
    images: ['/og-image.png'],
  },

  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'OCR-PDFReader',
              url: BASE_URL,
              description:
                'Free in-browser OCR tool to make scanned PDFs selectable. No login, no server uploads, supports 12+ languages.',
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Any',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              featureList: [
                'On-demand page OCR',
                'Side-by-side original and text view',
                'Supports 12+ languages',
                'No file uploads — fully in-browser',
                'No account required',
                'Free forever',
              ],
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
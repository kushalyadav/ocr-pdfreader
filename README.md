# OCR-PDFReader

Make any scanned or image-based PDF selectable - page by page, on demand, entirely in your browser. No server, no uploads, no limits, free forever.

## What it does

Many PDFs are created from scanned images rather than real text, meaning you cannot highlight, copy, or search the content. OCR-PDFReader solves this by running optical character recognition directly in your browser. Upload your PDF, navigate to the page you need, click "Read This Page", and the extracted text appears side-by-side with the original - ready to select and copy.

Your file never leaves your device. No account required.

## Features

- On-demand OCR: only processes the page you are currently viewing, not the whole document
- Side-by-side view: original PDF on the left, extracted selectable text on the right
- 13 supported languages: English, Japanese, Chinese (Simplified), Chinese (Traditional), Korean, Hindi, French, German, Spanish, Portuguese, Arabic, Russian, Vietnamese
- Confidence filtering: low-confidence characters from mismatched languages are silently dropped instead of returning garbage
- Processed pages are cached so revisiting them is instant
- 50MB file size limit: enforced client-side, nothing is uploaded
- Fully in-browser: built on WebAssembly, no backend required

## Tech Stack

- **Next.js 14** (App Router) - framework
- **pdf.js** - renders PDF pages to canvas at high resolution
- **Tesseract.js** - in-browser OCR engine via WebAssembly
- **pdf-lib** - PDF utilities
- **@vercel/analytics** - privacy-friendly page analytics
- **@vercel/speed-insights** - real-user Core Web Vitals monitoring
- No backend - 100% client-side, runs entirely on Vercel free tier

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
ocr-pdfreader/
├── public/
│   ├── og-image.png          # Open Graph image for social sharing
│   ├── favicon.ico           # Browser tab icon
│   ├── robots.txt            # Search engine crawl rules
│   └── sitemap.xml           # Sitemap for Google indexing
├── src/
│   ├── app/
│   │   ├── layout.js         # App shell, metadata, SEO, analytics
│   │   ├── page.js           # Landing page with upload UI
│   │   ├── page.module.css   # Landing page styles
│   │   └── globals.css       # Dark theme variables and base styles
│   └── components/
│       ├── PDFViewer.js      # Main viewer with OCR logic
│       └── PDFViewer.module.css
├── next.config.js
└── package.json
```

## Deploying to Vercel

Push to GitHub and import the repository at vercel.com/new. Vercel auto-detects Next.js and deploys with zero configuration.

After deploying, update the BASE_URL in `src/app/layout.js` and the sitemap URL in `public/sitemap.xml` to match your actual Vercel domain.

Analytics and Speed Insights activate automatically once the packages are detected by Vercel.

## Notes

- OCR accuracy depends on scan quality. Clean, high-contrast scans work best. Low-resolution or handwritten pages may produce incomplete results.
- The first OCR run on a page downloads Tesseract's language model for the selected language. Subsequent pages in the same session are faster.
- Switching languages reinitializes the Tesseract worker. Pages OCR'd in different languages are cached separately.
- Large PDFs near the 50MB limit may be slow to load on low-memory devices.
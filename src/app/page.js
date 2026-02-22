'use client';

import { useState, useCallback } from 'react';
import PDFViewer from '../components/PDFViewer';
import styles from './page.module.css';

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function Home() {
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const handleFile = (file) => {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File is too large. Please upload a PDF under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setPdfFile(file);
  };

  const onInputChange = (e) => handleFile(e.target.files[0]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const reset = () => { setPdfFile(null); setError(''); };

  if (pdfFile) {
    return <PDFViewer file={pdfFile} onReset={reset} />;
  }

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.badge}>100% In-Browser · No Uploads · Free Forever</div>

        <h1 className={styles.title}>
          OCR<span className={styles.dash}>-</span>PDFReader
        </h1>

        <h2 className={styles.subtitle}>
          Make scanned PDFs selectable — free, instant, private
        </h2>

        <p className={styles.description}>
          Upload any scanned or image-based PDF and extract selectable, copyable text
          directly in your browser. No account, no server uploads, no limits —
          jump to the page you need and OCR runs on demand.
          Supports 10+ languages.
        </p>

        <section aria-label="Upload PDF">
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <div className={styles.dropIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M20 6v10h16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M18 28l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M24 22v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className={styles.dropText}>Drop your PDF here</p>
            <p className={styles.dropSub}>or</p>
            <label className={styles.browseBtn}>
              Browse File
              <input type="file" accept="application/pdf" onChange={onInputChange} hidden />
            </label>
            <p className={styles.dropLimit}>Max {MAX_SIZE_MB}MB · PDF only</p>
          </div>
          {error && <p className={styles.error} role="alert">⚠ {error}</p>}
        </section>

        <section aria-label="Features" className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon} aria-hidden="true">✔</span>
            <span>Instant page render</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon} aria-hidden="true">✔</span>
            <span>OCR only when you need it</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon} aria-hidden="true">✔</span>
            <span>Your file never leaves your device</span>
          </div>
        </section>

        {/* How it works toggle */}
        <button
          className={styles.howBtn}
          onClick={() => setShowHow(v => !v)}
          aria-expanded={showHow}
        >
          {showHow ? '✕ Close' : 'How does it work?'}
        </button>

        {showHow && (
          <section aria-label="How to extract text from a scanned PDF" className={styles.howSection}>
            <h3 className={styles.howTitle}>How to extract text from a scanned PDF</h3>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepBody}>
                  <strong>Upload your scanned PDF</strong>
                  <p>Drag and drop or browse for any image-based PDF — the kind where you can't highlight or copy text. Files stay entirely on your device.</p>
                </div>
              </li>
              <li className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepBody}>
                  <strong>Jump to the page you need</strong>
                  <p>Navigate to any page using the page controls. You don't have to wait for the whole document — OCR runs only on the page you're viewing.</p>
                </div>
              </li>
              <li className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <div className={styles.stepBody}>
                  <strong>Click "Read This Page"</strong>
                  <p>The app runs OCR in your browser and shows the extracted, selectable text side-by-side with the original. Copy what you need and move on.</p>
                </div>
              </li>
            </ol>
          </section>
        )}

      </div>
    </main>
  );
}
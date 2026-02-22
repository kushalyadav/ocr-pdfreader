'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './PDFViewer.module.css';

const OCR_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'chi_tra', label: 'Chinese (Traditional)' },
  { code: 'kor', label: 'Korean' },
  { code: 'hin', label: 'Hindi' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'spa', label: 'Spanish' },
  { code: 'por', label: 'Portuguese' },
  { code: 'ara', label: 'Arabic' },
  { code: 'rus', label: 'Russian' },
  { code: 'vie', label: 'Vietnamese' },
];

export default function PDFViewer({ file, onReset }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [ocrStatus, setOcrStatus] = useState({});
  const [ocrText, setOcrText] = useState({});
  const [copyMsg, setCopyMsg] = useState('');
  const [workerReady, setWorkerReady] = useState(false);
  const [selectedLang, setSelectedLang] = useState('eng');
  const [workerLang, setWorkerLang] = useState('eng');

  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load pdf.js
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (!cancelled) {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  // Init / re-init Tesseract worker when language changes
  useEffect(() => {
    let w;
    let cancelled = false;
    setWorkerReady(false);
    (async () => {
      if (workerRef.current) {
        await workerRef.current.terminate();
        workerRef.current = null;
      }
      const { createWorker } = await import('tesseract.js');
      w = await createWorker(selectedLang);
      if (!cancelled) {
        workerRef.current = w;
        setWorkerLang(selectedLang);
        setWorkerReady(true);
      }
    })();
    return () => {
      cancelled = true;
      if (w) w.terminate();
    };
  }, [selectedLang]);

  // Render current page at high resolution (scale 2.5 for crispness)
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();

      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      // Use high DPI scale.
      const scale = 2.5;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(e);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  const runOCR = useCallback(async () => {
    if (!workerReady || !canvasRef.current) return;
    const key = `${currentPage}_${workerLang}`;
    if (ocrStatus[key] === OCR_STATUS.PROCESSING || ocrStatus[key] === OCR_STATUS.DONE) return;

    setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.PROCESSING }));

    try {
      const imageDataUrl = canvasRef.current.toDataURL('image/png');
      const { data } = await workerRef.current.recognize(imageDataUrl);

      // Filter by confidence, only keep words Tesseract is sure about (>=70%)
      // This drops garbage characters from mismatched languages silently
      const CONFIDENCE_THRESHOLD = 70;
      const filteredLines = data.lines.map(line => {
        const confidentWords = line.words
          .filter(word => word.confidence >= CONFIDENCE_THRESHOLD)
          .map(word => word.text);
        return confidentWords.join(' ');
      }).filter(line => line.trim().length > 0);

      const filteredText = filteredLines.join('\n');

      setOcrText(t => ({ ...t, [key]: filteredText || '(No confident text found on this page for the selected language.)' }));
      setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.DONE }));
    } catch (e) {
      console.error(e);
      setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.ERROR }));
    }
  }, [workerReady, currentPage, workerLang, ocrStatus]);

  const copyText = () => {
    const key = `${currentPage}_${workerLang}`;
    const text = ocrText[key];
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  };

  const goToPage = (p) => {
    const n = Math.max(1, Math.min(numPages, p));
    setCurrentPage(n);
    setPageInput(String(n));
  };

  const key = `${currentPage}_${workerLang}`;
  const status = ocrStatus[key] || OCR_STATUS.IDLE;
  const text = ocrText[key] || '';

  return (
    <div className={styles.layout}>
      {/* ── Top Bar ── */}
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <button className={styles.backBtn} onClick={onReset}>← Back</button>
          <div className={styles.appName}>OCR-PDFReader</div>
          <div className={styles.fileChip} title={file.name}>
            <span className={styles.fileChipIcon}>PDF</span>
            <span className={styles.fileChipName}>{file.name}</span>
            <span className={styles.fileChipPages}>{numPages}p</span>
          </div>
        </div>

        <div className={styles.topCenter}>
          <button className={styles.navBtn} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
          <input
            className={styles.pageInput}
            type="number"
            min={1}
            max={numPages}
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onBlur={() => goToPage(parseInt(pageInput) || currentPage)}
            onKeyDown={e => { if (e.key === 'Enter') goToPage(parseInt(pageInput) || currentPage); }}
          />
          <span className={styles.pageOf}>/ {numPages}</span>
          <button className={styles.navBtn} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>›</button>
        </div>

        <div className={styles.topRight}>
          <div className={styles.langWrap}>
            <label className={styles.langLabel} title="Select the language the PDF is written in. This reads text in that language, it does not translate.">
              Read in
            </label>
            <select
              className={styles.langSelect}
              value={selectedLang}
              onChange={e => setSelectedLang(e.target.value)}
              disabled={!workerReady}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {!workerReady && <span className={styles.langLoading}>loading…</span>}
          </div>

          {status === OCR_STATUS.IDLE && (
            <button className={styles.ocrBtn} onClick={runOCR} disabled={!workerReady || !pdfDoc}>
              {workerReady ? 'Read This Page' : 'Loading OCR…'}
            </button>
          )}
          {status === OCR_STATUS.PROCESSING && (
            <div className={styles.processingChip}>
              <div className={styles.spinner} /> Reading page {currentPage}…
            </div>
          )}
          {status === OCR_STATUS.DONE && (
            <div className={styles.doneChip}>Done - scroll right to read</div>
          )}
          {status === OCR_STATUS.ERROR && (
            <button className={styles.ocrBtnError} onClick={() => setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.IDLE }))}>
              ⚠ Retry
            </button>
          )}
        </div>
      </header>

      {/* ── Side-by-side viewer ── */}
      <main className={styles.viewer}>
        {!pdfDoc && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading PDF…</span>
          </div>
        )}

        {pdfDoc && (
          <div className={styles.splitView}>
            {/* Original PDF */}
            <div className={styles.pane}>
              <div className={styles.paneLabel}>Original</div>
              <div className={styles.paneScroll}>
                <canvas ref={canvasRef} className={styles.canvas} />
              </div>
            </div>

            {/* Divider */}
            <div className={styles.divider} />

            {/*OCR Text */}
            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                Readable Text
                {status === OCR_STATUS.DONE && (
                  <button className={styles.copyBtnInline} onClick={copyText}>
                    {copyMsg || ' Copy'}
                  </button>
                )}
              </div>
              <div className={styles.paneScroll}>
                {status === OCR_STATUS.IDLE && (
                  <div className={styles.emptyState}>
                    <p>Click <strong>"Read This Page"</strong> in the toolbar to extract selectable text from this page.</p>
                  </div>
                )}
                {status === OCR_STATUS.PROCESSING && (
                  <div className={styles.emptyState}>
                    <div className={styles.spinner} style={{ width: 32, height: 32, borderWidth: 3 }} />
                    <p>Running OCR on page {currentPage}…<br /><span style={{ fontSize: '0.8rem', opacity: 0.6 }}>This may take a few seconds</span></p>
                  </div>
                )}
                {status === OCR_STATUS.DONE && (
                  <div className={styles.textContent}>
                    {text}
                  </div>
                )}
                {status === OCR_STATUS.ERROR && (
                  <div className={styles.emptyState}>
                    <p>OCR failed on this page.</p>
                    <button className={styles.ocrBtnError} onClick={() => setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.IDLE }))}>
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Done pages legend */}
        <div className={styles.legend}>
          {[...new Set(
            Object.entries(ocrStatus)
              .filter(([, st]) => st === OCR_STATUS.DONE)
              .map(([k]) => parseInt(k.split('_')[0]))
          )].sort((a, b) => a - b).map(pg => (
            <span
              key={pg}
              className={`${styles.doneBadge} ${pg === currentPage ? styles.activeBadge : ''}`}
              onClick={() => goToPage(pg)}
            >p{pg}</span>
          ))}
        </div>
      </main>
    </div>
  );
}
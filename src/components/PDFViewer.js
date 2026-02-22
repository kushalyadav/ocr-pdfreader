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

const CONFIDENCE_THRESHOLD = 70;

export default function PDFViewer({ file, onReset }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [ocrStatus, setOcrStatus] = useState({});
  const [ocrData, setOcrData] = useState({});
  const [copyMsg, setCopyMsg] = useState('');
  const [workerReady, setWorkerReady] = useState(false);
  const [selectedLang, setSelectedLang] = useState('eng');
  const [workerLang, setWorkerLang] = useState('eng');
  const [canvasNativeSize, setCanvasNativeSize] = useState({ w: 0, h: 0 });

  const [viewMode, setViewMode] = useState('overlay'); // 'overlay' | 'text'
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (!cancelled) { setPdfDoc(doc); setNumPages(doc.numPages); }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    let w; let cancelled = false;
    setWorkerReady(false);
    (async () => {
      if (workerRef.current) { await workerRef.current.terminate(); workerRef.current = null; }
      const { createWorker } = await import('tesseract.js');
      w = await createWorker(selectedLang);
      if (!cancelled) { workerRef.current = w; setWorkerLang(selectedLang); setWorkerReady(true); }
    })();
    return () => { cancelled = true; if (w) w.terminate(); };
  }, [selectedLang]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      const scale = 2.5;
      const viewport = page.getViewport({ scale });

      // Render into the left (original) canvas
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try { await task.promise; } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(e);
        return;
      }
      if (cancelled) return;

      if (overlayCanvasRef.current) {
        const oc = overlayCanvasRef.current;
        oc.width = viewport.width;
        oc.height = viewport.height;
        oc.getContext('2d').drawImage(canvas, 0, 0);
      }

      setCanvasNativeSize({ w: viewport.width, h: viewport.height });
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

      const words = [];
      const filteredLines = data.lines.map(line => {
        const confidentWords = line.words.filter(w => w.confidence >= CONFIDENCE_THRESHOLD);
        confidentWords.forEach(w => {
          words.push({
            text: w.text,
            bbox: w.bbox,
          });
        });
        return confidentWords.map(w => w.text).join(' ');
      }).filter(l => l.trim().length > 0);

      const filteredText = filteredLines.join('\n');

      setOcrData(d => ({
        ...d,
        [key]: {
          text: filteredText || '(No confident text found for the selected language.)',
          words,
          canvasW: canvasRef.current.width,
          canvasH: canvasRef.current.height,
        },
      }));
      setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.DONE }));
    } catch (e) {
      console.error(e);
      setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.ERROR }));
    }
  }, [workerReady, currentPage, workerLang, ocrStatus]);

  const copyText = () => {
    const key = `${currentPage}_${workerLang}`;
    const d = ocrData[key];
    if (!d) return;
    navigator.clipboard.writeText(d.text).then(() => {
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
  const data = ocrData[key];

  //invisible text overlay spans 

  const TextOverlay = ({ words, canvasW, canvasH }) => {
    const overlayRef = useRef(null);
    const [scale, setScale] = useState({ x: 1, y: 1 });

    useEffect(() => {
      if (!overlayRef.current) return;
      const obs = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        setScale({ x: width / canvasW, y: height / canvasH });
      });
      obs.observe(overlayRef.current);
      return () => obs.disconnect();
    }, [canvasW, canvasH]);

    return (
      <div ref={overlayRef} className={styles.textOverlay}>
        {words.map((w, i) => {
          const left   = w.bbox.x0 * scale.x;
          const top    = w.bbox.y0 * scale.y;
          const width  = (w.bbox.x1 - w.bbox.x0) * scale.x;
          const height = (w.bbox.y1 - w.bbox.y0) * scale.y;

          // Use a fixed readable font size, then scaleX to stretch/compress
          // horizontally to fit the bbox width exactly. This avoids
          // font metric mismatches that cause vertical misalignment.
          const fontSize = height * 0.8;

          return (
            <span
              key={i}
              className={styles.textWord}
              style={{
                left,
                top,
                width: width + 8, // +8px so adjacent word spans slightly overlap for smooth drag-select
                height,
                fontSize,
                lineHeight: `${height}px`,
                // Stretch text horizontally to fill the bbox width
                transform: `scaleX(${width / Math.max(w.text.length * fontSize * 0.6, 1)})`,
              }}
            >
              {w.text}{' '}
            </span>
          );
        })}
      </div>
    );
  };

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
            min={1} max={numPages}
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
            <button className={styles.copyBtnTop} onClick={copyText}>
              {copyMsg || 'Copy All Text'}
            </button>
          )}
          {status === OCR_STATUS.ERROR && (
            <button className={styles.ocrBtnError} onClick={() => setOcrStatus(s => ({ ...s, [key]: OCR_STATUS.IDLE }))}>
              ⚠ Retry
            </button>
          )}
        </div>
      </header>

      <main className={styles.viewer}>
        {!pdfDoc && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading PDF…</span>
          </div>
        )}

        {pdfDoc && (
          <div className={styles.splitView}>

            <div className={styles.pane}>
              <div className={styles.paneLabel}>Original</div>
              <div className={styles.paneScroll}>
                <div className={styles.canvasWrap}>
                  <canvas ref={canvasRef} className={styles.canvas} />
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.pane}>
              <div className={styles.paneLabel}>
                <span>
                  Selectable
                  {status === OCR_STATUS.IDLE && <span className={styles.paneLabelHint}>- click "Read This Page" to enable</span>}
                  {status === OCR_STATUS.DONE && viewMode === 'overlay' && <span className={styles.paneLabelHint}>- click and drag to select text</span>}
                </span>
                {status === OCR_STATUS.DONE && (
                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.toggleBtn} ${viewMode === 'overlay' ? styles.toggleActive : ''}`}
                      onClick={() => setViewMode('overlay')}
                      title="View PDF with selectable text overlaid"
                    >
                      PDF View
                    </button>
                    <button
                      className={`${styles.toggleBtn} ${viewMode === 'text' ? styles.toggleActive : ''}`}
                      onClick={() => setViewMode('text')}
                      title="View extracted text only"
                    >
                      Text View
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.paneScroll}>
                {/* Overlay canvas always in DOM so ref is available */}
                <div className={styles.canvasWrap} style={{ display: status === OCR_STATUS.DONE && viewMode === 'overlay' ? 'inline-block' : 'none' }}>
                  <canvas ref={overlayCanvasRef} className={styles.canvas} />
                  {status === OCR_STATUS.DONE && data && (
                    <TextOverlay
                      words={data.words}
                      canvasW={data.canvasW}
                      canvasH={data.canvasH}
                    />
                  )}
                </div>

                {/* Text-only view */}
                {status === OCR_STATUS.DONE && viewMode === 'text' && data && (
                  <div className={styles.textContent}>
                    {data.text}
                  </div>
                )}

                {status === OCR_STATUS.IDLE && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🔍</div>
                    <p>Click <strong>"Read This Page"</strong> to make text selectable on this page.</p>
                  </div>
                )}
                {status === OCR_STATUS.PROCESSING && (
                  <div className={styles.emptyState}>
                    <div className={styles.spinner} style={{ width: 32, height: 32, borderWidth: 3 }} />
                    <p>Running OCR on page {currentPage}…<br />
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>This may take a few seconds</span>
                    </p>
                  </div>
                )}
                {status === OCR_STATUS.ERROR && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>⚠</div>
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
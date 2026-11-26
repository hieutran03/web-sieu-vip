// Progressive viewer for the large self-hosted PDFs. The browser's built-in viewer (Edge's
// Acrobat engine in particular) downloads the whole file before it shows page 1, which takes
// minutes for a 100 MB scan over the storage link. PDF.js instead fetches only the byte ranges a
// page needs, so page 1 appears after a few hundred KB and later pages load as they scroll in.
//
// Loaded lazily from DocumentsPage, so the PDF.js bundle is only fetched when a viewer opens.

import React, { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

// Font data, character maps and image decoders (JPEG 2000 scans) are fetched only when a page
// needs them; served from the CDN copy of the exact installed version to keep the repo small.
const PDFJS_ASSETS = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}`;
const DOCUMENT_OPTIONS = {
  // Small chunks: opening a document touches many scattered objects, and each request over the
  // storage tunnel is latency-bound, so fetching less per request reaches page 1 sooner.
  rangeChunkSize: 64 * 1024,
  disableAutoFetch: true,
  disableStream: true,
  standardFontDataUrl: `${PDFJS_ASSETS}/standard_fonts/`,
  cMapUrl: `${PDFJS_ASSETS}/cmaps/`,
  cMapPacked: true,
  wasmUrl: `${PDFJS_ASSETS}/wasm/`,
  iccUrl: `${PDFJS_ASSETS}/iccs/`
};
// Pages this far outside the viewport are rendered ahead, and freed beyond it: a fully rendered
// 100-page scan would otherwise hold over a gigabyte of canvas memory.
const RENDER_MARGIN = "1500px 0px";
const MAX_PIXEL_RATIO = 1.5;
const PAGE_GAP = 12;

export default function PdfViewer({ url, labels, fallback }) {
  const scrollRef = useRef(null);
  const [root, setRoot] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [firstRatio, setFirstRatio] = useState(Math.SQRT2);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setPdf(null);
    setFailed(false);
    let cancelled = false;
    const task = getDocument({ url, ...DOCUMENT_OPTIONS });
    task.promise
      .then(async (loaded) => {
        const first = await loaded.getPage(1);
        if (cancelled) return;
        const viewport = first.getViewport({ scale: 1 });
        setFirstRatio(viewport.height / viewport.width);
        setPdf(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("PDF.js could not open the document, falling back to the browser viewer", error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    setRoot(element);
    const observer = new ResizeObserver(([entry]) => {
      // Round so a scrollbar appearing does not re-render every page for a few pixels.
      setWidth(Math.max(0, Math.floor((entry.contentRect.width - 2 * PAGE_GAP) / 8) * 8));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [failed]);

  const onScroll = (event) => {
    const container = event.currentTarget;
    const marker = container.scrollTop + container.clientHeight / 3;
    let page = 1;
    for (const child of container.children) {
      if (!child.dataset.page) continue;
      if (child.offsetTop > marker) break;
      page = Number(child.dataset.page);
    }
    setCurrentPage(page);
  };

  if (failed) return fallback;

  return (
    <div className="docs-pdf">
      <div className="docs-pdf-scroll" ref={scrollRef} onScroll={onScroll}>
        {pdf && root && width
          ? Array.from({ length: pdf.numPages }, (_, index) => (
              <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} width={width} estimatedRatio={firstRatio} root={root} />
            ))
          : <p className="docs-pdf-status">{labels.loading}</p>}
      </div>
      {pdf ? (
        <span className="docs-pdf-counter">
          {labels.page} {currentPage} / {pdf.numPages}
        </span>
      ) : null}
    </div>
  );
}

function PdfPage({ pdf, pageNumber, width, estimatedRatio, root }) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [ratio, setRatio] = useState(estimatedRatio);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      root,
      rootMargin: RENDER_MARGIN
    });
    observer.observe(holderRef.current);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!nearViewport) {
      // Release the bitmap; the holder keeps its height so the scroll position does not jump.
      canvas.width = 0;
      canvas.height = 0;
      setRendered(false);
      return undefined;
    }

    let cancelled = false;
    let renderTask = null;
    pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return undefined;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTask = page.render({ canvas, viewport });
        return renderTask.promise.then(() => {
          if (!cancelled) setRendered(true);
        });
      })
      .catch((error) => {
        if (error?.name !== "RenderingCancelledException" && !cancelled) console.warn(`PDF page ${pageNumber} failed`, error);
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, width, nearViewport]);

  return (
    <div
      ref={holderRef}
      className={`docs-pdf-page ${rendered ? "is-rendered" : ""}`}
      data-page={pageNumber}
      style={{ width, height: Math.round(width * ratio) }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

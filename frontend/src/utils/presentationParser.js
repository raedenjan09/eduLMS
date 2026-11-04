import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Check if an ArrayBuffer starts with the "%PDF-" magic header.
 */
export const isPdfArrayBuffer = (arrayBuffer) => {
  if (!arrayBuffer || arrayBuffer.byteLength < 5) return false;
  const bytes = new Uint8Array(arrayBuffer, 0, 5);
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  );
};

/**
 * Parse a .pptx ArrayBuffer to get the exact slide count and slide titles.
 */
export const parsePptxArrayBuffer = async (arrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const parser = new DOMParser();

  const slideEntries = [];
  zip.folder('ppt/slides')?.forEach((relativePath, file) => {
    const match = relativePath.match(/^slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({
        number: parseInt(match[1], 10),
        file,
      });
    }
  });

  slideEntries.sort((a, b) => a.number - b.number);
  const parsedSlides = [];

  for (let idx = 0; idx < slideEntries.length; idx++) {
    const entry = slideEntries[idx];
    const xmlText = await entry.file.async('string');
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    let slideTitle = '';
    const shapes = Array.from(xmlDoc.getElementsByTagNameNS('*', 'sp'));
    for (const sp of shapes) {
      const ph = sp.getElementsByTagNameNS('*', 'ph')[0];
      const phType = ph?.getAttribute('type') || '';
      if (phType === 'title' || phType === 'ctrTitle') {
        const tNodes = Array.from(sp.getElementsByTagNameNS('*', 't'));
        const text = tNodes.map((t) => t.textContent || '').join('').trim();
        if (text) {
          slideTitle = text;
          break;
        }
      }
    }

    parsedSlides.push({
      slideNumber: idx + 1,
      title: slideTitle || `Slide ${idx + 1}`,
    });
  }

  return {
    slides: parsedSlides,
    totalSlides: parsedSlides.length,
  };
};

/**
 * Load a PDF ArrayBuffer via pdfjs-dist and return the document + page count.
 */
export const loadPdfFromBuffer = async (arrayBuffer) => {
  const uint8 = new Uint8Array(arrayBuffer.slice(0));
  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdfDoc = await loadingTask.promise;
  return {
    pdfDoc,
    totalSlides: pdfDoc.numPages,
  };
};

/**
 * Render a specific 1-based PDF page to a Blob Image URL for instant 0ms switching.
 */
export const renderPdfPageToImageUrl = async (pdfDoc, pageNumber) => {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, Math.max(1.5, 1280 / unscaledViewport.width));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(window.URL.createObjectURL(blob));
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      },
      'image/png'
    );
  });
};

import { svg, type SVGTemplateResult } from 'lit';
import { qrcodegen } from '../vendor/qrcodegen.js';

const QUIET_ZONE = 2;
const ALPHANUMERIC_RE = /^[A-Z0-9 $%*+\-./:]+$/u;

export function renderQrCodeSvg(text: string): SVGTemplateResult {
  const segments = buildQrSegments(text);
  const qr = qrcodegen.QrCode.encodeSegments(segments, qrcodegen.QrCode.Ecc.LOW);
  const size = qr.size + QUIET_ZONE * 2;
  const cells: SVGTemplateResult[] = [];

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.getModule(x, y)) continue;
      cells.push(svg`<rect x=${x + QUIET_ZONE} y=${y + QUIET_ZONE} width="1" height="1"></rect>`);
    }
  }

  return svg`
    <svg
      viewBox=${`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="QR code"
      shape-rendering="crispEdges"
    >
      <rect width=${size} height=${size} fill="#fff"></rect>
      <g fill="#000">${cells}</g>
    </svg>
  `;
}

function buildQrSegments(text: string): qrcodegen.QrSegment[] {
  const segments: qrcodegen.QrSegment[] = [];
  let index = 0;

  while (index < text.length) {
    let end = index + 1;
    const alphanumeric = ALPHANUMERIC_RE.test(text[index] ?? '');

    while (end < text.length && ALPHANUMERIC_RE.test(text[end] ?? '') === alphanumeric) {
      end += 1;
    }

    const chunk = text.slice(index, end);
    if (alphanumeric) {
      segments.push(qrcodegen.QrSegment.makeAlphanumeric(chunk));
    } else {
      segments.push(qrcodegen.QrSegment.makeBytes(new TextEncoder().encode(chunk)));
    }
    index = end;
  }

  return segments;
}

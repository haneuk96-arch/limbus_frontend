"use client";

import { toPng } from "html-to-image";

/** html-to-image 실패 시 콘솔에 `{}`만 나오는 경우(Event 등) 대비 */
export function formatCaptureError(err: unknown): string {
  if (err instanceof Error) {
    const c = err.cause;
    const causeStr =
      c instanceof Error ? c.message : c != null && typeof c !== "object" ? String(c) : "";
    return [err.message || "(no message)", causeStr && `cause: ${causeStr}`].filter(Boolean).join(" | ");
  }
  if (typeof Event !== "undefined" && err instanceof Event) {
    return `DOM Event: ${err.type}`;
  }
  if (err != null && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export type RestoreInlinedImages = () => void;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("FileReader: unexpected result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * 캡처 전에 img를 data: URL로 바꿔 교차 출처(CORS) 없이 픽셀에 포함되게 함.
 * (blob: 은 img-src CSP에 blob: 이 없으면 차단되는 경우가 많아 data: 사용)
 * 완료 후 반드시 반환된 restore()로 원복.
 */
export async function inlineExternalImagesForCapture(root: HTMLElement): Promise<RestoreInlinedImages> {
  const restores: { img: HTMLImageElement; originalSrc: string; dataUrl: string }[] = [];
  const imgs = root.querySelectorAll<HTMLImageElement>("img[src]");
  const baseOrigin = typeof window !== "undefined" ? window.location.origin : "";

  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
    try {
      const absUrl = new URL(src, window.location.href).href;
      const imgOrigin = new URL(absUrl).origin;
      let res: Response | null = null;
      if (imgOrigin !== baseOrigin) {
        res = await fetch(`${baseOrigin}/api/proxy-image?url=${encodeURIComponent(absUrl)}`).catch(() => null);
      } else {
        res = await fetch(absUrl, { credentials: "include", mode: "cors" }).catch(() => null);
      }
      if (!res?.ok) continue;
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      restores.push({ img, originalSrc: src, dataUrl });
      img.src = dataUrl;
      await img.decode?.().catch(() => new Promise<void>((r) => {
        img.onload = () => r();
      }));
    } catch {
      /* 개별 이미지 실패 시 스킵 */
    }
  }

  return () => {
    for (const { img, originalSrc } of restores) {
      img.src = originalSrc;
    }
  };
}

export type SnapshotDomOptions = {
  pixelRatio?: number;
  /** 스크롤 높이만큼 minHeight를 잠시 올려 긴 목록 전체가 들어가게 함 */
  expandToScrollHeight?: boolean;
  /**
   * false면 웹폰트를 SVG에 임베드(용량·실패율↑). 기본 true — Geist 등 원격 WOFF 임베드가
   * 대형 DOM에서 SVG data URL 한도/로드 실패(img.onerror → reject 인자 없음)를 유발하는 경우가 많음.
   */
  skipFonts?: boolean;
};

const MAX_CANVAS_SIDE = 16384;

/**
 * DOM을 PNG data URL로 (브라우저 스타일 계산에 가깝게 — html-to-image / foreignObject).
 * keyword-capture-hex 는 캡처 구간에만 적용( exclude-from-capture 등 인라인 규칙 ).
 */
export async function snapshotElementToPngDataUrl(
  el: HTMLElement,
  opts: SnapshotDomOptions = {},
): Promise<string> {
  const requestedPr = opts.pixelRatio ?? 2;
  const skipFonts = opts.skipFonts !== false;
  const captureClass = "keyword-capture-hex";
  let prevMinHeight = "";

  el.classList.add(captureClass);
  if (opts.expandToScrollHeight) {
    prevMinHeight = el.style.minHeight;
    el.style.minHeight = `${el.scrollHeight}px`;
  }

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise<void>((r) => setTimeout(r, 80));
  await document.fonts.ready;

  const w = Math.max(1, el.offsetWidth);
  const h = Math.max(1, Math.max(el.scrollHeight, el.clientHeight));
  const maxSide = Math.max(w, h);
  /* canvas.width ≈ w * pr — 한변 한도(16384) 안으로 pr 상한(너무 작으면 흐릿해지나 캡처 성공 우선) */
  const prCap = (MAX_CANVAS_SIDE * 0.96) / maxSide;
  const pixelRatio = Math.max(0.05, Math.min(requestedPr, prCap));

  try {
    try {
      return await toPng(el, {
        pixelRatio,
        backgroundColor: "#131316",
        /*
         * cacheBust: true 는 URL에 ?timestamp 를 붙임 → 인라인(data:/blob:) src 가 깨질 수 있음.
         */
        cacheBust: false,
        skipFonts,
      });
    } catch (e1) {
      /*
       * 대형 DOM은 foreignObject+SVG data URL 이 브라우저 한도/파싱 한계로 img 로드 시 error 만 남김.
       * html2canvas 로 폴백(스타일 정합도는 약간 낮을 수 있으나 이미지·전체 높이는 안정적).
       */
      const { default: html2canvas } = await import("html2canvas");
      const origError = console.error;
      const origWarn = console.warn;
      const suppressColorParse = (fn: typeof console.error) => (...args: unknown[]) => {
        const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
        if (/lab|lch|oklab|oklch|unsupported color/i.test(msg)) return;
        fn.apply(console, args);
      };
      console.error = suppressColorParse(origError);
      console.warn = suppressColorParse(origWarn);
      try {
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#131316",
          scale: pixelRatio,
          logging: false,
        });
        return canvas.toDataURL("image/png");
      } catch (e2) {
        throw new Error(
          `스냅샷 실패: html-to-image(${formatCaptureError(e1)}); html2canvas(${formatCaptureError(e2)})`,
          { cause: e2 },
        );
      } finally {
        console.error = origError;
        console.warn = origWarn;
      }
    }
  } finally {
    if (opts.expandToScrollHeight) {
      el.style.minHeight = prevMinHeight;
    }
    el.classList.remove(captureClass);
  }
}

export function downloadPngDataUrl(fileName: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

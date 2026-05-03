"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ReportHelpSectionId =
  | "identity"
  | "cardpackStarred"
  | "cardpackPlanned"
  | "egoPick"
  | "egoList";

/** 인격 가이드 1장: 색 구분 원형 표식 + 설명 */
export type IdentityLegendColor = "emerald" | "sky" | "amber";

type IdentitySlideLegend = {
  imageSrc: string;
  variant: "legend";
  legendItems: readonly { color: IdentityLegendColor; text: string }[];
};

type IdentitySlideBullets = {
  imageSrc: string;
  variant: "bullets";
  bulletLines: readonly string[];
};

type IdentitySlide = IdentitySlideLegend | IdentitySlideBullets;

type HelpBlock = {
  title: string;
  /** 단일·복수 이미지 + 문단 (slides 없을 때만 사용) */
  imageSrc: string | readonly string[];
  paragraphs: string[];
  /** 인격 가이드: 슬라이드 네비 있음 — 있으면 imageSrc·paragraphs 무시 */
  slides?: readonly IdentitySlide[];
};

/** · 문자 대신 항상 보이는 원형 마커 (font 무관) */
const identityLegendBulletClass: Record<IdentityLegendColor, string> = {
  emerald: "bg-emerald-400 ring-2 ring-emerald-400/30",
  sky: "bg-sky-400 ring-2 ring-sky-400/30",
  amber: "bg-amber-300 ring-2 ring-amber-300/30",
};

const helpBodyTextClass = "text-[16px] leading-relaxed text-gray-300";

export const REPORT_SECTION_HELP: Record<ReportHelpSectionId, HelpBlock> = {
  identity: {
    title: "인격 / E.G.O 선택",
    imageSrc: [],
    paragraphs: [],
    slides: [
      {
        imageSrc: "/images/guide/guide_final_1.png",
        variant: "legend",
        legendItems: [
          {
            color: "emerald",
            text: "인격 및 E.G.O를 선택할 수 있는 영역으로 전환합니다.",
          },
          {
            color: "sky",
            text: "편성된 인격의 키워드 수, 전체 인격의 키워드 수, 편성된 인격이 얻을 수 있는 E.G.O 자원 수를 확인할 수 있습니다.",
          },
          {
            color: "amber",
            text: "인격 편성 및 스킬 수를 설정할 수 있습니다.",
          },
        ],
      },
      {
        imageSrc: "/images/guide/guide_final_2.png",
        variant: "legend",
        legendItems: [
          {
            color: "sky",
            text: "E.G.O 사용에 필요한 자원의 합입니다. ( 전체 E.G.O 기준 )",
          },
          {
            color: "amber",
            text: "각 수감자 별 E.G.O 를 설정할 수 있습니다. 선택 시 나오는 팝업에서 각 등급별 E.G.O 선택 후 등록 버튼을 눌러 적용 가능합니다.",
          },
        ],
      },
    ],
  },
  cardpackStarred: {
    title: "선택한 카드팩 목록",
    imageSrc: "/images/help/report-cardpack-starred.svg",
    paragraphs: [
      "이 보고서에 저장된 카드팩이 목록으로 표시됩니다. 난이도·층 버튼으로 필터할 수 있습니다.",
      "층별 체크가 필요할 때는 해당 층만 선택한 뒤 카드의 체크 아이콘으로 고정합니다.",
      "카드팩을 즐겨찾기에 넣는 방법은 카드팩 탭에서 별 표시로 보고서 검색 JSON에 ID가 들어가야 합니다.",
    ],
  },
  cardpackPlanned: {
    title: "진행(예정) 카드팩 목록",
    imageSrc: [],
    paragraphs: [
      "1행은 1~5층, 행을 추가하면 6~10층·11~15층 순으로 이어집니다.",
      "각 층 칸을 눌러 그 층에서 사용할 출현 카드팩을 고릅니다.",
      "선택 시 자동저장됩니다.",
    ],
  },
  egoPick: {
    title: "보고서 내 에고기프트 선택",
    imageSrc: [],
    paragraphs: [
      "「에고기프트 검색·선택」을 누르면 목록에서 검색하고, 별(즐겨찾기)로 이 보고서에 넣을 에고기프트를 고릅니다.",
      "선택한 개수는 이 블록에 숫자로 표시됩니다. 적용 후 목록·합성 표시에 반영됩니다.",
      "선택 시 자동저장됩니다.",
    ],
  },
  egoList: {
    title: "에고기프트 목록",
    imageSrc: [],
    paragraphs: [
      "키워드별·모아보기·층별 보기 모드를 바꿔 같은 즐겨찾기를 다양하게 정렬해 볼 수 있습니다.",
      "카드에 마우스를 올리면 「정보 보기」「획득」「삭제」 영역이 강조됩니다. 획득 체크는 보고서 표시용입니다.",
      "「간소화」로 카드를 줄여 보거나, 에고기프트 다운로드 버튼을 눌러 이미지를 저장할 수 있습니다.",
    ],
  },
};

type ModalProps = {
  sectionId: ReportHelpSectionId | null;
  onClose: () => void;
};

function IdentityLegendBody({ items }: { items: IdentitySlideLegend["legendItems"] }) {
  return (
    <div className="space-y-5">
      {items.map(({ color, text }, idx) => (
        <div key={`legend-desc-${idx}`} className="flex items-start gap-3.5 sm:gap-4">
          <span
            className={`mt-1.5 inline-block h-4 w-4 shrink-0 rounded-full sm:h-5 sm:w-5 ${identityLegendBulletClass[color]}`}
            aria-hidden
          />
          <p className={`min-w-0 flex-1 ${helpBodyTextClass}`}>{text}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportSectionHelpModal({ sectionId, onClose }: ModalProps) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
  }, [sectionId]);

  useEffect(() => {
    if (!sectionId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const block = REPORT_SECTION_HELP[sectionId];
      const slides = block.slides;
      if (!slides?.length) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSlideIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sectionId, onClose]);

  if (!sectionId || typeof document === "undefined") return null;

  const content = REPORT_SECTION_HELP[sectionId];
  const slides = content.slides;
  const useSlides = slides && slides.length > 0;
  const guideImages = Array.isArray(content.imageSrc) ? content.imageSrc : [content.imageSrc];
  const wideGallery = !useSlides && guideImages.length > 1;
  const slideCount = useSlides ? slides!.length : guideImages.length;
  const safeIndex = useSlides
    ? Math.min(slideIndex, slideCount - 1)
    : 0;
  const currentSlide = useSlides ? slides![safeIndex] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] overflow-y-auto bg-black/65 p-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-section-help-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 중간 래퍼는 pointer-events-none → 빈 영역 클릭이 오버레이로 전달되어 닫힘 */}
      <div className="pointer-events-none flex min-h-full w-full justify-center sm:items-center">
        <div
          className={`pointer-events-auto relative flex w-full flex-col rounded-xl border border-[#b8860b]/50 bg-[#131316] shadow-[0_16px_48px_rgba(0,0,0,0.55)] ${useSlides ? "max-w-4xl" : wideGallery ? "max-w-3xl" : "max-w-lg"}`}
        >
        <div className="flex items-start justify-between gap-3 border-b border-[#b8860b]/35 px-4 py-3">
          <h2 id="report-section-help-title" className="text-lg font-semibold text-yellow-300">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="px-4 py-3">
          {useSlides && currentSlide ? (
            <>
              <div className="overflow-hidden rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]">
                <img
                  src={currentSlide.imageSrc}
                  alt={`${content.title} 안내 이미지 ${safeIndex + 1}/${slideCount}`}
                  className="h-auto w-full max-w-full object-contain object-top [max-height:min(82vh,920px)]"
                />
              </div>
              <div className="mt-4">
                {currentSlide.variant === "legend" ? (
                  <IdentityLegendBody items={currentSlide.legendItems} />
                ) : (
                  <ul className={`space-y-2.5 ${helpBodyTextClass}`}>
                    {currentSlide.bulletLines.map((line, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {slideCount > 1 && (
                <p className="mt-4 text-center text-xs text-gray-500" aria-live="polite">
                  {safeIndex + 1} / {slideCount}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {guideImages.map((src, i) => (
                  <div
                    key={src}
                    className="overflow-hidden rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]"
                  >
                    <img
                      src={src}
                      alt={
                        wideGallery ? `${content.title} 안내 이미지 ${i + 1}` : `${content.title} 안내 이미지`
                      }
                      className="h-auto w-full max-w-full object-contain object-top [max-height:min(70vh,720px)]"
                    />
                  </div>
                ))}
              </div>
              <ul className={`mt-4 space-y-2.5 ${helpBodyTextClass}`}>
                {content.paragraphs.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {useSlides && slideCount > 1 ? (
          <div className="flex shrink-0 gap-2 border-t border-[#b8860b]/25 px-4 py-3">
            <button
              type="button"
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex <= 0}
              className="flex-1 rounded-lg border border-[#b8860b]/45 bg-[#1a1a1d] py-2.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setSlideIndex((i) => Math.min(slideCount - 1, i + 1))}
              disabled={safeIndex >= slideCount - 1}
              className="flex-1 rounded-lg border border-[#b8860b]/45 bg-[#1a1a1d] py-2.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        ) : null}
        <div className="border-t border-[#b8860b]/25 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-yellow-400/90 py-2.5 text-sm font-semibold text-black hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80"
          >
            확인
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type TriggerProps = {
  sectionId: ReportHelpSectionId;
  onOpen: (id: ReportHelpSectionId) => void;
};

/** 결과 탭 각 블록 옆에 두는 작은 도움말 버튼 */
export function ReportHelpTrigger({ sectionId, onOpen }: TriggerProps) {
  const label = `${REPORT_SECTION_HELP[sectionId].title} 도움말`;
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#b8860b]/55 bg-[#1a1a1d]/95 text-xs font-bold leading-none text-amber-200/95 shadow-sm hover:bg-amber-500/15 hover:border-[#d4af37]/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/55"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(sectionId);
      }}
    >
      ?
    </button>
  );
}

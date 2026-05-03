"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

const RESULT_EGOGIFT_BASE_URL = API_BASE_URL.replace("/api", "");

/** 결과 탭·관측 에고 등 키워드 아이콘 (공통) */
export const RESULT_KEYWORD_ICON_MAP: Record<string, string> = {
  화상: "/images/keyword/Burn.webp",
  출혈: "/images/keyword/Bleed.webp",
  진동: "/images/keyword/Tremor.webp",
  파열: "/images/keyword/Rupture.webp",
  침잠: "/images/keyword/Sinking.webp",
  호흡: "/images/keyword/Poise.webp",
  충전: "/images/keyword/Charge.webp",
  탄환: "/images/keyword/bullet.webp",
  참격: "/images/keyword/slash.webp",
  관통: "/images/keyword/penetration.webp",
  타격: "/images/keyword/blow.webp",
};

export type ResultEgoGiftItem = {
  egogiftId: number;
  giftName: string;
  keywordName?: string;
  keywordId?: number;
  thumbnail?: string;
  giftTier?: string;
  grades?: string[];
  synthesisYn?: string;
  /** 우선순위 Y → 보고서에서 이름 아래 "스택보조" 표시 */
  priorityYn?: string;
  limitedCategoryNames?: string[];
};

export type SynthesisRecipeItem = {
  resultEgogiftId: number;
  resultGiftName: string;
  resultThumbnail?: string;
  resultGrades?: string[];
  materials: { egogiftId: number; giftName: string; thumbnail?: string; grades?: string[] }[];
};

function isPriorityStackAssist(priorityYn: string | undefined): boolean {
  return String(priorityYn ?? "").trim().toUpperCase() === "Y";
}

function tierDisplay(tier: string | undefined): string {
  if (tier == null || tier === "") return "－";
  const t = String(tier).trim().toUpperCase();
  if (t === "0") return "－";
  if (t === "EX") return "EX";
  if (t === "1") return "Ⅰ";
  if (t === "2") return "Ⅱ";
  if (t === "3") return "Ⅲ";
  if (t === "4") return "Ⅳ";
  if (t === "5") return "Ⅴ";
  return "－";
}

/** 획득 체크: 짙은 녹색 외곽 + 밝은 초록 내부 */
function EgoGiftAcquireCheckSvg({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <polyline
        points="20 6 9 17 4 12"
        stroke="#14532d"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="20 6 9 17 4 12"
        stroke="#4ade80"
        strokeWidth={3.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 재료·결과 중 하나라도 목록에 있으면 해당 조합식 포함 */
export function filterSynthesisRecipesForEgoIds(
  recipes: SynthesisRecipeItem[],
  egoIds: readonly number[],
): SynthesisRecipeItem[] {
  const idSet = new Set(egoIds);
  return recipes.filter(
    (r) => idSet.has(r.resultEgogiftId) || r.materials.some((m) => idSet.has(m.egogiftId)),
  );
}

export type SynthesisRecipesSubsetBlockProps = {
  /** 접기·캡처 키 (키워드명 또는 층별 전용 키) */
  sectionKey: string;
  relevantEgoIds: readonly number[];
  synthesisRecipes: SynthesisRecipeItem[];
  resultEgoGifts: ResultEgoGiftItem[];
  resultSimplified: boolean;
  synthesisExpandedByKeyword: Record<string, boolean>;
  setSynthesisExpandedByKeyword: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onCaptureSection: (keyword: string, isSynthesis: boolean) => void;
  synthesisRef?: (el: HTMLDivElement | null) => void;
  /** 조합식 카드·이름 클릭 시 에고기프트 상세 모달 */
  egoGiftPreviewOpenRef: React.MutableRefObject<((giftName: string) => void) | null>;
  /** false면 상단 캡처/접기 줄(합성 조합식) 숨김 — 부모가 "조합식" 제목을 둘 때 */
  showHeaderRow?: boolean;
  /** floor: 상단 여백·구분선 없음(층별 블록 안에서 부모가 구역 제목 제공) */
  layout?: "section" | "floor";
};

/** 키워드 섹션·층별 한정 등 공통: 조합식 목록만 */
export function SynthesisRecipesSubsetBlock({
  sectionKey,
  relevantEgoIds,
  synthesisRecipes,
  resultEgoGifts,
  resultSimplified,
  synthesisExpandedByKeyword,
  setSynthesisExpandedByKeyword,
  onCaptureSection,
  synthesisRef,
  egoGiftPreviewOpenRef,
  showHeaderRow = true,
  layout = "section",
}: SynthesisRecipesSubsetBlockProps) {
  const openEgoGiftPreviewByName = (giftName: string) => {
    const n = String(giftName ?? "").trim();
    if (!n) return;
    egoGiftPreviewOpenRef.current?.(n);
  };
  const recipesInSection = useMemo(
    () => filterSynthesisRecipesForEgoIds(synthesisRecipes, relevantEgoIds),
    [synthesisRecipes, relevantEgoIds],
  );

  if (recipesInSection.length === 0) return null;

  const rootClass =
    layout === "floor"
      ? "result-synthesis-block"
      : "result-synthesis-block mt-3 border-t border-[#b8860b]/30 pt-3";

  const getDifficultyTextClass = (grades: string[] | undefined) => {
    const list = grades ?? [];
    if (list.includes("E")) return "text-red-400";
    if (list.includes("H")) return "text-[#e8a0a0]";
    return "text-gray-300";
  };
  const getMiniCardBorderClass = (grades: string[] | undefined) => {
    const list = grades ?? [];
    if (list.includes("E")) return "border-2 border-red-400 shadow-[0_0_14px_rgba(248,113,113,0.5)]";
    if (list.includes("H")) return "border-2 border-[#e8a0a0]";
    return "border border-amber-400/40";
  };
  const getGradesFromResult = (egogiftId: number) => resultEgoGifts.find((eg) => eg.egogiftId === egogiftId)?.grades ?? [];
  /** 조합식 행마다 +·= 이 같은 가로 폭; px·mono로 글리프 좌우 여백 체감을 맞춤 */
  const synthesisOpClassSimplified =
    "inline-flex w-6 min-w-6 shrink-0 items-center justify-center px-0.5 align-middle font-mono text-xs font-bold tabular-nums text-amber-400/80 lg:w-9 lg:min-w-9 lg:px-1.5 lg:text-base";
  const synthesisOpClassCard =
    "mt-3 inline-flex w-5 min-w-5 shrink-0 items-center justify-center self-start px-0.5 font-mono text-sm font-bold tabular-nums leading-none text-amber-400/80 select-none lg:mt-8 lg:w-9 lg:min-w-9 lg:px-1.5 lg:text-xl";
  const EgogiftMiniCard = ({
    thumbnail,
    giftName,
    baseUrl,
    grades,
  }: {
    thumbnail?: string;
    giftName: string;
    baseUrl: string;
    grades?: string[];
  }) => (
    <button
      type="button"
      title="에고기프트 상세 보기"
      aria-label={`${giftName} 상세 보기`}
      onClick={() => openEgoGiftPreviewByName(giftName)}
      className={`flex min-w-0 shrink-0 flex-col items-center overflow-hidden rounded bg-[#131316] p-1 text-left transition-colors hover:bg-[#1a1a1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] w-[2.65rem] max-w-[2.65rem] lg:w-[5.25rem] lg:max-w-[5.25rem] lg:p-2 ${getMiniCardBorderClass(grades)}`}
    >
      <div className="relative aspect-square w-full max-w-full shrink-0">
        <img src="/images/egogift/egogift_frame.webp" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0" />
        {thumbnail ? (
          <img
            src={baseUrl + thumbnail}
            alt=""
            className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10 pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded pointer-events-none">
            <span className="text-gray-500 text-xs">?</span>
          </div>
        )}
      </div>
      <div
        className="mt-0.5 w-full max-w-full px-0 text-center text-[7px] font-medium leading-tight text-gray-300 break-words [overflow-wrap:anywhere] line-clamp-2 lg:mt-1 lg:px-0.5 lg:text-[11px] lg:leading-snug lg:line-clamp-3"
      >
        {giftName}
      </div>
    </button>
  );

  return (
    <div className={`${rootClass} min-w-0 max-w-full`} ref={synthesisRef}>
      {showHeaderRow && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => onCaptureSection(sectionKey, true)}
            className="text-xs font-semibold text-purple-300 text-left cursor-pointer hover:text-purple-200 hover:underline focus:outline-none focus:underline"
            title="클릭 시 합성 조합식 영역만 이미지로 저장"
          >
            합성 조합식
          </button>
          <button
            type="button"
            onClick={() =>
              setSynthesisExpandedByKeyword((prev) => ({ ...prev, [sectionKey]: prev[sectionKey] === false }))
            }
            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-300 hover:bg-white/10 focus:outline-none transition-colors"
            title={synthesisExpandedByKeyword[sectionKey] === false ? "펼치기" : "접기"}
            aria-label={synthesisExpandedByKeyword[sectionKey] === false ? "펼치기" : "접기"}
          >
            {synthesisExpandedByKeyword[sectionKey] === false ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      )}
      {!showHeaderRow && (
        <div className="mb-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onCaptureSection(sectionKey, true)}
            className="shrink-0 text-[10px] font-semibold text-purple-300/90 hover:text-purple-200 hover:underline focus:outline-none"
            title="이 조합식 영역만 이미지로 저장"
          >
            영역 저장
          </button>
          <button
            type="button"
            onClick={() =>
              setSynthesisExpandedByKeyword((prev) => ({ ...prev, [sectionKey]: prev[sectionKey] === false }))
            }
            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-300 focus:outline-none"
            title={synthesisExpandedByKeyword[sectionKey] === false ? "펼치기" : "접기"}
            aria-label={synthesisExpandedByKeyword[sectionKey] === false ? "펼치기" : "접기"}
          >
            {synthesisExpandedByKeyword[sectionKey] === false ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      )}
      {synthesisExpandedByKeyword[sectionKey] !== false && (
        <ul className={`min-w-0 w-full max-w-full ${resultSimplified ? "space-y-1" : "space-y-3"}`}>
          {recipesInSection.map((recipe, recipeIdx) => (
            <li
              key={`${recipe.resultEgogiftId}-${recipeIdx}`}
              className={
                resultSimplified
                  ? "min-w-0 max-w-full overflow-hidden rounded border border-[#b8860b]/20 bg-[#1a1a1a]/60 px-2 py-1 text-xs text-gray-300 break-words [overflow-wrap:anywhere]"
                  : "flex min-w-0 max-w-full flex-nowrap items-start justify-start gap-x-1 gap-y-2 overflow-x-auto text-xs lg:flex-wrap lg:gap-x-2 lg:gap-y-2 lg:overflow-visible"
              }
            >
              {resultSimplified ? (
                <>
                  {recipe.materials.map((mat, i) => (
                    <span key={`${recipe.resultEgogiftId}-mat-${i}`} className="inline min-w-0 max-w-full">
                      {i > 0 && (
                        <span className={synthesisOpClassSimplified} aria-hidden>
                          +
                        </span>
                      )}
                      <button
                        type="button"
                        title="에고기프트 상세 보기"
                        aria-label={`${mat.giftName} 상세 보기`}
                        onClick={() => openEgoGiftPreviewByName(mat.giftName)}
                        className={`result-egogift-name inline min-w-0 break-words [overflow-wrap:anywhere] cursor-pointer rounded px-0.5 align-baseline hover:underline hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50 ${getDifficultyTextClass(mat.grades ?? getGradesFromResult(mat.egogiftId))}`}
                      >
                        {mat.giftName}
                      </button>
                    </span>
                  ))}
                  <span className={synthesisOpClassSimplified} aria-hidden>
                    =
                  </span>
                  <button
                    type="button"
                    title="에고기프트 상세 보기"
                    aria-label={`${recipe.resultGiftName} 상세 보기`}
                    onClick={() => openEgoGiftPreviewByName(recipe.resultGiftName)}
                    className={`result-egogift-name inline min-w-0 break-words [overflow-wrap:anywhere] font-medium cursor-pointer rounded px-0.5 align-baseline hover:underline hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50 ${getDifficultyTextClass(recipe.resultGrades ?? getGradesFromResult(recipe.resultEgogiftId))}`}
                  >
                    {recipe.resultGiftName}
                  </button>
                </>
              ) : (
                <>
                  {recipe.materials.map((mat, i) => (
                    <span
                      key={`${recipe.resultEgogiftId}-mat-${i}`}
                      className="inline-flex min-w-0 max-w-full shrink-0 items-start gap-x-1 lg:gap-x-2"
                    >
                      {i > 0 && (
                        <span className={synthesisOpClassCard} aria-hidden>
                          +
                        </span>
                      )}
                      <EgogiftMiniCard
                        thumbnail={mat.thumbnail}
                        giftName={mat.giftName}
                        baseUrl={RESULT_EGOGIFT_BASE_URL}
                        grades={mat.grades ?? getGradesFromResult(mat.egogiftId)}
                      />
                    </span>
                  ))}
                  <span className={synthesisOpClassCard} aria-hidden>
                    =
                  </span>
                  <EgogiftMiniCard
                    thumbnail={recipe.resultThumbnail}
                    giftName={recipe.resultGiftName}
                    baseUrl={RESULT_EGOGIFT_BASE_URL}
                    grades={recipe.resultGrades ?? getGradesFromResult(recipe.resultEgogiftId)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  keyword: string;
  egogifts: ResultEgoGiftItem[];
  keywordIndex: number;
  resultSimplified: boolean;
  /** 에고기프트 그리드 접기/펼치기 (없으면 펼침) */
  keywordGiftExpandedByKeyword: Record<string, boolean>;
  setKeywordGiftExpandedByKeyword: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** 합성 조합식 접기/펼치기 (없으면 펼침) */
  synthesisExpandedByKeyword: Record<string, boolean>;
  setSynthesisExpandedByKeyword: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  synthesisRecipes: SynthesisRecipeItem[];
  resultEgoGifts: ResultEgoGiftItem[];
  /** 결과 탭 에고기프트 체크한 ID 목록 (카드팩과 동일한 체크박스 UI) */
  checkedEgoGiftIds: number[];
  onToggleEgoGiftCheck: (egogiftId: number) => void;
  /** 보고서 즐겨찾기에서 에고기프트 제거 (일반 카드만 하단 호버 영역) */
  onRemoveStarredEgoGift: (egogiftId: number) => void;
  sectionRef: (el: HTMLDivElement | null) => void;
  synthesisRef: (el: HTMLDivElement | null) => void;
  onCaptureSection: (keyword: string, isSynthesis: boolean) => void;
  egoGiftPreviewOpenRef: React.MutableRefObject<((giftName: string) => void) | null>;
  /** keyword: 키워드 헤더+접기 / flat: 모아보기(헤더 없음, 한 그리드) */
  variant?: "keyword" | "flat";
  /** true면 합성 조합식 블록 생략(층별 한정 행 등에서 그리드만 사용) */
  omitSynthesis?: boolean;
  /** true면 부모 flex 열 높이에 맞춰 그리드 영역을 늘림(층별 보기 한 줄) */
  fillParentHeight?: boolean;
  /** true면 획득/삭제/hover 동작 제거하고 카드 클릭은 정보보기만 수행 */
  readOnly?: boolean;
};

export function ResultKeywordSection({
  keyword,
  egogifts,
  keywordIndex,
  resultSimplified,
  keywordGiftExpandedByKeyword,
  setKeywordGiftExpandedByKeyword,
  synthesisExpandedByKeyword,
  setSynthesisExpandedByKeyword,
  synthesisRecipes,
  resultEgoGifts,
  checkedEgoGiftIds,
  onToggleEgoGiftCheck,
  onRemoveStarredEgoGift,
  sectionRef,
  synthesisRef,
  onCaptureSection,
  egoGiftPreviewOpenRef,
  variant = "keyword",
  omitSynthesis = false,
  fillParentHeight = false,
  readOnly = false,
}: Props) {
  const isGiftGridExpanded =
    variant === "flat" ? true : keywordGiftExpandedByKeyword[keyword] !== false;

  /** 정보 보기 / 삭제 영역 클릭 시 짧은 하이라이트 */
  const [zoneClickFlash, setZoneClickFlash] = useState<{ id: number; zone: "info" | "delete" } | null>(null);
  const zoneFlashClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerZoneClickFlash = (egogiftId: number, zone: "info" | "delete") => {
    if (zoneFlashClearRef.current) clearTimeout(zoneFlashClearRef.current);
    setZoneClickFlash({ id: egogiftId, zone });
    zoneFlashClearRef.current = setTimeout(() => {
      setZoneClickFlash(null);
      zoneFlashClearRef.current = null;
    }, 520);
  };
  useEffect(() => {
    return () => {
      if (zoneFlashClearRef.current) clearTimeout(zoneFlashClearRef.current);
    };
  }, []);

  const zoneFlashBaseTransition =
    "transition-[box-shadow,transform,background-color,outline-color] duration-200 ease-out";

  const rootClass =
    [keywordIndex > 0 && variant === "keyword" ? "mt-8" : "", fillParentHeight ? "h-full min-h-0 flex flex-col" : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  const sectionInnerClass = fillParentHeight ? "flex min-h-0 flex-1 flex-col" : undefined;
  const gridExtraClass = fillParentHeight ? " min-h-0 flex-1 content-start" : "";

  return (
    <div className={rootClass}>
      <div ref={sectionRef} className={sectionInnerClass}>
        {variant === "keyword" && (
        <>
        {/* 헤더: 키워드명(캡처 버튼) + 에고기프트 그리드 접기 토글(우측 끝) */}
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => onCaptureSection(keyword, false)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-0 py-0 text-left text-lg font-semibold text-yellow-300 hover:text-yellow-100 hover:underline focus:outline-none focus:underline"
            title="클릭 시 이 키워드 에고기프트만 이미지로 저장 (조합식 제외)"
          >
            {RESULT_KEYWORD_ICON_MAP[keyword] && (
              <img src={RESULT_KEYWORD_ICON_MAP[keyword]} alt="" className="w-5 h-5 shrink-0 object-contain" />
            )}
            {keyword}
          </button>
          <button
            type="button"
            onClick={() => setKeywordGiftExpandedByKeyword((prev) => ({ ...prev, [keyword]: prev[keyword] === false }))}
            className="shrink-0 p-1 rounded text-yellow-200/80 hover:text-yellow-100 hover:bg-white/10 transition-colors"
            title={isGiftGridExpanded ? "이 키워드 에고기프트 접기" : "이 키워드 에고기프트 펼치기"}
            aria-label={isGiftGridExpanded ? "접기" : "펼치기"}
          >
            <span className={`inline-block transition-transform duration-200 ${isGiftGridExpanded ? "rotate-90" : ""}`}>▶</span>
          </button>
        </div>
        </>
        )}

        {/* 에고기프트 그리드 (접기 시 숨김, 합성 조합식과 별도) */}
        {isGiftGridExpanded && (
          <div
            className={
              (resultSimplified
                ? /** lg 미만: 시작·관측 에고와 동일 3열·간격 */
                  "grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:grid-cols-5 xl:grid-cols-6"
                : "grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6") + gridExtraClass
            }
          >
            {egogifts.map((eg) => {
              if (resultSimplified) {
                const gradesList = eg.grades ?? [];
                const hasExtreme = gradesList.includes("E");
                const hasHard = gradesList.includes("H");
                const difficultyClass = hasExtreme ? "result-egogift-card--extreme" : hasHard ? "result-egogift-card--hard" : "result-egogift-card--normal";
                const checked = checkedEgoGiftIds.includes(eg.egogiftId);
                const infoFlashing = zoneClickFlash?.id === eg.egogiftId && zoneClickFlash.zone === "info";
                return (
                  <div
                    key={eg.egogiftId}
                    role={readOnly ? "button" : "checkbox"}
                    aria-checked={readOnly ? undefined : checked}
                    tabIndex={0}
                    onClick={(e) => {
                      if (readOnly) {
                        egoGiftPreviewOpenRef.current?.(eg.giftName);
                      } else {
                        onToggleEgoGiftCheck(eg.egogiftId);
                        /* 마우스 클릭만: 카드가 포커스를 받으면 group-focus-within 등으로 호버 UI가 고정되는 브라우저 동작 방지 */
                        if (e.detail > 0) {
                          (e.currentTarget as HTMLElement).blur();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        if (readOnly) {
                          egoGiftPreviewOpenRef.current?.(eg.giftName);
                        } else {
                          onToggleEgoGiftCheck(eg.egogiftId);
                        }
                      }
                    }}
                    className={`group relative min-w-0 cursor-pointer rounded-lg p-2 text-left shadow-sm outline-none transition-[box-shadow,filter] sm:p-3 flex flex-col gap-1 focus-visible:ring-2 focus-visible:ring-yellow-400/60 ${!readOnly && checked ? "result-egogift-card--checked brightness-[0.82]" : "hover:ring-1 hover:ring-yellow-400/40"} ${difficultyClass}`}
                  >
                    {!readOnly && checked && (
                      <div
                        className="result-egogift-checked-overlay pointer-events-none absolute inset-0 z-[1] rounded-lg bg-black/50"
                        aria-hidden
                      />
                    )}
                    <div className="relative z-0 flex min-w-0 flex-col gap-1 pr-[22%]">
                      <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
                        <span className="result-egogift-tier shrink-0 text-xs font-bold text-amber-400/90 sm:text-sm">
                          {tierDisplay(eg.giftTier)}
                        </span>
                        <span className="result-egogift-name min-w-0 break-words text-xs font-medium leading-tight text-gray-200 sm:text-sm">
                          {eg.giftName}
                        </span>
                      </div>
                      {isPriorityStackAssist(eg.priorityYn) && (
                        <div className="text-[10px] font-medium text-green-400 sm:text-xs">스택보조</div>
                      )}
                      {eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0 && (
                        <div className="break-words text-[10px] leading-tight text-gray-400 sm:text-xs">
                          {eg.limitedCategoryNames.map((n) => `"${n}"`).join(", ")}
                        </div>
                      )}
                      {eg.synthesisYn === "Y" && (
                        <div className="text-[10px] text-purple-300 sm:text-xs">합성전용</div>
                      )}
                    </div>
                    {/* 우측 정보 보기 제외 본문: 호버 시 획득 / 획득 해제 */}
                    {!readOnly && (
                      <>
                        <div
                          className="result-egogift-acquire-zone pointer-events-none absolute left-0 top-0 right-[20%] bottom-0 z-[22] rounded-md bg-transparent transition-colors duration-200 group-hover:pointer-events-auto group-hover:bg-black/20 group/acquire hover:!bg-amber-500/35"
                          aria-hidden
                        >
                          {checked && (
                            <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
                              <EgoGiftAcquireCheckSvg className="h-9 w-9 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] transition-opacity duration-200 group-hover:opacity-0 sm:h-11 sm:w-11" />
                            </div>
                          )}
                          <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                            <span className="px-1 text-center text-xs font-bold leading-tight text-transparent opacity-0 transition-[opacity,color] duration-200 group-hover:opacity-100 group-hover:text-gray-200 group-hover/acquire:!text-amber-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] sm:text-sm">
                              {checked ? "획득 해제" : "획득"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-result-egogift-info
                          title="에고기프트 상세 보기"
                          aria-label={`${eg.giftName} 정보 보기`}
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerZoneClickFlash(eg.egogiftId, "info");
                            egoGiftPreviewOpenRef.current?.(eg.giftName);
                          }}
                          className={`absolute top-0 right-0 bottom-0 z-[24] flex w-[20%] min-w-[2rem] items-center justify-center border-l border-transparent bg-transparent text-[10px] font-semibold leading-tight text-transparent shadow-none transition-[background-color,color,box-shadow,transform,border-color] pointer-events-none group-hover:pointer-events-auto group-hover:border-[#b8860b]/25 group-hover:bg-black/30 group-hover:text-gray-200 [writing-mode:vertical-rl] hover:!border-amber-800/35 hover:!bg-amber-500/35 hover:!text-amber-100 focus:outline-none focus-visible:pointer-events-auto focus-visible:border-amber-800/40 focus-visible:bg-amber-500/40 focus-visible:text-amber-100 focus-visible:ring-2 focus-visible:ring-amber-800/60 focus-visible:ring-inset ${zoneFlashBaseTransition} ${
                            infoFlashing
                              ? "z-[28] !opacity-100 border-amber-800/50 !text-amber-100 bg-amber-500/40 outline outline-2 outline-amber-800/50 outline-offset-0 shadow-[0_0_0_3px_rgba(180,83,9,0.35),0_0_22px_rgba(251,191,36,0.5)] scale-[1.03]"
                              : ""
                          }`}
                        >
                          정보 보기
                        </button>
                      </>
                    )}
                  </div>
                );
              }
              const keywordIcon = eg.keywordName ? RESULT_KEYWORD_ICON_MAP[eg.keywordName] : null;
              const gradesList = eg.grades ?? [];
              const hasExtreme = gradesList.includes("E");
              const hasHard = gradesList.includes("H");
              const difficultyClass = hasExtreme ? "result-egogift-card--extreme" : hasHard ? "result-egogift-card--hard" : "result-egogift-card--normal";
              const checked = checkedEgoGiftIds.includes(eg.egogiftId);
              const infoFlashing = zoneClickFlash?.id === eg.egogiftId && zoneClickFlash.zone === "info";
              const deleteFlashing = zoneClickFlash?.id === eg.egogiftId && zoneClickFlash.zone === "delete";
              return (
                <div
                  key={eg.egogiftId}
                  role={readOnly ? "button" : "checkbox"}
                  aria-checked={readOnly ? undefined : checked}
                  tabIndex={0}
                  onClick={(e) => {
                    if (readOnly) {
                      egoGiftPreviewOpenRef.current?.(eg.giftName);
                    } else {
                      onToggleEgoGiftCheck(eg.egogiftId);
                      if (e.detail > 0) {
                        (e.currentTarget as HTMLElement).blur();
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      if (readOnly) {
                        egoGiftPreviewOpenRef.current?.(eg.giftName);
                      } else {
                        onToggleEgoGiftCheck(eg.egogiftId);
                      }
                    }
                  }}
                  className={`group relative flex min-h-0 min-w-0 cursor-pointer flex-col rounded p-1.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-yellow-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] sm:p-2 md:p-3 ${!readOnly && checked ? "result-egogift-card--checked brightness-[0.82]" : "hover:ring-1 hover:ring-yellow-400/40"} ${difficultyClass}`}
                >
                  {!readOnly && checked && (
                    <div
                      className="result-egogift-checked-overlay pointer-events-none absolute inset-0 z-[8] rounded-[inherit] bg-black/50"
                      aria-hidden
                    />
                  )}
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        data-result-egogift-info
                        title="에고기프트 상세 보기"
                        aria-label={`${eg.giftName} 정보 보기`}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerZoneClickFlash(eg.egogiftId, "info");
                          egoGiftPreviewOpenRef.current?.(eg.giftName);
                        }}
                        className={`absolute top-0 left-0 right-0 z-[25] flex h-[20%] min-h-[2.25rem] items-center justify-center border-b border-transparent bg-transparent text-xs font-semibold text-transparent shadow-none transition-[background-color,color,box-shadow,transform,border-color] pointer-events-none group-hover:pointer-events-auto group-hover:border-[#b8860b]/25 group-hover:bg-black/30 group-hover:text-gray-200 hover:!border-amber-800/35 hover:!bg-amber-500/35 hover:!text-amber-100 focus:outline-none focus-visible:pointer-events-auto focus-visible:border-amber-800/40 focus-visible:bg-amber-500/40 focus-visible:text-amber-100 focus-visible:ring-2 focus-visible:ring-amber-800/60 focus-visible:ring-inset ${zoneFlashBaseTransition} ${
                          infoFlashing
                            ? "z-[32] !opacity-100 border-amber-800/50 !text-amber-100 bg-amber-500/40 outline outline-2 outline-amber-800/50 outline-offset-0 shadow-[0_0_0_3px_rgba(180,83,9,0.35),0_0_24px_rgba(251,191,36,0.5)] scale-[1.02]"
                            : ""
                        }`}
                      >
                        정보 보기
                      </button>
                      {/* 상단 정보 보기 ↔ 하단 삭제 사이 */}
                      <div
                        className="result-egogift-acquire-zone pointer-events-none absolute left-0 right-0 top-[20%] bottom-[20%] z-[22] rounded-sm bg-transparent transition-colors duration-200 group-hover:pointer-events-auto group-hover:bg-black/20 group/acquire hover:!bg-amber-500/35"
                        aria-hidden
                      >
                        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                          <span className="px-2 text-center text-sm font-bold text-transparent opacity-0 transition-[opacity,color] duration-200 group-hover:opacity-100 group-hover:text-gray-200 group-hover/acquire:!text-amber-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                            {checked ? "획득 해제" : "획득"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  <div
                    className={`relative mb-2 aspect-square flex-shrink-0 ${checked ? "z-[15]" : ""}`}
                  >
                    {checked && (
                      <div
                        className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center bg-black/15"
                        aria-hidden
                      >
                        <EgoGiftAcquireCheckSvg className="h-14 w-14 shrink-0 drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)] transition-opacity duration-200 group-hover:opacity-0 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]" />
                      </div>
                    )}
                    <img
                      src="/images/egogift/egogift_frame.webp"
                      alt="frame"
                      className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-contain"
                    />
                    <div className="result-egogift-tier absolute top-0.5 -left-1.5 z-20 scale-x-[0.65] select-none font-black leading-none tracking-tight text-amber-100/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] text-2xl sm:top-1 sm:-left-2 sm:text-3xl md:-left-3 md:text-4xl lg:text-5xl">
                      {tierDisplay(eg.giftTier)}
                    </div>
                    {keywordIcon && eg.keywordName && (
                      <div className="absolute bottom-0.5 right-0 z-20 h-6 w-6 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] sm:bottom-[5px] sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-9 lg:w-9">
                        <img src={keywordIcon} alt={eg.keywordName} className="h-full w-full object-contain" />
                      </div>
                    )}
                    {eg.thumbnail ? (
                      <img
                        src={RESULT_EGOGIFT_BASE_URL + eg.thumbnail}
                        alt={eg.giftName}
                        className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded">
                        <span className="text-gray-500 text-xs">이미지 없음</span>
                      </div>
                    )}
                  </div>
                  <div className="result-egogift-card-text flex-1 text-center text-[10px] font-medium leading-snug text-gray-300 sm:text-xs md:text-sm lg:text-base">
                    <div className="result-egogift-name break-words leading-tight">{eg.giftName}</div>
                    {isPriorityStackAssist(eg.priorityYn) && (
                      <div className="result-egogift-label break-words text-[9px] font-medium text-green-400 sm:text-[10px] md:text-xs">
                        스택보조
                      </div>
                    )}
                    {eg.synthesisYn === "Y" && (
                      <div className="result-egogift-label break-words text-[9px] text-purple-300 sm:text-[10px] md:text-xs">합성전용</div>
                    )}
                    {eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0 && (
                      <div className="result-egogift-label break-words text-[9px] leading-tight text-yellow-200/90 sm:text-[10px] md:text-xs">
                        {eg.limitedCategoryNames.map((n) => `"${n}"`).join(", ")} 카드팩 한정
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      data-result-egogift-delete
                      title="보고서 즐겨찾기에서 제거"
                      aria-label={`${eg.giftName} 보고서에서 삭제`}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerZoneClickFlash(eg.egogiftId, "delete");
                        onRemoveStarredEgoGift(eg.egogiftId);
                      }}
                      className={`absolute bottom-0 left-0 right-0 z-[25] flex h-[20%] min-h-[2.25rem] items-center justify-center border-t border-transparent bg-transparent text-xs font-semibold text-transparent shadow-none transition-[background-color,color,box-shadow,transform,border-color] pointer-events-none group-hover:pointer-events-auto group-hover:border-[#b8860b]/25 group-hover:bg-black/30 group-hover:text-gray-200 hover:!border-red-400/50 hover:!bg-red-500/35 hover:!text-red-100 focus:outline-none focus-visible:pointer-events-auto focus-visible:border-red-400/55 focus-visible:bg-red-500/35 focus-visible:text-red-100 focus-visible:ring-2 focus-visible:ring-red-400/90 focus-visible:ring-inset exclude-from-capture ${zoneFlashBaseTransition} ${
                        deleteFlashing
                          ? "z-[32] !opacity-100 !text-red-100 outline outline-2 outline-red-300 outline-offset-0 border-red-400/50 bg-red-600/45 shadow-[0_0_0_3px_rgba(248,113,113,0.55),0_0_26px_rgba(239,68,68,0.55)] scale-[1.02]"
                          : ""
                      }`}
                    >
                      삭제
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!omitSynthesis && (
          <SynthesisRecipesSubsetBlock
            sectionKey={keyword}
            relevantEgoIds={egogifts.map((eg) => eg.egogiftId)}
            synthesisRecipes={synthesisRecipes}
            resultEgoGifts={resultEgoGifts}
            resultSimplified={resultSimplified}
            synthesisExpandedByKeyword={synthesisExpandedByKeyword}
            setSynthesisExpandedByKeyword={setSynthesisExpandedByKeyword}
            onCaptureSection={onCaptureSection}
            synthesisRef={synthesisRef}
            egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
            showHeaderRow
          />
        )}
      </div>
    </div>
  );
}

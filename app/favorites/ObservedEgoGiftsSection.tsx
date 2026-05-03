"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEgoGiftTierDisplay } from "@/lib/egoGiftTierDisplay";
import { RESULT_KEYWORD_ICON_MAP } from "@/app/favorites/ResultKeywordSection";

export type ObservableEgoCatalogItem = {
  egogiftId: number;
  giftName: string;
  keywordName: string;
  giftTier?: string;
  /** 출현난이도 N/H/E — 카드 배경(노말·하드·익스트림) */
  grades?: string[];
  /** 합성전용(Y) = 조합식 결과 에고기프트 */
  synthesisYn?: string;
  thumbnail?: string;
  /** 한정 카테고리에 매핑된 카드팩 제목 등 — 비어 있으면 한정 카드팩 출현 아님 */
  limitedCategoryNames?: string[];
};

/** 관측 후보: Ⅳ(4)·EX 등급·합성/조합 산출물 제외 (synthesisYn·조합식 결과 ID 모두 반영) */
export function isObservableEgoGiftCandidate(
  giftTier: string | undefined | null,
  synthesisYn?: string | null,
  egogiftId?: number,
  recipeResultEgogiftIds?: ReadonlySet<number> | null,
): boolean {
  const t = String(giftTier ?? "").trim();
  if (t === "4") return false;
  if (t.toUpperCase() === "EX") return false;
  const s = String(synthesisYn ?? "").trim().toUpperCase();
  if (s === "Y") return false;
  if (
    egogiftId != null &&
    egogiftId > 0 &&
    recipeResultEgogiftIds &&
    recipeResultEgogiftIds.has(egogiftId)
  ) {
    return false;
  }
  return true;
}

type Props = {
  catalog: ObservableEgoCatalogItem[];
  catalogLoading: boolean;
  selectedIds: number[];
  onChange: (nextIds: number[]) => void;
  imageBaseUrl: string;
  onOpenEgoGiftByName: (giftName: string) => void;
  readOnly?: boolean;
  sectionTitle?: string;
  addLabel?: string;
  maxCount?: number;
  searchInputId?: string;
  fixedKeywordOptions?: string[];
  hideAllKeywordOption?: boolean;
  allowedIdsByKeyword?: Partial<Record<string, number[]>>;
  hideSearchInput?: boolean;
  /**
   * 결과 탭 에고기프트 「간소화」와 동일한 의미:
   * - true: 이름·키워드·합성 여부 등 텍스트 위주 카드, 조밀 그리드 (프레임 이미지 없음)
   * - false: 프레임·썸네일·키워드 아이콘·상세 텍스트 블록 (결과 탭 상세 보기와 동일 구조)
   */
  compact?: boolean;
  className?: string;
};

/** 관측 키워드 필터 버튼 순서 (그 외 키워드는 뒤에 가나다순) */
const OBSERVED_KEYWORD_BUTTON_ORDER: readonly string[] = [
  "화상",
  "출혈",
  "진동",
  "파열",
  "침잠",
  "호흡",
  "충전",
  "참격",
  "관통",
  "타격",
  "범영",
];

function observedKeywordButtonSortKey(name: string): number {
  const i = OBSERVED_KEYWORD_BUTTON_ORDER.indexOf(name);
  if (i >= 0) return i;
  return 1000;
}

/** 등급 높은 순 정렬용 (EX → 5 → … → 1, 미상은 맨 뒤). 목록 API ORDER BY 와 동일한 역순 느낌 */
function observableTierSortRank(tier: string | undefined): number {
  const t = String(tier ?? "").trim().toUpperCase();
  if (t === "EX") return 999;
  const n = Number(t);
  if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
  return 0;
}

function compareObservableByTierDescThenName(a: ObservableEgoCatalogItem, b: ObservableEgoCatalogItem): number {
  const dr = observableTierSortRank(b.giftTier) - observableTierSortRank(a.giftTier);
  if (dr !== 0) return dr;
  return a.giftName.localeCompare(b.giftName, "ko");
}

function resultCardDifficultyClass(grades: string[] | undefined): string {
  const list = grades ?? [];
  if (list.includes("E")) return "result-egogift-card--extreme";
  if (list.includes("H")) return "result-egogift-card--hard";
  return "result-egogift-card--normal";
}

function isSynthesisOnlyFlag(synthesisYn: string | undefined): boolean {
  return String(synthesisYn ?? "").trim().toUpperCase() === "Y";
}

/** 결과 탭과 동일: 한정 카드팩 카테고리가 있을 때만 「카드팩 한정」 정보 표시 */
function limitedCategoryDisplayNames(names: string[] | undefined): string[] {
  if (!names?.length) return [];
  return names.map((n) => String(n).trim()).filter(Boolean);
}

function ObservedEgoGiftFrame({
  g,
  imageBaseUrl,
  size,
  showKeywordIcon = true,
}: {
  g: ObservableEgoCatalogItem;
  imageBaseUrl: string;
  size: "compact" | "card" | "cardCompact";
  /** 키워드 아이콘 표시 여부 */
  showKeywordIcon?: boolean;
}) {
  const kw = (g.keywordName || "").trim();
  const keywordIcon = kw ? RESULT_KEYWORD_ICON_MAP[kw] : null;
  const tierLabel = formatEgoGiftTierDisplay(g.giftTier);
  const isCard = size === "card" || size === "cardCompact";
  const isCardCompact = size === "cardCompact";
  return (
    <div className={`relative shrink-0 ${isCard ? "aspect-square w-full mb-2" : "aspect-square w-14 h-14"}`}>
      <img
        src="/images/egogift/egogift_frame.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
      />
      <div
        className={`result-egogift-tier absolute z-20 select-none font-black leading-none tracking-tight text-amber-100/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${
          isCardCompact
            ? "top-0.5 -left-2 text-2xl scale-x-[0.65] sm:text-3xl"
            : isCard
              ? "top-0.5 -left-1.5 text-2xl scale-x-[0.65] sm:top-1 sm:-left-2 sm:text-3xl md:-left-3 md:text-4xl lg:text-5xl"
              : "top-0.5 -left-1.5 text-2xl scale-x-[0.72]"
        }`}
      >
        {tierLabel}
      </div>
      {showKeywordIcon && keywordIcon && kw ? (
        <div
          className={`absolute z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] ${
            isCardCompact
              ? "bottom-0.5 right-0 h-5 w-5 sm:h-6 sm:w-6"
              : isCard
                ? "bottom-0.5 right-0 h-6 w-6 sm:bottom-[5px] sm:h-7 sm:w-7 md:h-8 md:w-8 lg:h-9 lg:w-9"
                : "bottom-0.5 right-0 h-6 w-6"
          }`}
        >
          <img src={keywordIcon} alt={kw} className="h-full w-full object-contain" />
        </div>
      ) : null}
      {g.thumbnail ? (
        <img
          src={imageBaseUrl + g.thumbnail}
          alt=""
          className="absolute inset-0 z-10 m-auto h-[70%] w-[70%] object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="absolute inset-0 z-10 m-auto flex h-[70%] w-[70%] items-center justify-center rounded bg-[#1a1a1a]">
          <span className="text-[10px] text-gray-600">?</span>
        </div>
      )}
    </div>
  );
}

export function ObservedEgoGiftsSection({
  catalog,
  catalogLoading,
  selectedIds,
  onChange,
  imageBaseUrl,
  onOpenEgoGiftByName,
  readOnly = false,
  sectionTitle = "관측 에고기프트",
  addLabel = "에고기프트 추가",
  maxCount = 3,
  searchInputId = "observed-egogift-search",
  fixedKeywordOptions,
  hideAllKeywordOption = false,
  allowedIdsByKeyword,
  hideSearchInput = false,
  /** 기본: 결과 탭과 동일하게 간소화(텍스트 카드) */
  compact = true,
  className = "",
}: Props) {
  const [pickQuery, setPickQuery] = useState("");
  /** null = 전체 키워드 */
  const [keywordFilter, setKeywordFilter] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<number, ObservableEgoCatalogItem>();
    for (const g of catalog) m.set(g.egogiftId, g);
    return m;
  }, [catalog]);

  const chosenSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const keywordOptions = useMemo(() => {
    if (Array.isArray(fixedKeywordOptions) && fixedKeywordOptions.length > 0) {
      return fixedKeywordOptions.map((k) => String(k).trim()).filter(Boolean);
    }
    const s = new Set<string>();
    for (const g of catalog) {
      const k = (g.keywordName || "").trim();
      if (k) s.add(k);
    }
    return [...s].sort((a, b) => {
      const ka = observedKeywordButtonSortKey(a);
      const kb = observedKeywordButtonSortKey(b);
      if (ka !== kb) return ka - kb;
      return a.localeCompare(b, "ko");
    });
  }, [catalog, fixedKeywordOptions]);

  useEffect(() => {
    const hasFixedOptions = Array.isArray(fixedKeywordOptions) && fixedKeywordOptions.length > 0;
    if (hasFixedOptions && hideAllKeywordOption) {
      if (keywordOptions.length === 0) {
        if (keywordFilter !== null) setKeywordFilter(null);
        return;
      }
      if (keywordFilter == null || !keywordOptions.includes(keywordFilter)) {
        setKeywordFilter(keywordOptions[0]);
      }
      return;
    }
    if (keywordFilter != null && !keywordOptions.includes(keywordFilter)) {
      setKeywordFilter(null);
    }
  }, [keywordFilter, keywordOptions, fixedKeywordOptions, hideAllKeywordOption]);

  const sortedSelectedIds = useMemo(() => {
    return [...selectedIds].sort((a, b) => {
      const ga = byId.get(a);
      const gb = byId.get(b);
      return compareObservableByTierDescThenName(
        ga ?? { egogiftId: a, giftName: "", keywordName: "" },
        gb ?? { egogiftId: b, giftName: "", keywordName: "" },
      );
    });
  }, [selectedIds, byId]);

  const pickList = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    const rows = catalog
      .filter((g) => !chosenSet.has(g.egogiftId))
      .filter((g) => keywordFilter == null || (g.keywordName || "").trim() === keywordFilter)
      .filter((g) => {
        if (keywordFilter == null) return true;
        const allowed = allowedIdsByKeyword?.[keywordFilter];
        if (!allowed || allowed.length === 0) return true;
        return allowed.includes(g.egogiftId);
      })
      .filter((g) => !q || g.giftName.toLowerCase().includes(q));
    rows.sort(compareObservableByTierDescThenName);
    return rows;
  }, [catalog, chosenSet, pickQuery, keywordFilter, allowedIdsByKeyword]);

  const addId = (id: number) => {
    if (selectedIds.length >= maxCount) return;
    if (chosenSet.has(id)) return;
    onChange([...selectedIds, id]);
    setPickQuery("");
  };

  const removeId = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div
      className={`bg-[#131316] border border-[#b8860b]/40 rounded-lg ${compact ? "p-2 sm:p-2.5 mb-0" : "p-3 md:p-4 mb-4"} ${className}`.trim()}
    >
      <div className={`border-b border-[#b8860b]/40 ${compact ? "pb-2 mb-2" : "pb-2.5 mb-3"}`}>
        <h3 className="text-lg font-semibold text-yellow-300">{sectionTitle}</h3>
      </div>

      {selectedIds.length > 0 && (
        <div
          className={
            compact
              ? "mb-2 grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3"
              : "mb-3 grid grid-cols-3 gap-2 sm:gap-3 md:gap-4"
          }
        >
          {sortedSelectedIds.map((id) => {
            const g = byId.get(id);
            const row = g ?? { egogiftId: id, giftName: `ID ${id}`, keywordName: "" };
            const diffClass = resultCardDifficultyClass(g?.grades);
            const limitedNames = limitedCategoryDisplayNames(row.limitedCategoryNames);

            if (compact) {
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => (g ? onOpenEgoGiftByName(g.giftName) : undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (g) onOpenEgoGiftByName(g.giftName);
                    }
                  }}
                  className={`group relative min-w-0 cursor-pointer rounded-lg p-2 text-left shadow-sm outline-none transition-[box-shadow,filter] hover:ring-1 hover:ring-yellow-400/40 focus-visible:ring-2 focus-visible:ring-yellow-400/60 sm:p-3 ${diffClass}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeId(id);
                    }}
                    className="absolute -right-1 -top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-red-400/60 bg-[#1a0a0a] text-xs font-bold text-red-200 hover:bg-red-950/90"
                    title="등록 해제"
                    aria-label="등록 해제"
                    hidden={readOnly}
                  >
                    ×
                  </button>
                  <div className="relative z-0 flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
                      <span className="result-egogift-tier shrink-0 text-xs font-bold text-amber-400/90 sm:text-sm">
                        {formatEgoGiftTierDisplay(row.giftTier)}
                      </span>
                      <span className="result-egogift-name min-w-0 break-words text-xs font-medium leading-tight text-gray-200 sm:text-sm">
                        {row.giftName}
                      </span>
                    </div>
                    {limitedNames.length > 0 ? (
                      <div className="break-words text-[10px] leading-tight text-gray-400 sm:text-xs">
                        {limitedNames.map((n) => `"${n}"`).join(", ")}
                      </div>
                    ) : null}
                    {isSynthesisOnlyFlag(row.synthesisYn) ? (
                      <div className="text-[10px] text-purple-300 sm:text-xs">합성전용</div>
                    ) : null}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => (g ? onOpenEgoGiftByName(g.giftName) : undefined)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (g) onOpenEgoGiftByName(g.giftName);
                  }
                }}
                className={`group relative flex min-h-0 cursor-pointer flex-col rounded p-1.5 outline-none transition-all hover:ring-1 hover:ring-yellow-400/40 focus-visible:ring-2 focus-visible:ring-yellow-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] sm:p-2 md:p-3 ${diffClass}`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeId(id);
                  }}
                  className="absolute -right-1 -top-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-red-400/60 bg-[#1a0a0a] text-xs font-bold text-red-200 hover:bg-red-950/90"
                  title="등록 해제"
                  aria-label="등록 해제"
                  hidden={readOnly}
                >
                  ×
                </button>
                <ObservedEgoGiftFrame g={row} imageBaseUrl={imageBaseUrl} size="card" showKeywordIcon />
                <div className="result-egogift-card-text flex-1 text-center text-[10px] font-medium leading-snug text-gray-300 sm:text-xs md:text-sm lg:text-base">
                  <div className="result-egogift-name break-words leading-tight">{row.giftName}</div>
                  {isSynthesisOnlyFlag(row.synthesisYn) ? (
                    <div className="result-egogift-label break-words text-[9px] text-purple-300 sm:text-[10px] md:text-xs">
                      합성전용
                    </div>
                  ) : null}
                  {limitedNames.length > 0 ? (
                    <div className="result-egogift-label break-words text-[9px] leading-tight text-yellow-200/90 sm:text-[10px] md:text-xs">
                      {limitedNames.map((n) => `"${n}"`).join(", ")} 카드팩 한정
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && selectedIds.length < maxCount && (
        <div className={`rounded-lg border border-[#b8860b]/25 bg-[#0d0d0f]/60 ${compact ? "p-2" : "p-3"}`}>
          <label htmlFor={searchInputId} className={`mb-2 block font-medium text-gray-400 ${compact ? "text-[10px]" : "text-xs"}`}>
            {addLabel} ({selectedIds.length}/{maxCount})
            {!hideSearchInput && !catalogLoading && catalog.length > 0 ? (
              <span className={`mt-0.5 block font-normal text-gray-500 ${compact ? "text-[10px] leading-snug" : ""}`}>
                등급 높은 순(역순) 정렬 · 키워드는 버튼 · 제목만 검색
              </span>
            ) : null}
          </label>
          {!catalogLoading && catalog.length > 0 && (
            <div className={compact ? "mb-2" : "mb-3"} role="group" aria-label="키워드 필터">
              <p className={`font-medium uppercase tracking-wide text-gray-500 ${compact ? "mb-1 text-[9px]" : "mb-1.5 text-[10px]"}`}>키워드</p>
              <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
                {!hideAllKeywordOption && (
                  <button
                    type="button"
                    onClick={() => setKeywordFilter(null)}
                    className={`rounded border transition-colors ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} ${
                      keywordFilter === null
                        ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                        : "border-[#b8860b]/35 bg-[#131316] text-gray-400 hover:border-amber-400/40 hover:text-gray-200"
                    }`}
                  >
                    전체
                  </button>
                )}
                {keywordOptions.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() =>
                      setKeywordFilter((prev) =>
                        hideAllKeywordOption ? kw : prev === kw ? null : kw
                      )
                    }
                    className={`rounded border transition-colors ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"} ${
                      keywordFilter === kw
                        ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                        : "border-[#b8860b]/35 bg-[#131316] text-gray-400 hover:border-amber-400/40 hover:text-gray-200"
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!hideSearchInput && (
            <input
              id={searchInputId}
              type="search"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="제목(이름) 검색…"
              disabled={catalogLoading || catalog.length === 0}
              className={`mb-2 w-full rounded border border-[#b8860b]/35 bg-[#0d0d0f] text-gray-200 placeholder:text-gray-600 focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:opacity-50 ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
            />
          )}
          {catalogLoading ? (
            <p className={`text-gray-500 py-2 ${compact ? "text-xs" : "text-sm"}`}>목록 불러오는 중…</p>
          ) : catalog.length === 0 ? (
            <p className={`text-gray-500 py-2 ${compact ? "text-xs" : "text-sm"}`}>등록 가능한 에고기프트를 불러오지 못했습니다.</p>
          ) : pickList.length === 0 ? (
            <p className={`text-gray-500 py-2 ${compact ? "text-xs" : "text-sm"}`}>검색 결과가 없거나 이미 모두 등록되었습니다.</p>
          ) : (
            <ul className={`overflow-y-auto pr-1 ${compact ? "max-h-40 space-y-1 text-xs" : "max-h-72 space-y-2 text-sm"}`}>
              {pickList.map((g) => (
                <li key={g.egogiftId}>
                  <button
                    type="button"
                    onClick={() => addId(g.egogiftId)}
                    className={`flex w-full items-stretch gap-2 rounded p-2 text-left outline-none transition-all hover:ring-1 hover:ring-yellow-400/35 focus-visible:ring-2 focus-visible:ring-yellow-400/50 ${resultCardDifficultyClass(g.grades)}`}
                  >
                    <ObservedEgoGiftFrame g={g} imageBaseUrl={imageBaseUrl} size="compact" />
                    <span className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                      <span className="font-medium leading-snug text-gray-200 break-words">{g.giftName}</span>
                      {!compact && g.keywordName ? (
                        <span className="truncate text-xs text-gray-500">{g.keywordName}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

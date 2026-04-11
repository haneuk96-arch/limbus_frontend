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
};

const MAX_OBSERVED = 3;

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

function ObservedEgoGiftFrame({
  g,
  imageBaseUrl,
  size,
}: {
  g: ObservableEgoCatalogItem;
  imageBaseUrl: string;
  size: "compact" | "card";
}) {
  const kw = (g.keywordName || "").trim();
  const keywordIcon = kw ? RESULT_KEYWORD_ICON_MAP[kw] : null;
  const tierLabel = formatEgoGiftTierDisplay(g.giftTier);
  const isCard = size === "card";
  return (
    <div className={`relative shrink-0 ${isCard ? "aspect-square w-full mb-2" : "aspect-square w-14 h-14"}`}>
      <img
        src="/images/egogift/egogift_frame.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
      />
      <div
        className={`result-egogift-tier absolute z-20 select-none font-black leading-none tracking-tight text-amber-100/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${
          isCard ? "top-1 -left-3 text-5xl scale-x-[0.65]" : "top-0.5 -left-1.5 text-2xl scale-x-[0.72]"
        }`}
      >
        {tierLabel}
      </div>
      {keywordIcon && kw ? (
        <div
          className={`absolute z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)] ${
            isCard ? "bottom-[5px] right-0 h-9 w-9" : "bottom-0.5 right-0 h-6 w-6"
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
  }, [catalog]);

  useEffect(() => {
    if (keywordFilter != null && !keywordOptions.includes(keywordFilter)) {
      setKeywordFilter(null);
    }
  }, [keywordFilter, keywordOptions]);

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
      .filter((g) => !q || g.giftName.toLowerCase().includes(q));
    rows.sort(compareObservableByTierDescThenName);
    return rows;
  }, [catalog, chosenSet, pickQuery, keywordFilter]);

  const addId = (id: number) => {
    if (selectedIds.length >= MAX_OBSERVED) return;
    if (chosenSet.has(id)) return;
    onChange([...selectedIds, id]);
    setPickQuery("");
  };

  const removeId = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 mb-4">
      <div className="border-b border-[#b8860b]/40 pb-3 mb-4">
        <h3 className="text-base md:text-lg font-semibold text-yellow-200/90">관측 에고기프트</h3>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {sortedSelectedIds.map((id) => {
            const g = byId.get(id);
            const row = g ?? { egogiftId: id, giftName: `ID ${id}`, keywordName: "" };
            const diffClass = resultCardDifficultyClass(g?.grades);
            return (
              <div
                key={id}
                className={`group relative flex w-[9.5rem] flex-col rounded p-3 shadow-sm outline-none transition-all hover:ring-1 hover:ring-yellow-400/40 focus-within:ring-1 focus-within:ring-yellow-400/50 ${diffClass}`}
              >
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  className="absolute -right-1.5 -top-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-red-400/60 bg-[#1a0a0a] text-red-200 text-xs font-bold hover:bg-red-950/90"
                  title="등록 해제"
                  aria-label="등록 해제"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => (g ? onOpenEgoGiftByName(g.giftName) : undefined)}
                  className="flex min-h-0 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50 rounded"
                  disabled={!g}
                  title={g ? "상세 보기" : undefined}
                >
                  <ObservedEgoGiftFrame g={row} imageBaseUrl={imageBaseUrl} size="card" />
                  <div className="result-egogift-card-text min-h-0 flex-1 text-center text-[11px] font-medium leading-tight text-gray-300">
                    <div className="result-egogift-name line-clamp-2 break-words">{row.giftName}</div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.length < MAX_OBSERVED && (
        <div className="rounded-lg border border-[#b8860b]/25 bg-[#0d0d0f]/60 p-3">
          <label htmlFor="observed-egogift-search" className="mb-2 block text-xs font-medium text-gray-400">
            에고기프트 추가 ({selectedIds.length}/{MAX_OBSERVED})
            {!catalogLoading && catalog.length > 0 ? (
              <span className="mt-0.5 block font-normal text-gray-500">
                등급 높은 순(역순) 정렬 · 키워드는 버튼 · 제목만 검색
              </span>
            ) : null}
          </label>
          {!catalogLoading && catalog.length > 0 && (
            <div className="mb-3" role="group" aria-label="키워드 필터">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">키워드</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setKeywordFilter(null)}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    keywordFilter === null
                      ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                      : "border-[#b8860b]/35 bg-[#131316] text-gray-400 hover:border-amber-400/40 hover:text-gray-200"
                  }`}
                >
                  전체
                </button>
                {keywordOptions.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setKeywordFilter((prev) => (prev === kw ? null : kw))}
                    className={`rounded border px-2 py-1 text-xs transition-colors ${
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
          <input
            id="observed-egogift-search"
            type="search"
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
            placeholder="제목(이름) 검색…"
            disabled={catalogLoading || catalog.length === 0}
            className="mb-2 w-full rounded border border-[#b8860b]/35 bg-[#0d0d0f] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:opacity-50"
          />
          {catalogLoading ? (
            <p className="text-gray-500 text-sm py-2">목록 불러오는 중…</p>
          ) : catalog.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">등록 가능한 에고기프트를 불러오지 못했습니다.</p>
          ) : pickList.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">검색 결과가 없거나 이미 모두 등록되었습니다.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
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
                      {g.keywordName ? (
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

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
const RESULT_EGOGIFT_BASE_URL = API_BASE_URL.replace("/api", "");
import { getOrCreateUUID } from "@/lib/uuid";
import { EgoGiftPageContent } from "@/app/egogift/page";
import { CardPackPageContent } from "@/app/cardpack/page";
import { ResultKeywordSection } from "./ResultKeywordSection";

interface FavoriteItem {
  favoriteId: number;
  pageType: string;
  searchJson: string;
  createdAt: string;
  updatedAt: string;
}

type FavoritesTab = "egogift" | "cardpack" | "result";

const TAB_LIST: { key: FavoritesTab; label: string }[] = [
  { key: "result", label: "파우스트의 보고서" },
  { key: "egogift", label: "에고기프트" },
  { key: "cardpack", label: "카드팩" },
];

const RESULT_KEYWORD_ICON_MAP: Record<string, string> = {
  화상: "/images/keyword/Burn.webp",
  출혈: "/images/keyword/Bleed.webp",
  진동: "/images/keyword/Tremor.webp",
  파열: "/images/keyword/Rupture.webp",
  침잠: "/images/keyword/Sinking.webp",
  호흡: "/images/keyword/Poise.webp",
  충전: "/images/keyword/Charge.webp",
  참격: "/images/keyword/slash.webp",
  관통: "/images/keyword/penetration.webp",
  타격: "/images/keyword/blow.webp",
};

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<FavoritesTab>("result");
  const [titleInput, setTitleInput] = useState("");
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFavoriteId, setEditingFavoriteId] = useState<number | null>(null);
  const [editingTitleInput, setEditingTitleInput] = useState<string>("");
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(true);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [shareToastMessage, setShareToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 불러오기 모달 표시 여부 및 입력값 */
  const [importShareModalOpen, setImportShareModalOpen] = useState(false);
  const [importShareTokenInput, setImportShareTokenInput] = useState("");
  /** 조회 성공 시 표시할 데이터(2단계). null이면 코드 입력 단계 */
  const [importLookupResult, setImportLookupResult] = useState<{ searchJson: string; pageType: string } | null>(null);
  /** 2단계에서 저장할 보고서 명 */
  const [importSaveTitleInput, setImportSaveTitleInput] = useState("");
  /** 삭제 확인 모달: 삭제 대상 favoriteId (null이면 모달 숨김) */
  const [deleteConfirmFavoriteId, setDeleteConfirmFavoriteId] = useState<number | null>(null);
  /** 에고기프트 탭에서 별로 선택한 에고기프트 ID 목록 (저장 시 JSON에 egogiftIds로 포함) */
  const [starredEgoGiftIds, setStarredEgoGiftIds] = useState<number[]>([]);
  /** 카드팩 탭에서 별로 선택한 카드팩 ID 목록 (저장 시 JSON에 cardPackIds로 포함) */
  const [starredCardPackIds, setStarredCardPackIds] = useState<number[]>([]);
  /** 등록된 즐겨찾기 목록에서 선택한 항목 (favoriteId, null이면 미선택) */
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<number | null>(null);
  /** 저장 완료 토스트 (내려왔다가 올라가는 안내) */
  const [saveToastState, setSaveToastState] = useState<"hidden" | "visible" | "exiting">("hidden");
  /** 토스트가 막 보일 때만 -100%에서 시작해 내려오는 효과용 */
  const [toastSlideDown, setToastSlideDown] = useState(false);
  /** 결과 탭: 선택한 즐겨찾기의 에고기프트 목록 (키워드별 표시용, 에고기프트 메뉴와 동일 카드 형태) */
  const [resultEgoGifts, setResultEgoGifts] = useState<Array<{
    egogiftId: number;
    giftName: string;
    keywordName?: string;
    keywordId?: number;
    thumbnail?: string;
    giftTier?: string;
    grades?: string[];
    synthesisYn?: string;
    limitedCategoryNames?: string[];
  }>>([]);
  const [resultEgoGiftsLoading, setResultEgoGiftsLoading] = useState(false);
  /** 결과 탭: 합성 조합식 요약 (재료+재료=결과, 이름·썸네일·출현난이도) */
  const [synthesisRecipes, setSynthesisRecipes] = useState<
    { resultEgogiftId: number; resultGiftName: string; resultThumbnail?: string; resultGrades?: string[]; materials: { egogiftId: number; giftName: string; thumbnail?: string; grades?: string[] }[] }[]
  >([]);
  /** 키워드별 카드 영역만 캡처용 (키워드 클릭 시, 합성 조합식 제외) */
  const keywordSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 키워드별 합성 조합식 영역만 캡처용 (조합식 클릭 시) */
  const synthesisSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 전체 결과 영역 캡처용 (전체 다운로드 / 전체 다운로드 합성제외) */
  const allResultRef = useRef<HTMLDivElement | null>(null);
  /** 선택한 카드팩 목록 섹션 전체 캡처용 */
  const starredCardPacksSectionRef = useRef<HTMLDivElement | null>(null);
  /** 결과 탭에서 에고기프트 클릭 시 상세 모달 열기 (EgoGiftPageContent가 설정) */
  const egoGiftPreviewOpenRef = useRef<((giftName: string) => void) | null>(null);
  /** 결과 탭에서 카드팩 클릭 시 상세 모달 열기 (CardPackPageContent가 설정) */
  const cardPackDetailOpenRef = useRef<{ open: (cardpackId: number) => void } | null>(null);
  /** 키워드별 합성 조합식 펼침 여부 (없으면 펼침) */
  const [synthesisExpandedByKeyword, setSynthesisExpandedByKeyword] = useState<Record<string, boolean>>({});
  /** 키워드별 에고기프트 그리드 펼침 여부 (없으면 펼침, 합성 조합식과 별도) */
  const [keywordGiftExpandedByKeyword, setKeywordGiftExpandedByKeyword] = useState<Record<string, boolean>>({});
  /** 결과 탭 간소화: 이름/출현카드팩/합성 여부만, 조합식은 이름만 */
  const [resultSimplified, setResultSimplified] = useState(false);
  /** 결과 탭: 선택한 카드팩 목록 (ID로 조회한 상세) */
  const [resultStarredCardPacks, setResultStarredCardPacks] = useState<Array<{
    cardpackId: number;
    title: string;
    thumbnail?: string;
    floors?: number[];
    difficulties?: string[];
    difficultyFloors?: Array<{ difficulty: string; floors: number[] }>;
  }>>([]);
  const [resultStarredCardPacksLoading, setResultStarredCardPacksLoading] = useState(false);
  /** 결과 탭 즐겨찾기 카드팩: 난이도 필터 (저장 시 searchJson.cardPackDifficulty로 저장) */
  const [resultCardPackDifficulty, setResultCardPackDifficulty] = useState<string>("노말");
  /** 결과 탭 즐겨찾기 카드팩: 층 필터 (null = 전체, 1~15 = 해당 층만, 1개만 선택) */
  const [resultCardPackFloor, setResultCardPackFloor] = useState<number | null>(null);
  /** 결과 탭: 한정 에고기프트가 출현하는 카드팩 (난이도+층 선택 시, 즐겨찾기 카드팩 제외) */
  const [resultLimitedEgoGiftCardPacks, setResultLimitedEgoGiftCardPacks] = useState<Array<{
    cardpackId: number;
    title: string;
    thumbnail?: string;
    floors?: number[];
    difficulties?: string[];
    difficultyFloors?: Array<{ difficulty: string; floors: number[] }>;
  }>>([]);
  const [resultLimitedEgoGiftCardPacksLoading, setResultLimitedEgoGiftCardPacksLoading] = useState(false);
  /** 결과 탭 카드팩: 층별 체크 1개 (floor -> cardpackId), JSON 저장용 */
  const [checkedCardPackByFloor, setCheckedCardPackByFloor] = useState<Record<number, number>>({});
  /** 결과 탭 에고기프트: 체크한 에고기프트 ID 목록 */
  const [checkedEgoGiftIds, setCheckedEgoGiftIds] = useState<number[]>([]);

  const toggleCardPackCheck = (cardpackId: number) => {
    const floor = resultCardPackFloor;
    if (floor == null) return;
    setCheckedCardPackByFloor((prev) => {
      const next = { ...prev };
      if (next[floor] === cardpackId) {
        delete next[floor];
      } else {
        next[floor] = cardpackId;
      }
      return next;
    });
  };

  /** 해당 카드팩이 다른 층에서 선택됐는지 (현재 층 제외) */
  const isCardPackCheckedOnOtherFloor = (cardpackId: number, currentFloor: number): boolean => {
    return Object.entries(checkedCardPackByFloor).some(([f, id]) => Number(f) !== currentFloor && id === cardpackId);
  };

  /** 전체 층일 때 이 카드팩이 선택된 층 번호들 */
  const getFloorsWhereCardPackChecked = (cardpackId: number): number[] => {
    return Object.entries(checkedCardPackByFloor)
      .filter(([, id]) => id === cardpackId)
      .map(([f]) => Number(f))
      .sort((a, b) => a - b);
  };

  const toggleEgoGiftCheck = (egogiftId: number) => {
    setCheckedEgoGiftIds((prev) =>
      prev.includes(egogiftId) ? prev.filter((id) => id !== egogiftId) : [...prev, egogiftId]
    );
  };

  // 노말/하드 선택 시 6~15층 미표시이므로, 해당 층이 선택돼 있으면 5층으로 초기화 (1~5층·전체는 유지)
  useEffect(() => {
    if ((resultCardPackDifficulty === "노말" || resultCardPackDifficulty === "하드") && resultCardPackFloor != null && resultCardPackFloor >= 6) {
      setResultCardPackFloor(5);
    }
  }, [resultCardPackDifficulty]);

  const handleStarToggle = (egogiftId: number) => {
    setStarredEgoGiftIds((prev) =>
      prev.includes(egogiftId) ? prev.filter((id) => id !== egogiftId) : [...prev, egogiftId]
    );
  };

  const handleCardPackStarToggle = (cardpackId: number) => {
    setStarredCardPackIds((prev) =>
      prev.includes(cardpackId) ? prev.filter((id) => id !== cardpackId) : [...prev, cardpackId]
    );
  };

  const fetchFavorites = useCallback(async (): Promise<FavoriteItem[]> => {
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setItems([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/FAVORITE`, {
        method: "GET",
        headers: { "X-User-UUID": uuid },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.items ?? [];
        setItems(list);
        return list;
      }
      setItems([]);
      return [];
    } catch {
      setError("목록을 불러오지 못했습니다.");
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // 결과 탭: 선택한 즐겨찾기의 에고기프트 ID로 목록 조회 후 키워드별 표시용으로 저장
  useEffect(() => {
    if (activeTab !== "result" || starredEgoGiftIds.length === 0) {
      setResultEgoGifts([]);
      return;
    }
    let cancelled = false;
    setResultEgoGiftsLoading(true);
    fetch(`${API_BASE_URL}/user/egogift?page=0&size=10000`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        const all = data.items || [];
        const idSet = new Set(starredEgoGiftIds);
        const filtered = all
          .filter((item: any) => idSet.has(Number(item.egogiftId)))
          .map((item: any) => {
            const rawTier = item.giftTier ?? item.gift_tier;
            const giftTier = rawTier != null && rawTier !== "" ? String(rawTier).trim() : undefined;
            return {
              egogiftId: Number(item.egogiftId),
              giftName: String(item.giftName ?? ""),
              keywordName: item.keywordName ? String(item.keywordName).trim() || "기타" : "기타",
              keywordId: item.keywordId != null ? Number(item.keywordId) : undefined,
              thumbnail: item.thumbnail ?? item.thumbnail_path,
              giftTier,
              grades: Array.isArray(item.grades) ? item.grades : [],
              synthesisYn: item.synthesisYn ?? item.synthesis_yn,
              limitedCategoryNames: Array.isArray(item.limitedCategoryNames) ? item.limitedCategoryNames : [],
            };
          });
        setResultEgoGifts(filtered);
        const synthesisIds = filtered.filter((eg: { synthesisYn?: string }) => eg.synthesisYn === "Y").map((eg: { egogiftId: number }) => eg.egogiftId);
        if (synthesisIds.length > 0) {
          const q = synthesisIds.map((id: number) => "egogiftIds=" + id).join("&");
          fetch(`${API_BASE_URL}/user/egogift/synthesis-recipes?${q}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : []))
            .then((data: any[]) => {
              if (cancelled) return;
              const list = Array.isArray(data)
                ? data.map((r: any) => ({
                    resultEgogiftId: Number(r.resultEgogiftId),
                    resultGiftName: String(r.resultGiftName ?? ""),
                    resultThumbnail: r.resultThumbnail,
                    resultGrades: Array.isArray(r.resultGrades) ? r.resultGrades : undefined,
                    materials: (Array.isArray(r.materials) ? r.materials : []).map((m: any) => ({
                      egogiftId: Number(m.egogiftId),
                      giftName: String(m.giftName ?? ""),
                      thumbnail: m.thumbnail,
                      grades: Array.isArray(m.grades) ? m.grades : undefined,
                    })),
                  }))
                : [];
              setSynthesisRecipes(list);
            })
            .catch(() => {
              if (!cancelled) setSynthesisRecipes([]);
            });
        } else {
          setSynthesisRecipes([]);
        }
      })
      .catch(() => {
        if (!cancelled) setResultEgoGifts([]);
      })
      .finally(() => {
        if (!cancelled) setResultEgoGiftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, starredEgoGiftIds]);

  // 결과 탭: 선택한 카드팩 목록 ID 목록으로 조회
  useEffect(() => {
    if (activeTab !== "result" || starredCardPackIds.length === 0) {
      setResultStarredCardPacks([]);
      return;
    }
    let cancelled = false;
    setResultStarredCardPacksLoading(true);
    const query = starredCardPackIds.map((id) => `ids=${id}`).join("&");
    fetch(`${API_BASE_URL}/user/cardpack/by-ids?${query}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setResultStarredCardPacks(
          items.map((item: { cardpackId?: number; title?: string; thumbnail?: string; floors?: number[]; difficulties?: string[]; difficultyFloors?: Array<{ difficulty: string; floors: number[] }> }) => ({
            cardpackId: Number(item.cardpackId),
            title: String(item.title ?? ""),
            thumbnail: item.thumbnail,
            floors: Array.isArray(item.floors) ? item.floors : [],
            difficulties: Array.isArray(item.difficulties) ? item.difficulties : [],
            difficultyFloors: Array.isArray(item.difficultyFloors) ? item.difficultyFloors : [],
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setResultStarredCardPacks([]);
      })
      .finally(() => {
        if (!cancelled) setResultStarredCardPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, starredCardPackIds]);

  // 결과 탭: 난이도 선택 시 한정 에고기프트 출현 카드팩 조회 (층 전체 선택 시에도 조회)
  useEffect(() => {
    const difficulty = resultCardPackDifficulty;
    const floor = resultCardPackFloor;
    if (activeTab !== "result" || difficulty == null) {
      setResultLimitedEgoGiftCardPacks([]);
      return;
    }
    const allowedByDifficulty: Record<string, string[]> = {
      노말: ["노말"],
      하드: ["하드"],
      익스트림: ["하드", "익스트림"],
    };
    const difficulties = allowedByDifficulty[difficulty];
    if (!difficulties?.length) {
      setResultLimitedEgoGiftCardPacks([]);
      return;
    }
    const limitedStarredEgoGiftIds = resultEgoGifts
      .filter((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0)
      .map((eg) => eg.egogiftId);
    if (limitedStarredEgoGiftIds.length === 0) {
      setResultLimitedEgoGiftCardPacks([]);
      return;
    }
    let cancelled = false;
    setResultLimitedEgoGiftCardPacksLoading(true);
    const difficultyParams = difficulties.map((d) => `difficulties=${encodeURIComponent(d)}`).join("&");
    const egogiftParams = limitedStarredEgoGiftIds.map((id) => `egogiftIds=${id}`).join("&");
    const excludeParams = starredCardPackIds.length > 0 ? starredCardPackIds.map((id) => `excludeCardpackIds=${id}`).join("&") : "";
    const floorParam = floor != null ? `floor=${floor}` : "";
    const query = [difficultyParams, floorParam, egogiftParams, excludeParams].filter(Boolean).join("&");
    fetch(`${API_BASE_URL}/user/cardpack/for-limited-starred-egogifts?${query}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setResultLimitedEgoGiftCardPacks(
          items.map((item: { cardpackId?: number; title?: string; thumbnail?: string; floors?: number[]; difficulties?: string[]; difficultyFloors?: Array<{ difficulty: string; floors: number[] }> }) => ({
            cardpackId: Number(item.cardpackId),
            title: String(item.title ?? ""),
            thumbnail: item.thumbnail,
            floors: Array.isArray(item.floors) ? item.floors : [],
            difficulties: Array.isArray(item.difficulties) ? item.difficulties : [],
            difficultyFloors: Array.isArray(item.difficultyFloors) ? item.difficultyFloors : [],
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setResultLimitedEgoGiftCardPacks([]);
      })
      .finally(() => {
        if (!cancelled) setResultLimitedEgoGiftCardPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, resultCardPackDifficulty, resultCardPackFloor, resultEgoGifts, starredCardPackIds]);

  // 결과 탭: 키워드별 그룹 (키워드 순서 고정, 기타는 맨 뒤), 그룹 내는 등급 낮은 순(1 → 2 → … → EX)
  const RESULT_KEYWORD_ORDER = [
    "화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "참격", "관통", "타격", "범용", "기타",
  ];
  const tierSortOrder = (tier: string | undefined): number => {
    if (tier == null || tier === "") return 99;
    const t = String(tier).trim().toUpperCase();
    if (t === "1") return 1;
    if (t === "2") return 2;
    if (t === "3") return 3;
    if (t === "4") return 4;
    if (t === "5") return 5;
    if (t === "EX") return 6;
    return 99;
  };
  /** 출현난이도 정렬용: 노말(1) → 하드(2) → 익스트림(3). 여러 개 있으면 가장 낮은 것 기준 */
  const gradeSortOrder = (grades: string[] | undefined): number => {
    if (!grades || grades.length === 0) return 99;
    let min = 99;
    for (const g of grades) {
      if (g === "N") min = Math.min(min, 1);
      else if (g === "H") min = Math.min(min, 2);
      else if (g === "E") min = Math.min(min, 3);
    }
    return min;
  };
  const tierDisplay = (tier: string | undefined): string => {
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
  };

  const getFavoriteTitle = useCallback((): string => {
    const item = items.find((i) => i.favoriteId === selectedFavoriteId);
    if (!item) return "즐겨찾기";
    try {
      const p = JSON.parse(item.searchJson) as { title?: string };
      const t = (p?.title ?? "").trim();
      return t.replace(/[\\/:*?"<>|]/g, "_").trim() || "즐겨찾기";
    } catch {
      return "즐겨찾기";
    }
  }, [items, selectedFavoriteId]);

  const captureSectionAsImage = useCallback(
    async (keyword: string, isSynthesis: boolean) => {
      const el = isSynthesis ? synthesisSectionRefs.current[keyword] : keywordSectionRefs.current[keyword];
      if (!el || typeof window === "undefined") return;
      const favoriteTitle = getFavoriteTitle();
      const safeKeyword = keyword.replace(/[\\/:*?"<>|]/g, "_").trim() || "키워드";
      const dateStr = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      })();
      const baseName = `${favoriteTitle}_에고기프트_${safeKeyword}${isSynthesis ? "_조합식" : ""}_${dateStr}.png`;

      const restores: { img: HTMLImageElement; originalSrc: string; blobUrl: string }[] = [];
      try {
        const imgs = el.querySelectorAll<HTMLImageElement>("img[src]");
        const baseOrigin = typeof window !== "undefined" ? window.location.origin : "";
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
          try {
            const imgOrigin = new URL(src, window.location.href).origin;
            if (imgOrigin === baseOrigin) continue;
            let res = await fetch(src, { credentials: "include", mode: "cors" }).catch(() => null);
            if (!res?.ok) {
              const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(src)}`;
              res = await fetch(proxyUrl).catch(() => null);
            }
            if (!res?.ok) continue;
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            restores.push({ img, originalSrc: src, blobUrl });
            img.src = blobUrl;
            await img.decode?.().catch(() => new Promise<void>((r) => { img.onload = () => r(); }));
          } catch {
            /* 개별 이미지 실패 시 스킵 */
          }
        }
        const { default: html2canvas } = await import("html2canvas");
        el.classList.add("keyword-capture-hex");
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await new Promise<void>((r) => setTimeout(r, 80));
        const origError = console.error;
        const origWarn = console.warn;
        const suppressColorParse = (fn: typeof console.error) => (...args: unknown[]) => {
          const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
          if (/lab|lch|oklab|oklch|unsupported color/i.test(msg)) return;
          fn.apply(console, args);
        };
        console.error = suppressColorParse(origError);
        console.warn = suppressColorParse(origWarn);
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#131316",
          scale: 2,
          logging: false,
        });
        console.error = origError;
        console.warn = origWarn;
        el.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = baseName;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      } catch (err) {
        el.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        console.error(isSynthesis ? "조합식 영역 캡처 실패:" : "키워드 영역 캡처 실패:", err);
      }
    },
    [getFavoriteTitle]
  );

  const captureAllResultAsImage = useCallback(
    async (excludeSynthesis: boolean) => {
      const el = allResultRef.current;
      if (!el || typeof window === "undefined") return;
      const favoriteTitle = getFavoriteTitle();
      const dateStr = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      })();
      const baseName = `${favoriteTitle}_에고기프트_전체${excludeSynthesis ? "_합성제외" : ""}_${dateStr}.png`;

      /* 캡처 시 화면 상태 그대로 유지: 간소화 여부·합성 접기/펼침 변경 없음. 합성제외만 클래스로 숨김 */
      if (excludeSynthesis) el.classList.add("capture-exclude-synthesis");
      const restores: { img: HTMLImageElement; originalSrc: string; blobUrl: string }[] = [];
      try {
        const imgs = el.querySelectorAll<HTMLImageElement>("img[src]");
        const baseOrigin = typeof window !== "undefined" ? window.location.origin : "";
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
          try {
            const imgOrigin = new URL(src, window.location.href).origin;
            if (imgOrigin === baseOrigin) continue;
            let res = await fetch(src, { credentials: "include", mode: "cors" }).catch(() => null);
            if (!res?.ok) {
              const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(src)}`;
              res = await fetch(proxyUrl).catch(() => null);
            }
            if (!res?.ok) continue;
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            restores.push({ img, originalSrc: src, blobUrl });
            img.src = blobUrl;
            await img.decode?.().catch(() => new Promise<void>((r) => { img.onload = () => r(); }));
          } catch {
            /* 개별 이미지 실패 시 스킵 */
          }
        }
        const { default: html2canvas } = await import("html2canvas");
        el.classList.add("keyword-capture-hex");
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await new Promise<void>((r) => setTimeout(r, 80));
        const origError = console.error;
        const origWarn = console.warn;
        const suppressColorParse = (fn: typeof console.error) => (...args: unknown[]) => {
          const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
          if (/lab|lch|oklab|oklch|unsupported color/i.test(msg)) return;
          fn.apply(console, args);
        };
        console.error = suppressColorParse(origError);
        console.warn = suppressColorParse(origWarn);
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#131316",
          scale: 2,
          logging: false,
        });
        console.error = origError;
        console.warn = origWarn;
        el.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        if (excludeSynthesis) el.classList.remove("capture-exclude-synthesis");
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = baseName;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      } catch (err) {
        el.classList.remove("keyword-capture-hex");
        if (excludeSynthesis) el.classList.remove("capture-exclude-synthesis");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        console.error("전체 에고기프트 캡처 실패:", err);
      }
    },
    [getFavoriteTitle]
  );

  const captureCardPackAsImage = useCallback(
    async (cardEl: HTMLElement, pack: { cardpackId: number; title: string }) => {
      if (!cardEl || typeof window === "undefined") return;
      const favoriteTitle = getFavoriteTitle();
      const safeTitle = pack.title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 50) || `카드팩_${pack.cardpackId}`;
      const dateStr = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      })();
      const baseName = `${favoriteTitle}_카드팩_${safeTitle}_${dateStr}.png`;

      const restores: { img: HTMLImageElement; originalSrc: string; blobUrl: string }[] = [];
      try {
        const imgs = cardEl.querySelectorAll<HTMLImageElement>("img[src]");
        const baseOrigin = window.location.origin;
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
          try {
            const imgOrigin = new URL(src, window.location.href).origin;
            if (imgOrigin === baseOrigin) continue;
            let res = await fetch(src, { credentials: "include", mode: "cors" }).catch(() => null);
            if (!res?.ok) {
              const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(src)}`;
              res = await fetch(proxyUrl).catch(() => null);
            }
            if (!res?.ok) continue;
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            restores.push({ img, originalSrc: src, blobUrl });
            img.src = blobUrl;
            await img.decode?.().catch(() => new Promise<void>((r) => { img.onload = () => r(); }));
          } catch {
            /* skip */
          }
        }
        const { default: html2canvas } = await import("html2canvas");
        cardEl.classList.add("keyword-capture-hex");
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await new Promise<void>((r) => setTimeout(r, 80));
        const origError = console.error;
        const origWarn = console.warn;
        const suppressColorParse = (fn: typeof console.error) => (...args: unknown[]) => {
          const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
          if (/lab|lch|oklab|oklch|unsupported color/i.test(msg)) return;
          fn.apply(console, args);
        };
        console.error = suppressColorParse(origError);
        console.warn = suppressColorParse(origWarn);
        const canvas = await html2canvas(cardEl, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#131316",
          scale: 2,
          logging: false,
        });
        console.error = origError;
        console.warn = origWarn;
        cardEl.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = baseName;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      } catch (err) {
        cardEl.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        console.error("카드팩 이미지 캡처 실패:", err);
      }
    },
    [getFavoriteTitle]
  );

  const captureStarredCardPacksSectionAsImage = useCallback(async () => {
    const el = starredCardPacksSectionRef.current;
    if (!el || typeof window === "undefined") return;
    const favoriteTitle = getFavoriteTitle();
    const dateStr = (() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    })();
    const baseName = `${favoriteTitle}_즐겨찾기한카드팩_${dateStr}.png`;

    const restores: { img: HTMLImageElement; originalSrc: string; blobUrl: string }[] = [];
    try {
      const imgs = el.querySelectorAll<HTMLImageElement>("img[src]");
      const baseOrigin = window.location.origin;
      for (const img of imgs) {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
        try {
          const imgOrigin = new URL(src, window.location.href).origin;
          if (imgOrigin === baseOrigin) continue;
          let res = await fetch(src, { credentials: "include", mode: "cors" }).catch(() => null);
          if (!res?.ok) {
            const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(src)}`;
            res = await fetch(proxyUrl).catch(() => null);
          }
          if (!res?.ok) continue;
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          restores.push({ img, originalSrc: src, blobUrl });
          img.src = blobUrl;
          await img.decode?.().catch(() => new Promise<void>((r) => { img.onload = () => r(); }));
        } catch {
          /* skip */
        }
      }
      const { default: html2canvas } = await import("html2canvas");
      el.classList.add("keyword-capture-hex");
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => setTimeout(r, 80));
      const origError = console.error;
      const origWarn = console.warn;
      const suppressColorParse = (fn: typeof console.error) => (...args: unknown[]) => {
        const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
        if (/lab|lch|oklab|oklch|unsupported color/i.test(msg)) return;
        fn.apply(console, args);
      };
      console.error = suppressColorParse(origError);
      console.warn = suppressColorParse(origWarn);
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#131316",
        scale: 2,
        logging: false,
      });
      console.error = origError;
      console.warn = origWarn;
      el.classList.remove("keyword-capture-hex");
      for (const { img, originalSrc, blobUrl } of restores) {
        img.src = originalSrc;
        URL.revokeObjectURL(blobUrl);
      }
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = baseName;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      el.classList.remove("keyword-capture-hex");
      for (const { img, originalSrc, blobUrl } of restores) {
        img.src = originalSrc;
        URL.revokeObjectURL(blobUrl);
      }
      console.error("선택한 카드팩 목록 영역 캡처 실패:", err);
    }
  }, [getFavoriteTitle]);

  const resultEgoGiftsByKeyword = useMemo(() => {
    const map = new Map<string, typeof resultEgoGifts>();
    for (const eg of resultEgoGifts) {
      const key = eg.keywordName ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(eg);
    }
    const ordered: Array<{ keyword: string; egogifts: typeof resultEgoGifts }> = [];
    for (const kw of RESULT_KEYWORD_ORDER) {
      const list = map.get(kw);
      if (list && list.length > 0) {
        const sorted = [...list].sort((a, b) => {
          const tierDiff = tierSortOrder(a.giftTier) - tierSortOrder(b.giftTier);
          if (tierDiff !== 0) return tierDiff;
          return gradeSortOrder(a.grades) - gradeSortOrder(b.grades);
        });
        ordered.push({ keyword: kw, egogifts: sorted });
      }
    }
    const rest = Array.from(map.keys()).filter((k) => !RESULT_KEYWORD_ORDER.includes(k));
    rest.sort((a, b) => a.localeCompare(b, "ko"));
    for (const kw of rest) {
      const list = map.get(kw)!;
      if (list.length > 0) {
        const sorted = [...list].sort((a, b) => {
          const tierDiff = tierSortOrder(a.giftTier) - tierSortOrder(b.giftTier);
          if (tierDiff !== 0) return tierDiff;
          return gradeSortOrder(a.grades) - gradeSortOrder(b.grades);
        });
        ordered.push({ keyword: kw, egogifts: sorted });
      }
    }
    return ordered;
  }, [resultEgoGifts]);

  // 저장 완료 토스트: 막 보일 때 한 번만 아래로 내려오기
  useEffect(() => {
    if (saveToastState === "visible" && !toastSlideDown) {
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setToastSlideDown(true));
      });
      return () => cancelAnimationFrame(t);
    }
  }, [saveToastState, toastSlideDown]);

  // 저장 완료 토스트: visible 시 2.5초 후 올라가며 사라짐
  useEffect(() => {
    if (saveToastState === "visible") {
      const downTimer = setTimeout(() => setSaveToastState("exiting"), 2500);
      return () => clearTimeout(downTimer);
    }
    if (saveToastState === "exiting") {
      const upTimer = setTimeout(() => {
        setSaveToastState("hidden");
        setToastSlideDown(false);
      }, 350);
      return () => clearTimeout(upTimer);
    }
  }, [saveToastState]);

  // 공유 링크 복사 토스트: 2초 후 제거
  useEffect(() => {
    if (!shareToastMessage) return;
    const t = setTimeout(() => setShareToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [shareToastMessage]);

  /** 기존 목록 제목과 비교해 중복 시 "제목 (1)", "제목 (2)" 형태로 고유 제목 반환 */
  const getUniqueReportTitle = (baseTitle: string, existingItems: FavoriteItem[]): string => {
    const existingTitles = new Set(
      existingItems.map((item) => {
        try {
          const parsed = JSON.parse(item.searchJson) as { title?: string };
          return (parsed?.title ?? "").trim();
        } catch {
          return "";
        }
      }).filter(Boolean)
    );
    if (!existingTitles.has(baseTitle)) return baseTitle;
    let n = 1;
    while (existingTitles.has(`${baseTitle} (${n})`)) n++;
    return `${baseTitle} (${n})`;
  };

  /** 등록만 수행 (추가). title 외에는 빈 값으로 저장. 즐겨찾기 제목 수정은 목록 항목 오른쪽 연필 아이콘으로 진행 */
  const handleRegister = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed) return;
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    const titleToSave = getUniqueReportTitle(trimmed, items);
    const merged = {
      title: titleToSave,
      egogiftIds: [] as number[],
      cardPackIds: [] as number[],
      cardPackDifficulty: "노말" as string,
      cardPackCheckedByFloor: {} as Record<string, number>,
    };
    const payload = { searchJson: JSON.stringify(merged) };
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-UUID": uuid },
        credentials: "include",
        body: JSON.stringify({ pageType: "FAVORITE", searchJson: payload.searchJson }),
      });
      const data = await res.json();
      if (data.success) {
        setTitleInput("");
        setStarredEgoGiftIds([]);
        setStarredCardPackIds([]);
        setResultCardPackDifficulty("노말");
        setCheckedCardPackByFloor({});
        setCheckedEgoGiftIds([]);
        setSelectedFavoriteId(null);
        await fetchFavorites();
        setToastSlideDown(false);
        setSaveToastState("visible");
      } else {
        setError(data.message ?? "등록에 실패했습니다.");
      }
    } catch {
      setError("등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  /** 선택된 즐겨찾기 전체 저장 (상단 저장 버튼용) */
  const handleSave = async () => {
    if (selectedFavoriteId === null) return;
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    const isCardPack = activeTab === "cardpack";
    const existing = items.find((i) => i.favoriteId === selectedFavoriteId);
    let parsed: { title?: string; egogiftIds?: number[]; cardPackIds?: number[]; cardPackDifficulty?: string; cardPackCheckedByFloor?: Record<string, number>; checkedEgoGiftIds?: number[] } = {};
    if (existing) {
      try {
        parsed = JSON.parse(existing.searchJson) || {};
      } catch {
        /* ignore */
      }
    }
    const trimmed = titleInput.trim();
    const titleToSave = trimmed || (parsed.title ?? "").trim() || "(제목 없음)";
    const merged = {
      title: titleToSave,
      egogiftIds: isCardPack ? (Array.isArray(parsed.egogiftIds) ? parsed.egogiftIds : []) : starredEgoGiftIds,
      cardPackIds: isCardPack ? starredCardPackIds : (Array.isArray(parsed.cardPackIds) ? parsed.cardPackIds : []),
      cardPackDifficulty: resultCardPackDifficulty,
      cardPackCheckedByFloor: Object.fromEntries(Object.entries(checkedCardPackByFloor).map(([k, v]) => [String(k), v])),
      checkedEgoGiftIds: isCardPack ? (Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []) : checkedEgoGiftIds,
    };
    const payload = { searchJson: JSON.stringify(merged) };
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/${selectedFavoriteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-UUID": uuid },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFavorites();
        setToastSlideDown(false);
        setSaveToastState("visible");
      } else {
        setError(data.message ?? "저장에 실패했습니다.");
      }
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  const startEditTitle = (e: React.MouseEvent, item: { favoriteId: number; searchJson: string }) => {
    e.stopPropagation();
    let parsed: { title?: string } = {};
    try {
      parsed = JSON.parse(item.searchJson) as { title?: string };
    } catch {
      return;
    }
    setEditingFavoriteId(item.favoriteId);
    setEditingTitleInput(parsed.title ?? "");
  };

  const cancelEditTitle = () => {
    setEditingFavoriteId(null);
    setEditingTitleInput("");
  };

  const saveEditTitle = async (item: { favoriteId: number; searchJson: string }) => {
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    const trimmed = editingTitleInput.trim();
    let parsed: { title?: string; [key: string]: unknown } = {};
    try {
      parsed = JSON.parse(item.searchJson) as { title?: string; [key: string]: unknown };
    } catch {
      setError("저장 데이터를 읽을 수 없습니다.");
      return;
    }
    if (trimmed === (parsed.title ?? "")) {
      cancelEditTitle();
      return;
    }
    setError(null);
    setEditingId(item.favoriteId);
    try {
      const merged = { ...parsed, title: trimmed };
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/${item.favoriteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-UUID": uuid },
        credentials: "include",
        body: JSON.stringify({ searchJson: JSON.stringify(merged) }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFavorites();
        if (selectedFavoriteId === item.favoriteId) setTitleInput(trimmed);
        cancelEditTitle();
      } else {
        setError(data.message ?? "제목 수정에 실패했습니다.");
      }
    } catch {
      setError("제목 수정에 실패했습니다.");
    } finally {
      setEditingId(null);
    }
  };

  const handleShare = async (e: React.MouseEvent, favoriteId: number) => {
    e.stopPropagation();
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    setError(null);
    setSharingId(favoriteId);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/${favoriteId}/share`, {
        method: "POST",
        headers: { "X-User-UUID": uuid },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.shareToken) {
        const token = String(data.shareToken);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(token);
          setShareToastMessage("공유 코드가 복사되었습니다.");
        } else {
          setShareToastMessage(token);
        }
      } else {
        setError(data.message ?? "공유에 실패했습니다.");
      }
    } catch {
      setError("공유에 실패했습니다.");
    } finally {
      setSharingId(null);
    }
  };

  const handleImportShare = () => {
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    setError(null);
    setImportShareTokenInput("");
    setImportLookupResult(null);
    setImportSaveTitleInput("");
    setImportShareModalOpen(true);
  };

  const closeImportShareModal = () => {
    setImportShareModalOpen(false);
    setImportLookupResult(null);
    setImportSaveTitleInput("");
    setImportShareTokenInput("");
  };

  /** 1단계: 공유 코드 조회 (저장하지 않음) */
  const handleImportShareLookup = async (token: string) => {
    if (!token?.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shareToken: token.trim() }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const parsed = JSON.parse(data.data.searchJson) as { title?: string };
        const suggestedTitle = (parsed.title ?? "").trim();
        setImportLookupResult({ searchJson: data.data.searchJson, pageType: data.data.pageType ?? "FAVORITE" });
        setImportSaveTitleInput(suggestedTitle ? getUniqueReportTitle(suggestedTitle, items) : "");
      } else {
        setError(data.message ?? "조회에 실패했습니다.");
      }
    } catch {
      setError("조회에 실패했습니다.");
    } finally {
      setImporting(false);
    }
  };

  /** 2단계: 입력한 제목으로 저장 */
  const handleImportShareSave = async () => {
    const token = importShareTokenInput.trim();
    const titleToSave = importSaveTitleInput.trim();
    if (!token) return;
    const uuid = getOrCreateUUID();
    if (!uuid) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-UUID": uuid },
        credentials: "include",
        body: JSON.stringify({ shareToken: token, title: titleToSave || undefined }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        closeImportShareModal();
        const updatedItems = await fetchFavorites();
        const parsed = JSON.parse(data.data.searchJson) as {
          title?: string;
          egogiftIds?: number[];
          cardPackIds?: number[];
          cardPackDifficulty?: string;
          cardPackCheckedByFloor?: Record<string, number>;
          checkedEgoGiftIds?: number[];
        };
        setSelectedFavoriteId(data.data.favoriteId);
        const importedTitle = (parsed.title ?? "").trim();
        setTitleInput(importedTitle ? getUniqueReportTitle(importedTitle, updatedItems) : "");
        setStarredEgoGiftIds(Array.isArray(parsed.egogiftIds) ? parsed.egogiftIds : []);
        setStarredCardPackIds(Array.isArray(parsed.cardPackIds) ? parsed.cardPackIds : []);
        setResultCardPackDifficulty(parsed.cardPackDifficulty === "하드" || parsed.cardPackDifficulty === "익스트림" ? parsed.cardPackDifficulty : parsed.cardPackDifficulty === "평행중첩" ? "익스트림" : "노말");
        const byFloor = parsed.cardPackCheckedByFloor && typeof parsed.cardPackCheckedByFloor === "object"
          ? Object.fromEntries(Object.entries(parsed.cardPackCheckedByFloor).map(([k, v]) => [Number(k), v]).filter(([k]) => !Number.isNaN(k)))
          : {};
        setCheckedCardPackByFloor(byFloor as Record<number, number>);
        setCheckedEgoGiftIds(Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []);
        setSaveToastState("visible");
        setToastSlideDown(true);
      } else {
        setError(data.message ?? "불러오기에 실패했습니다.");
      }
    } catch {
      setError("불러오기에 실패했습니다.");
    } finally {
      setImporting(false);
    }
  };

  const doDeleteFavorite = async (favoriteId: number) => {
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    setDeletingId(favoriteId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/${favoriteId}`, {
        method: "DELETE",
        headers: { "X-User-UUID": uuid },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        if (selectedFavoriteId === favoriteId) {
          setSelectedFavoriteId(null);
          setTitleInput("");
          setStarredEgoGiftIds([]);
          setStarredCardPackIds([]);
          setResultCardPackDifficulty("노말");
          setCheckedCardPackByFloor({});
          setCheckedEgoGiftIds([]);
        }
        await fetchFavorites();
      } else {
        setError(data.message ?? "삭제에 실패했습니다.");
      }
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
      setDeleteConfirmFavoriteId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, favoriteId: number) => {
    e.stopPropagation();
    setDeleteConfirmFavoriteId(favoriteId);
  };

  /** 즐겨찾기 영역 (에고기프트 탭에서는 검색 조건 위에 붙여 표시) */
  const favoritesPanel = (
    <div className="bg-[#131316] border border-[#b8860b]/40 rounded px-5 py-4 lg:sticky lg:top-[120px] z-[100] overflow-visible">
      <button
        type="button"
        onClick={() => setFavoritesPanelOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset rounded ${favoritesPanelOpen ? "mb-4" : ""}`}
        aria-expanded={favoritesPanelOpen}
        aria-label={favoritesPanelOpen ? "보고서 목록 영역 접기" : "보고서 목록 영역 펼치기"}
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-yellow-300">보고서 목록</h2>
          {!favoritesPanelOpen && selectedFavoriteId != null && (() => {
            const item = items.find((i) => i.favoriteId === selectedFavoriteId);
            if (!item) return null;
            try {
              const title = (JSON.parse(item.searchJson) as { title?: string })?.title?.trim() || "(제목 없음)";
              return <p className="text-sm text-gray-400 truncate mt-0.5">{title}</p>;
            } catch {
              return <p className="text-sm text-gray-400 truncate mt-0.5">(제목 없음)</p>;
            }
          })()}
        </div>
        <span className={`shrink-0 transition-transform duration-200 ${favoritesPanelOpen ? "rotate-90" : ""}`} aria-hidden>
          ▶
        </span>
      </button>
      {selectedFavoriteId !== null && (
        <div className={favoritesPanelOpen ? "mb-4" : "mt-3"}>
          <button
            type="button"
            onClick={handleSave}
            disabled={registering}
            className="w-full px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {registering ? "저장 중..." : "저장"}
          </button>
        </div>
      )}
      <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: favoritesPanelOpen ? "1fr" : "0fr" }}>
        <div className="min-h-0 overflow-hidden">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-2">제목</label>
          <input
            type="text"
            placeholder="등록할 제목 입력"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRegister();
            }}
            className="w-full px-3 py-2 bg-[#2a2a2d] text-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset mb-2 border border-[#b8860b]/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImportShare}
              disabled={importing}
              className="flex-1 px-4 py-2 bg-[#2a2a2d] text-yellow-300 font-semibold rounded border border-[#b8860b]/50 hover:bg-[#333338] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing ? "불러오는 중..." : "불러오기"}
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={registering}
              className="flex-1 px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {registering ? "등록 중..." : "등록"}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-[#b8860b]/30">
          {loading ? (
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-400 text-sm">등록된 즐겨찾기가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                let title = "";
                try {
                  const parsed = JSON.parse(item.searchJson) as { title?: string };
                  title = parsed?.title ?? "(제목 없음)";
                } catch {
                  title = "(제목 없음)";
                }
                return (
                  <li
                    key={item.favoriteId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (deletingId === item.favoriteId || editingFavoriteId === item.favoriteId) return;
                      setSelectedFavoriteId(item.favoriteId);
                      try {
                        const parsed = JSON.parse(item.searchJson) as {
                          title?: string;
                          egogiftIds?: number[];
                          cardPackIds?: number[];
                          cardPackDifficulty?: string;
                          cardPackCheckedByFloor?: Record<string, number>;
                          checkedEgoGiftIds?: number[];
                        };
                        setTitleInput("");
                        setStarredEgoGiftIds(Array.isArray(parsed.egogiftIds) ? parsed.egogiftIds : []);
                        setStarredCardPackIds(Array.isArray(parsed.cardPackIds) ? parsed.cardPackIds : []);
                        setResultCardPackDifficulty(parsed.cardPackDifficulty === "하드" || parsed.cardPackDifficulty === "익스트림" ? parsed.cardPackDifficulty : parsed.cardPackDifficulty === "평행중첩" ? "익스트림" : "노말");
                        const byFloor = parsed.cardPackCheckedByFloor && typeof parsed.cardPackCheckedByFloor === "object"
                          ? Object.fromEntries(Object.entries(parsed.cardPackCheckedByFloor).map(([k, v]) => [Number(k), v]).filter(([k]) => !Number.isNaN(k)))
                          : {};
                        setCheckedCardPackByFloor(byFloor as Record<number, number>);
                        setCheckedEgoGiftIds(Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []);
                      } catch {
                        setTitleInput("");
                        setStarredEgoGiftIds([]);
                        setStarredCardPackIds([]);
                        setResultCardPackDifficulty("노말");
                        setCheckedCardPackByFloor({});
                        setCheckedEgoGiftIds([]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (deletingId === item.favoriteId || editingFavoriteId === item.favoriteId) return;
                        setSelectedFavoriteId(item.favoriteId);
                        try {
                          const parsed = JSON.parse(item.searchJson) as {
                            title?: string;
                            egogiftIds?: number[];
                            cardPackIds?: number[];
                            cardPackDifficulty?: string;
                            cardPackCheckedByFloor?: Record<string, number>;
                            checkedEgoGiftIds?: number[];
                          };
                          setTitleInput("");
                          setStarredEgoGiftIds(Array.isArray(parsed.egogiftIds) ? parsed.egogiftIds : []);
                          setStarredCardPackIds(Array.isArray(parsed.cardPackIds) ? parsed.cardPackIds : []);
                          setResultCardPackDifficulty(parsed.cardPackDifficulty === "하드" || parsed.cardPackDifficulty === "익스트림" ? parsed.cardPackDifficulty : parsed.cardPackDifficulty === "평행중첩" ? "익스트림" : "노말");
                          const byFloor = parsed.cardPackCheckedByFloor && typeof parsed.cardPackCheckedByFloor === "object"
                            ? Object.fromEntries(Object.entries(parsed.cardPackCheckedByFloor).map(([k, v]) => [Number(k), v]).filter(([k]) => !Number.isNaN(k)))
                            : {};
                          setCheckedCardPackByFloor(byFloor as Record<number, number>);
                          setCheckedEgoGiftIds(Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []);
                        } catch {
                          setTitleInput("");
                          setStarredEgoGiftIds([]);
                          setStarredCardPackIds([]);
                          setResultCardPackDifficulty("노말");
                          setCheckedCardPackByFloor({});
                          setCheckedEgoGiftIds([]);
                        }
                      }
                    }}
                    className={`rounded p-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                      editingFavoriteId === item.favoriteId
                        ? "bg-[#2a2a2d] border border-[#b8860b]/30"
                        : selectedFavoriteId === item.favoriteId
                          ? "bg-yellow-400/20 border border-yellow-400/60 text-yellow-200 cursor-pointer"
                          : "bg-[#2a2a2d] border border-[#b8860b]/30 text-gray-200 hover:bg-[#333338] cursor-pointer"
                    }`}
                  >
                    {editingFavoriteId === item.favoriteId ? (
                      <>
                        <input
                          type="text"
                          value={editingTitleInput}
                          onChange={(e) => setEditingTitleInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditTitle(item);
                            else if (e.key === "Escape") cancelEditTitle();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 px-2 py-1 bg-[#1a1a1d] text-white rounded text-sm border border-[#b8860b]/30 focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:ring-inset"
                          autoFocus
                        />
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); saveEditTitle(item); }}
                            disabled={editingId !== null}
                            className="px-2 py-1 text-xs font-medium rounded bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cancelEditTitle(); }}
                            className="px-2 py-1 text-xs font-medium rounded bg-gray-600 hover:bg-gray-500 text-white"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 truncate">{title}</span>
                        <div className="shrink-0 flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => startEditTitle(e, item)}
                            disabled={editingId !== null}
                            className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="제목 수정"
                            aria-label="제목 수정"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleShare(e, item.favoriteId)}
                            disabled={sharingId !== null}
                            className="p-1 rounded text-amber-400/90 hover:bg-amber-400/20 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="공유"
                            aria-label="공유"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, item.favoriteId)}
                            disabled={deletingId !== null}
                            className="p-1 rounded text-red-400 hover:bg-red-400/20 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="삭제"
                            aria-label="삭제"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        backgroundImage: "url('/Yihongyuan_Yard_BG.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 캡처 시 버튼 영역 숨김 (이미지에 포함되지 않도록) */}
      <style dangerouslySetInnerHTML={{ __html: ".keyword-capture-hex .exclude-from-capture { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; }" }} />
      {/* 저장 완료 토스트: 최상단에서 내려왔다가 올라가는 안내 */}
      {saveToastState !== "hidden" && (
        <div
          className="fixed left-0 right-0 top-0 z-[9999] flex justify-center pt-4 transition-transform duration-300 ease-out"
          style={{
            transform:
              saveToastState === "exiting"
                ? "translateY(-100%)"
                : toastSlideDown
                  ? "translateY(0)"
                  : "translateY(-100%)",
          }}
        >
          <div className="rounded-lg bg-green-600/95 px-6 py-3 text-white font-medium shadow-lg backdrop-blur-sm border border-green-400/50">
            저장되었습니다.
          </div>
        </div>
      )}

      {/* 공유 코드 복사 토스트 */}
      {shareToastMessage && (
        <div className="fixed left-0 right-0 top-0 z-[9999] flex justify-center pt-4">
          <div className="rounded-lg bg-amber-600/95 px-6 py-3 text-white font-medium shadow-lg backdrop-blur-sm border border-amber-400/50 max-w-[90vw] truncate">
            {shareToastMessage}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirmFavoriteId !== null && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDeleteConfirmFavoriteId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-modal-title"
        >
          <div
            className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-modal-title" className="text-lg font-semibold text-yellow-300 mb-3">
              삭제 확인
            </h2>
            <p className="text-gray-400 text-sm mb-4">이 보고서를 삭제하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmFavoriteId(null)}
                className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => doDeleteFavorite(deleteConfirmFavoriteId)}
                disabled={deletingId !== null}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingId === deleteConfirmFavoriteId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 불러오기(공유 코드 입력) 모달: 1단계 조회 → 2단계 제목 입력 후 저장 */}
      {importShareModalOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-share-modal-title"
        >
          <div
            className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!importLookupResult ? (
              <>
                <h2 id="import-share-modal-title" className="text-lg font-semibold text-yellow-300 mb-3">
                  공유 코드 불러오기
                </h2>
                <p className="text-gray-400 text-sm mb-3">공유받은 코드를 붙여넣고 조회하세요.</p>
                <input
                  type="text"
                  value={importShareTokenInput}
                  onChange={(e) => setImportShareTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImportShareLookup(importShareTokenInput);
                    if (e.key === "Escape") closeImportShareModal();
                  }}
                  placeholder="공유 코드 붙여넣기"
                  className="w-full px-3 py-2.5 bg-[#2a2a2d] text-white rounded border border-[#b8860b]/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeImportShareModal}
                    className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImportShareLookup(importShareTokenInput)}
                    disabled={!importShareTokenInput.trim() || importing}
                    className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? "조회 중..." : "조회"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="import-share-modal-title" className="text-lg font-semibold text-yellow-300 mb-3">
                  보고서 명 입력
                </h2>
                <p className="text-gray-400 text-sm mb-3">저장할 보고서 명을 입력하세요. (중복 시 자동으로 (1), (2)가 붙습니다)</p>
                <input
                  type="text"
                  value={importSaveTitleInput}
                  onChange={(e) => setImportSaveTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImportShareSave();
                    if (e.key === "Escape") closeImportShareModal();
                  }}
                  placeholder="보고서 명"
                  className="w-full px-3 py-2.5 bg-[#2a2a2d] text-white rounded border border-[#b8860b]/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeImportShareModal}
                    className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleImportShareSave}
                    disabled={importing}
                    className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? "저장 중..." : "저장"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-black/60 z-0" />
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* 상단 탭 (스크롤 시 상단 고정) */}
          <div className="sticky top-16 z-[110] flex items-center gap-2 mb-6 flex-wrap py-2 -mx-4 px-4 bg-[#0d0d0f]/95 backdrop-blur-sm border-b border-[#b8860b]/20">
            <div className="flex gap-2">
              {TAB_LIST.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 rounded transition-colors ${
                    activeTab === key
                      ? "bg-yellow-400 text-black font-semibold"
                      : "bg-[#131316] border border-[#b8860b]/40 text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "egogift" ? (
            selectedFavoriteId !== null ? (
              <EgoGiftPageContent
                slotAboveSearch={favoritesPanel}
                embedded
                starredEgoGiftIds={starredEgoGiftIds}
                onStarClick={handleStarToggle}
                openEgoGiftPreviewRef={egoGiftPreviewOpenRef}
              />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/5 flex-shrink-0 order-1 lg:order-1 min-w-[240px]">
                  {favoritesPanel}
                </div>
                <div className="flex-1 order-2 lg:order-2">
                  <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                    <p className="text-gray-400">보고서를 생성/선택해주세요.</p>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === "cardpack" ? (
            selectedFavoriteId !== null ? (
              <CardPackPageContent
                slotAboveSearch={favoritesPanel}
                embedded
                starredCardPackIds={starredCardPackIds}
                onStarClick={handleCardPackStarToggle}
                openCardPackDetailRef={cardPackDetailOpenRef}
              />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/5 flex-shrink-0 order-1 lg:order-1 min-w-[240px]">
                  {favoritesPanel}
                </div>
                <div className="flex-1 order-2 lg:order-2">
                  <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                    <p className="text-gray-400">보고서를 생성/선택해주세요.</p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-1/5 flex-shrink-0 order-1 lg:order-1 min-w-[240px]">
                {favoritesPanel}
              </div>
              <div className="flex-1 order-2 lg:order-2">
                {activeTab === "result" && (
                  <div className="space-y-6">
                    {selectedFavoriteId === null ? (
                      <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                        <p className="text-gray-400">보고서를 생성/선택해주세요.</p>
                      </div>
                    ) : resultEgoGiftsLoading ? (
                      <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                        <p className="text-gray-400">불러오는 중...</p>
                      </div>
                    ) : starredEgoGiftIds.length === 0 && starredCardPackIds.length === 0 ? (
                      <div className="space-y-4">
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                          <p className="text-gray-400">저장된 카드팩이 없습니다. 카드팩 탭에서 별을 눌러 추가해보세요.</p>
                        </div>
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                          <p className="text-gray-400">저장된 에고기프트가 없습니다. 에고기프트 탭에서 별을 눌러 추가해보세요.</p>
                        </div>
                      </div>
                    ) : starredEgoGiftIds.length > 0 && resultEgoGiftsByKeyword.length === 0 && starredCardPackIds.length === 0 ? (
                      <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                        <p className="text-gray-400">표시할 에고기프트가 없습니다.</p>
                      </div>
                    ) : (
                      <>
                      {starredCardPackIds.length === 0 ? (
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6 mb-4">
                          <p className="text-gray-400">저장된 카드팩이 없습니다. 카드팩 탭에서 별을 눌러 추가해보세요.</p>
                        </div>
                      ) : (
                      <div ref={starredCardPacksSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 mb-4">
                        <div className="flex flex-wrap items-center gap-2 border-b border-[#b8860b]/40 pb-3 mb-3">
                          <button
                            type="button"
                            onClick={captureStarredCardPacksSectionAsImage}
                            className="text-base font-semibold text-yellow-200/90 text-left cursor-pointer hover:text-yellow-100 hover:underline focus:outline-none focus:underline"
                            title="클릭 시 선택한 카드팩 목록 영역 전체를 이미지로 저장"
                          >
                            선택한 카드팩 목록
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setResultCardPackDifficulty("노말")}
                              className={`px-2.5 py-1 text-sm rounded border transition-colors ${resultCardPackDifficulty === "노말" ? "border-[#b8860b]/60 bg-amber-500/20 text-amber-200" : "border-[#b8860b]/40 text-gray-300 hover:bg-white/5"}`}
                            >
                              노말
                            </button>
                            <button
                              type="button"
                              onClick={() => setResultCardPackDifficulty("하드")}
                              className={`px-2.5 py-1 text-sm rounded border transition-colors ${resultCardPackDifficulty === "하드" ? "border-[#e8a0a0]/70 bg-[#e8a0a0]/20 text-pink-200" : "border-[#e8a0a0]/50 text-gray-300 hover:bg-white/5"}`}
                            >
                              하드
                            </button>
                            <button
                              type="button"
                              onClick={() => setResultCardPackDifficulty("익스트림")}
                              className={`px-2.5 py-1 text-sm rounded border transition-colors ${resultCardPackDifficulty === "익스트림" ? "border-[#f87171]/70 bg-[#f87171]/20 text-red-200" : "border-[#f87171]/60 text-gray-300 hover:bg-white/5"}`}
                            >
                              평행중첩
                            </button>
                          </div>
                          <span className="w-px h-5 bg-[#b8860b]/40 shrink-0" aria-hidden />
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setResultCardPackFloor(null)}
                              className={`px-2 py-1 text-xs rounded border transition-colors ${resultCardPackFloor === null ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-[#b8860b]/30 text-gray-400 hover:bg-white/5 hover:text-gray-300"}`}
                            >
                              전체
                            </button>
                            {(resultCardPackDifficulty === "노말" || resultCardPackDifficulty === "하드"
                              ? Array.from({ length: 5 }, (_, i) => i + 1)
                              : Array.from({ length: 15 }, (_, i) => i + 1)
                            ).map((floor) => (
                              <button
                                key={floor}
                                type="button"
                                onClick={() => setResultCardPackFloor((prev) => (prev === floor ? null : floor))}
                                className={`px-2 py-1 text-xs rounded border transition-colors min-w-[2.25rem] ${resultCardPackFloor === floor ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-[#b8860b]/30 text-gray-400 hover:bg-white/5 hover:text-gray-300"}`}
                              >
                                {floor}층
                              </button>
                            ))}
                            <span className="w-px h-5 bg-[#b8860b]/40 shrink-0 ml-0.5" aria-hidden />
                            <button
                              type="button"
                              onClick={() => setCheckedCardPackByFloor({})}
                              disabled={Object.keys(checkedCardPackByFloor).length === 0}
                              className="px-2 py-1 text-xs rounded border border-cyan-400 bg-cyan-400/25 text-cyan-200 hover:bg-cyan-400/35 hover:text-cyan-100 transition-colors shadow-[0_0_12px_rgba(34,211,238,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-400/25 disabled:hover:text-cyan-200"
                              title="층별 선택 초기화"
                            >
                              선택 초기화
                            </button>
                          </div>
                        </div>
                        <div className={resultStarredCardPacks.length === 0 && !resultStarredCardPacksLoading ? "" : "min-h-[120px] rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]/50 p-4"}>
                          {resultStarredCardPacksLoading ? (
                            <p className="text-gray-400 text-sm">불러오는 중...</p>
                          ) : resultStarredCardPacks.length === 0 ? (
                            <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                              <p className="text-gray-400">저장된 카드팩이 없습니다. 카드팩 탭에서 별을 눌러 추가해보세요.</p>
                            </div>
                          ) : (() => {
                            const allowedByDifficulty: Record<string, string[]> = {
                              노말: ["노말"],
                              하드: ["하드"],
                              익스트림: ["하드", "익스트림"],
                            };
                            let displayedPacks = resultStarredCardPacks.filter((p) => {
                              const allowed = allowedByDifficulty[resultCardPackDifficulty];
                              return allowed && p.difficulties?.some((d) => allowed.includes(d) || (d === "평행중첩" && allowed.includes("익스트림")));
                            });
                            if (resultCardPackFloor != null) {
                              displayedPacks = displayedPacks.filter((p) => p.floors?.includes(resultCardPackFloor));
                            } else {
                              displayedPacks = [...displayedPacks].sort((a, b) => {
                                const floorsA = getFloorsWhereCardPackChecked(a.cardpackId);
                                const floorsB = getFloorsWhereCardPackChecked(b.cardpackId);
                                const minA = floorsA.length > 0 ? Math.min(...floorsA) : 999;
                                const minB = floorsB.length > 0 ? Math.min(...floorsB) : 999;
                                return minA - minB;
                              });
                            }
                            const filterDesc = [resultCardPackDifficulty && `난이도 ${resultCardPackDifficulty}`, resultCardPackFloor != null && `${resultCardPackFloor}층`].filter(Boolean).join(" · ");
                            return displayedPacks.length === 0 ? (
                              <p className="text-gray-500 text-sm">
                                {filterDesc ? `선택한 조건(${filterDesc})에 출현하는 카드팩이 없습니다.` : "출현하는 카드팩이 없습니다."}
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 min-[500px]:grid-cols-3 min-[770px]:grid-cols-4 lg:grid-cols-5 gap-4">
                                {displayedPacks.map((pack) => (
                                <div
                                  key={pack.cardpackId}
                                  data-cardpack-card
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => cardPackDetailOpenRef.current?.open(pack.cardpackId)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cardPackDetailOpenRef.current?.open(pack.cardpackId); } }}
                                  className="relative rounded border border-[#b8860b]/40 bg-[#131316]/80 overflow-hidden flex flex-col cursor-pointer hover:ring-2 hover:ring-yellow-400/50 transition-all"
                                >
                                  <div className="aspect-[3/4] flex-shrink-0 bg-[#1a1a1a] flex items-center justify-center">
                                    {pack.thumbnail ? (
                                      <img
                                        src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                        alt={pack.title}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      <span className="text-gray-500 text-xs">이미지 없음</span>
                                    )}
                                  </div>
                                  <div className="p-2 text-center">
                                    <p className="text-gray-200 text-sm font-medium break-words line-clamp-2">{pack.title}</p>
                                    {resultCardPackFloor == null && (() => {
                                      const floors = getFloorsWhereCardPackChecked(pack.cardpackId);
                                      return floors.length > 0 ? (
                                        <p className="text-yellow-400/90 text-xs mt-0.5">
                                          {floors.length === 1 ? `${floors[0]}층에서 선택됨` : `${floors.join(", ")}층에서 선택됨`}
                                        </p>
                                      ) : null;
                                    })()}
                                  </div>
                                  {resultCardPackFloor != null && !isCardPackCheckedOnOtherFloor(pack.cardpackId, resultCardPackFloor) && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleCardPackCheck(pack.cardpackId); }}
                                      className={`absolute top-2 right-2 w-9 h-9 rounded flex items-center justify-center transition-colors shadow-md border-2 border-blue-400 exclude-from-capture ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "bg-blue-500 hover:bg-blue-600" : "bg-black/70 hover:bg-black/90"}`}
                                      title={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                      aria-label={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "text-white" : "text-gray-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            );
                          })()}
                        </div>
                        {resultCardPackDifficulty != null && (
                          <div className="mt-6 pt-4 border-t border-[#b8860b]/30">
                            <div className="flex items-center gap-1.5 mb-2">
                              <h4 className="text-sm font-semibold text-yellow-200/80">놓친 한정 에고기프트 출현 카드팩</h4>
                              <span className="relative group">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#b8860b]/50 text-[#b8860b]/80 text-xs font-bold cursor-help">?</span>
                                <span className="absolute left-0 top-full mt-1.5 z-10 px-3 py-2 w-72 text-xs text-gray-200 bg-[#1a1a1d] border border-[#b8860b]/40 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
                                  선택한 에고기프트 중 한정 카드팩에서 출연하지만 해당 카드팩이 선택 목록에 저장되지 않은 경우 아래 영역에 표시됩니다.
                                </span>
                              </span>
                            </div>
                            {resultLimitedEgoGiftCardPacksLoading ? (
                              <p className="text-gray-400 text-sm">불러오는 중...</p>
                            ) : resultLimitedEgoGiftCardPacks.length === 0 ? (
                              <p className="text-gray-500 text-sm">해당 조건에 한정 에고기프트가 출현하는 카드팩이 없습니다.</p>
                            ) : (
                              <div className="grid grid-cols-2 min-[500px]:grid-cols-3 min-[770px]:grid-cols-4 lg:grid-cols-5 gap-4">
                                {(resultCardPackFloor == null
                                  ? [...resultLimitedEgoGiftCardPacks].sort((a, b) => {
                                      const floorsA = getFloorsWhereCardPackChecked(a.cardpackId);
                                      const floorsB = getFloorsWhereCardPackChecked(b.cardpackId);
                                      const minA = floorsA.length > 0 ? Math.min(...floorsA) : 999;
                                      const minB = floorsB.length > 0 ? Math.min(...floorsB) : 999;
                                      return minA - minB;
                                    })
                                  : resultLimitedEgoGiftCardPacks
                                ).map((pack) => (
                                  <div
                                    key={pack.cardpackId}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => cardPackDetailOpenRef.current?.open(pack.cardpackId)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cardPackDetailOpenRef.current?.open(pack.cardpackId); } }}
                                    className="relative rounded border border-amber-500/40 bg-[#131316]/80 overflow-hidden flex flex-col cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-all"
                                  >
                                    <div className="aspect-[3/4] flex-shrink-0 bg-[#1a1a1a] flex items-center justify-center">
                                      {pack.thumbnail ? (
                                        <img
                                          src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                          alt={pack.title}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <span className="text-gray-500 text-xs">이미지 없음</span>
                                      )}
                                    </div>
                                    <div className="p-2 text-center">
                                      <p className="text-gray-200 text-sm font-medium break-words line-clamp-2">{pack.title}</p>
                                      {resultCardPackFloor == null && (() => {
                                        const floors = getFloorsWhereCardPackChecked(pack.cardpackId);
                                        return floors.length > 0 ? (
                                          <p className="text-amber-400/90 text-xs mt-0.5">
                                            {floors.length === 1 ? `${floors[0]}층에서 선택됨` : `${floors.join(", ")}층에서 선택됨`}
                                          </p>
                                        ) : null;
                                      })()}
                                    </div>
                                    {resultCardPackFloor != null && !isCardPackCheckedOnOtherFloor(pack.cardpackId, resultCardPackFloor) && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleCardPackCheck(pack.cardpackId); }}
                                        className={`absolute top-2 right-2 w-9 h-9 rounded flex items-center justify-center transition-colors shadow-md border-2 border-blue-400 exclude-from-capture ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "bg-blue-500 hover:bg-blue-600" : "bg-black/70 hover:bg-black/90"}`}
                                        title={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                        aria-label={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "text-white" : "text-gray-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        )}
                      </div>
                      )}
                      {starredEgoGiftIds.length === 0 && (
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6 mb-4">
                          <p className="text-gray-400">저장된 에고기프트가 없습니다. 에고기프트 탭에서 별을 눌러 추가해보세요.</p>
                        </div>
                      )}
                      {starredEgoGiftIds.length > 0 && (
                      <div ref={allResultRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6">
                        <div className="flex flex-wrap items-center gap-2 border-b border-[#b8860b]/40 pb-4 mb-4">
                          <h2 className="text-lg font-semibold text-yellow-300">
                            키워드별 에고기프트
                          </h2>
                          <div className="exclude-from-capture flex flex-wrap items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => captureAllResultAsImage(false)}
                            className="px-3 py-1.5 text-sm rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-colors"
                            title="전체 키워드 + 합성 조합식 이미지로 저장"
                          >
                            전체 에고기프트 다운로드
                          </button>
                          <button
                            type="button"
                            onClick={() => captureAllResultAsImage(true)}
                            className="px-3 py-1.5 text-sm rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-colors"
                            title="전체 키워드만 저장 (합성 조합식 제외)"
                          >
                            전체 에고기프트 다운로드(합성제외)
                          </button>
                          <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setResultSimplified((prev) => !prev)}
                            className={`shrink-0 px-2 py-1.5 text-sm rounded border transition-colors flex items-center gap-1 ${resultSimplified ? "text-cyan-300 border-cyan-400/60 bg-cyan-500/20 hover:bg-cyan-500/30" : "text-gray-300 border-gray-400/40 hover:bg-white/10"}`}
                            title={resultSimplified ? "상세 보기로 원복" : "이름·출현카드팩·합성 여부만 표시"}
                          >
                            {resultSimplified ? "상세 보기" : "간소화"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allExpanded = resultEgoGiftsByKeyword.every(({ keyword }) => keywordGiftExpandedByKeyword[keyword] !== false);
                              if (allExpanded) {
                                setKeywordGiftExpandedByKeyword(
                                  resultEgoGiftsByKeyword.reduce<Record<string, boolean>>((acc, { keyword }) => ({ ...acc, [keyword]: false }), {})
                                );
                              } else {
                                setKeywordGiftExpandedByKeyword({});
                              }
                            }}
                            className="shrink-0 px-2 py-1.5 text-sm rounded text-amber-200 border border-amber-400/50 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                            title={resultEgoGiftsByKeyword.every(({ keyword }) => keywordGiftExpandedByKeyword[keyword] !== false) ? "키워드별 에고기프트 전체 접기" : "키워드별 에고기프트 전체 펼치기"}
                          >
                            {resultEgoGiftsByKeyword.every(({ keyword }) => keywordGiftExpandedByKeyword[keyword] !== false) ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                                <span>에고기프트 전체 접기</span>
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>에고기프트 전체 펼치기</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allExpanded = resultEgoGiftsByKeyword.every(({ keyword }) => synthesisExpandedByKeyword[keyword] !== false);
                              if (allExpanded) {
                                setSynthesisExpandedByKeyword(
                                  resultEgoGiftsByKeyword.reduce<Record<string, boolean>>((acc, { keyword }) => ({ ...acc, [keyword]: false }), {})
                                );
                              } else {
                                setSynthesisExpandedByKeyword({});
                              }
                            }}
                            className="shrink-0 px-2 py-1.5 text-sm rounded text-purple-300 border border-purple-400/40 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                            title={resultEgoGiftsByKeyword.every(({ keyword }) => synthesisExpandedByKeyword[keyword] !== false) ? "합성 조합식 전체 접기" : "합성 조합식 전체 펼치기"}
                          >
                            {resultEgoGiftsByKeyword.every(({ keyword }) => synthesisExpandedByKeyword[keyword] !== false) ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                                <span>합성 전체 접기</span>
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>합성 전체 펼치기</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCheckedEgoGiftIds([])}
                            className="shrink-0 px-2 py-1.5 text-sm rounded border border-cyan-400 bg-cyan-400/25 text-cyan-200 hover:bg-cyan-400/35 hover:text-cyan-100 transition-colors flex items-center gap-1 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                            title="에고기프트 체크 전체 해제"
                          >
                            전체 선택 해제
                          </button>
                          </div>
                          </div>
                        </div>
                        {resultEgoGiftsByKeyword.map(({ keyword, egogifts }, keywordIndex) => (
                          <ResultKeywordSection
                            key={keyword}
                            keyword={keyword}
                            egogifts={egogifts}
                            keywordIndex={keywordIndex}
                            resultSimplified={resultSimplified}
                            keywordGiftExpandedByKeyword={keywordGiftExpandedByKeyword}
                            setKeywordGiftExpandedByKeyword={setKeywordGiftExpandedByKeyword}
                            synthesisExpandedByKeyword={synthesisExpandedByKeyword}
                            setSynthesisExpandedByKeyword={setSynthesisExpandedByKeyword}
                            synthesisRecipes={synthesisRecipes}
                            resultEgoGifts={resultEgoGifts}
                            checkedEgoGiftIds={checkedEgoGiftIds}
                            onToggleEgoGiftCheck={toggleEgoGiftCheck}
                            sectionRef={(el) => { keywordSectionRefs.current[keyword] = el; }}
                            synthesisRef={(el) => { synthesisSectionRefs.current[keyword] = el; }}
                            onCaptureSection={captureSectionAsImage}
                            egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                          />
                        )) }
                      </div>
                      )}
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* 결과 탭에서 에고기프트/카드팩 클릭 시 상세 모달을 열기 위해 숨겨서 마운트 */}
              {activeTab === "result" && (
                <div className="hidden" aria-hidden="true">
                  <EgoGiftPageContent
                    slotAboveSearch={null}
                    embedded
                    starredEgoGiftIds={starredEgoGiftIds}
                    onStarClick={handleStarToggle}
                    openEgoGiftPreviewRef={egoGiftPreviewOpenRef}
                  />
                  <CardPackPageContent
                    slotAboveSearch={null}
                    embedded
                    starredCardPackIds={starredCardPackIds}
                    onStarClick={handleCardPackStarToggle}
                    openCardPackDetailRef={cardPackDetailOpenRef}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

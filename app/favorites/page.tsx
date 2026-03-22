"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  /** 1: 레거시, 2: 신규 (API 미배포 시 없으면 1로 간주) */
  schemaVersion?: number;
}

type FavoritesTab = "egogift" | "result";

const TAB_LIST: { key: FavoritesTab; label: string }[] = [
  { key: "result", label: "파우스트의 보고서" },
  { key: "egogift", label: "에고기프트" },
];

/** 스키마 v2: 진행 예정 층 행 — 1행 1~5, 2행 6~10, 3행 11~15 */
const V2_FLOOR_ROWS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
] as const;
type V2PlannedRowCount = 1 | 2 | 3;
type V2PlannedFloor = (typeof V2_FLOOR_ROWS)[number][number];

function inferV2PlannedRowCountFromFloorMap(byFloor: Record<number, number>): V2PlannedRowCount {
  const floors = Object.keys(byFloor).map(Number);
  if (floors.some((f) => f >= 11 && f <= 15)) return 3;
  if (floors.some((f) => f >= 6 && f <= 10)) return 2;
  return 1;
}

function parseV2PlannedRowCount(raw: unknown, byFloor: Record<number, number>): V2PlannedRowCount {
  const n = typeof raw === "number" ? raw : Number(raw);
  const explicit =
    n === 1 || n === 2 || n === 3 ? n : null;
  const inferred = inferV2PlannedRowCountFromFloorMap(byFloor);
  const merged = Math.max(explicit ?? 1, inferred);
  return (merged >= 3 ? 3 : merged >= 2 ? 2 : 1) as V2PlannedRowCount;
}

/** v2 모달 탭(노말/하드/익스트림) — 선택 시 층별로 저장 */
type V2PlannedDifficultyKey = "노말" | "하드" | "익스트림";

function parsePlannedCardPackDifficultyByFloor(raw: unknown): Record<number, V2PlannedDifficultyKey> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<number, V2PlannedDifficultyKey> = {};
  for (const [ks, val] of Object.entries(raw as Record<string, unknown>)) {
    const k = Number(ks);
    if (Number.isNaN(k)) continue;
    const s = String(val);
    if (s === "노말") out[k] = "노말";
    else if (s === "하드") out[k] = "하드";
    else if (s === "익스트림" || s === "평행중첩") out[k] = "익스트림";
  }
  return out;
}

function v2DifficultySlotLabel(d: V2PlannedDifficultyKey): string {
  return d === "익스트림" ? "평행중첩" : d;
}

function v2SlotBorderClass(d: V2PlannedDifficultyKey | undefined): string {
  if (!d) return "border-[#b8860b]/50 hover:border-yellow-400/60";
  if (d === "노말") return "border-lime-400/90 hover:border-lime-300 ring-1 ring-lime-400/30";
  if (d === "하드") return "border-pink-400/90 hover:border-pink-300 ring-1 ring-pink-400/30";
  return "border-red-500 hover:border-red-400 ring-1 ring-red-500/40";
}

/** 모달 열 때 층별 난이도 탭 초기값: 1~5 노말, 6층 이상 익스트림(평행중첩) */
function getV2ModalDefaultDifficultyForFloor(floor: number): V2PlannedDifficultyKey {
  if (floor >= 6) return "익스트림";
  return "노말";
}

const MODAL_DIFFICULTY_ALLOWED: Record<string, string[]> = {
  노말: ["노말"],
  하드: ["하드"],
  익스트림: ["하드", "익스트림"],
};

/** v2 모달 → for-limited-starred-egogifts API (탭별 난이도 파라미터) */
const V2_MODAL_TAB_API_DIFFICULTIES: Record<V2PlannedDifficultyKey, readonly string[]> = {
  노말: ["노말"],
  하드: ["하드"],
  익스트림: ["하드", "익스트림"],
};

interface PlannableCardPack {
  cardpackId: number;
  title: string;
  thumbnail?: string;
  floors: number[];
  difficulties: string[];
  /** API가 내려주면 탭(노말/하드/익스트림)별로 출현 층을 정확히 필터 */
  difficultyFloors?: Array<{ difficulty: string; floors: number[] }>;
}

function parseDifficultyFloorsFromRow(row: Record<string, unknown>): Array<{ difficulty: string; floors: number[] }> | undefined {
  const df = row.difficultyFloors;
  if (!Array.isArray(df) || df.length === 0) return undefined;
  const out: Array<{ difficulty: string; floors: number[] }> = [];
  for (const item of df as { difficulty?: unknown; floors?: unknown[] }[]) {
    const diff = item?.difficulty != null ? String(item.difficulty) : "";
    if (!diff) continue;
    const floors = Array.isArray(item?.floors)
      ? (item.floors as unknown[]).map((x) => Number(x)).filter((n) => !Number.isNaN(n))
      : [];
    if (floors.length > 0) out.push({ difficulty: diff, floors });
  }
  return out.length > 0 ? out : undefined;
}

function parsePlannableCardPackRow(row: Record<string, unknown>): PlannableCardPack | null {
  const id = Number(row.cardpackId);
  if (!id) return null;
  let floors: number[] = Array.isArray(row.floors)
    ? (row.floors as unknown[]).map((x) => Number(x)).filter((n) => !Number.isNaN(n))
    : [];
  const difficultyFloors = parseDifficultyFloorsFromRow(row);
  if (floors.length === 0 && difficultyFloors?.length) {
    const s = new Set<number>();
    for (const item of difficultyFloors) {
      for (const f of item.floors) s.add(f);
    }
    floors = [...s].sort((a, b) => a - b);
  }
  const difficulties = Array.isArray(row.difficulties)
    ? (row.difficulties as unknown[]).map((x) => String(x))
    : [];
  return {
    cardpackId: id,
    title: String(row.title ?? ""),
    thumbnail: row.thumbnail != null ? String(row.thumbnail) : undefined,
    floors,
    difficulties,
    difficultyFloors,
  };
}

/** 모달 탭(노말/하드/익스트림)과 DB 난이도 문자열이 같은 출현 행에 매칭되는지 */
function entryDifficultyMatchesModalTab(entryDifficulty: string, modalTab: string): boolean {
  const allowed = MODAL_DIFFICULTY_ALLOWED[modalTab];
  if (!allowed?.length) return true;
  if (allowed.includes(entryDifficulty)) return true;
  if (modalTab === "익스트림" && entryDifficulty === "평행중첩") return true;
  return false;
}

function packMatchesFloorAndModalDifficulty(
  pack: PlannableCardPack,
  floor: number,
  difficultyKey: string
): boolean {
  const dfs = pack.difficultyFloors;
  if (dfs && dfs.length > 0) {
    return dfs.some(
      (block) =>
        entryDifficultyMatchesModalTab(block.difficulty, difficultyKey) && block.floors.includes(floor)
    );
  }
  // 레거시: 난이도별 층 미제공 시 기존(합집합 floors + 난이도 목록) 로직
  if (!pack.floors.includes(floor)) return false;
  const allowed = MODAL_DIFFICULTY_ALLOWED[difficultyKey];
  if (!allowed?.length) return true;
  if (pack.difficulties.length === 0) return true;
  return pack.difficulties.some(
    (d) => allowed.includes(d) || (d === "평행중첩" && difficultyKey === "익스트림")
  );
}

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

/** 한정 에고기프트 ID 집합 동일 여부 (순서 무관) */
function limitedEgoGiftIdSetsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** smaller가 larger의 진부분집합인지 (이미 정렬된 배열 기준으로도 동작) */
function isProperSubsetById(smaller: number[], larger: number[]): boolean {
  if (smaller.length >= larger.length) return false;
  const setL = new Set(larger);
  return smaller.every((id) => setL.has(id));
}

type MissedLimitedFetchSnapshot = {
  limitedIdsSorted: number[];
  excludeIdsSorted: number[];
  schemaVersion: number;
  /** v2: "v2:all" / v1: 난이도·층 */
  filterKey: string;
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
  /** 보고서에 포함된 카드팩 ID (JSON 동기화, 결과 탭 표시용) */
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
  /** 이전 starredEgoGiftIds — X로 일부만 제거할 때 전체 패널 로딩(불러오는 중) 스킵용 */
  const prevStarredEgoGiftIdsForResultFetchRef = useRef<number[]>([]);
  /** 놓친 한정 카드팩 마지막 조회 스냅샷 — 동일 조건·동일 한정 ID면 재요청 생략, 한정 ID만 감소 시 로딩 스킵 */
  const missedLimitedLastFetchSnapshotRef = useRef<MissedLimitedFetchSnapshot | null>(null);
  /** 스키마 v2+ 자동 저장: 보고서 전환·불러오기 직후 1회는 저장 스킵 */
  const v2AutosaveSkipNextRef = useRef(true);
  /** 키워드별 카드 영역만 캡처용 (키워드 클릭 시, 합성 조합식 제외) */
  const keywordSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 키워드별 합성 조합식 영역만 캡처용 (조합식 클릭 시) */
  const synthesisSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 전체 결과 영역 캡처용 (전체 다운로드 / 전체 다운로드 합성제외) */
  const allResultRef = useRef<HTMLDivElement | null>(null);
  /** 선택한 카드팩 목록 섹션 전체 캡처용 */
  const starredCardPacksSectionRef = useRef<HTMLDivElement | null>(null);
  /** 스키마 v2 진행(예정) 카드팩 그리드 섹션 캡처용 */
  const v2PlannedCardPacksSectionRef = useRef<HTMLDivElement | null>(null);
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
  /** 놓친 한정 에고기프트 출현 카드팩 영역 펼침 (v1·v2 공통) */
  const [missedLimitedCardPacksExpanded, setMissedLimitedCardPacksExpanded] = useState(true);
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

  /** 결과 탭 키워드별 카드에서 즐겨찾기(보고서에 포함된 에고기프트) 해제 */
  const removeStarredEgoGift = (egogiftId: number) => {
    setStarredEgoGiftIds((prev) => prev.filter((id) => id !== egogiftId));
    setCheckedEgoGiftIds((prev) => prev.filter((id) => id !== egogiftId));
    setResultEgoGifts((prev) => prev.filter((eg) => eg.egogiftId !== egogiftId));
    setSynthesisRecipes((prev) => prev.filter((r) => r.resultEgogiftId !== egogiftId));
  };

  const handleCardPackStarToggle = (cardpackId: number) => {
    setStarredCardPackIds((prev) =>
      prev.includes(cardpackId) ? prev.filter((id) => id !== cardpackId) : [...prev, cardpackId]
    );
  };

  /** 선택 중인 보고서의 스키마 버전 (2일 때 진행 예정 카드팩 그리드 등) */
  const selectedReportSchemaVersion = useMemo(() => {
    if (selectedFavoriteId == null) return 1;
    const item = items.find((i) => i.favoriteId === selectedFavoriteId);
    const v = item?.schemaVersion;
    return v === 2 ? 2 : 1;
  }, [selectedFavoriteId, items]);

  /** 스키마 2 이상 보고서 (자동 저장 등) */
  const favoriteSchemaV2OrHigher = useMemo(() => {
    if (selectedFavoriteId == null) return false;
    const item = items.find((i) => i.favoriteId === selectedFavoriteId);
    return (item?.schemaVersion ?? 1) >= 2;
  }, [selectedFavoriteId, items]);

  /** 스키마 v2: 전체 카드팩 목록 (층·난이도 필터는 프론트에서 분류) */
  const [plannableCardPacks, setPlannableCardPacks] = useState<PlannableCardPack[]>([]);
  const [plannableCardPacksLoading, setPlannableCardPacksLoading] = useState(false);
  /** v2: N층 슬롯 클릭 시 출현 카드팩 선택 모달 */
  const [v2FloorModalFloor, setV2FloorModalFloor] = useState<V2PlannedFloor | null>(null);
  const [v2ModalDifficulty, setV2ModalDifficulty] = useState<V2PlannedDifficultyKey>("노말");
  const [v2ModalTitleSearch, setV2ModalTitleSearch] = useState("");
  /** v2 모달: 즐겨찾기 한정 에고기프트가 이 층·난이도에서 나올 수 있는 카드팩 ID */
  const [v2ModalLimitedHighlightIds, setV2ModalLimitedHighlightIds] = useState<number[]>([]);
  /** v2: 층별 카드팩 선택 시 모달에서 고른 난이도 탭 (저장 JSON: plannedCardPackDifficultyByFloor) */
  const [plannedCardPackDifficultyByFloor, setPlannedCardPackDifficultyByFloor] = useState<
    Record<number, V2PlannedDifficultyKey>
  >({});
  /** v2: 진행 예정 그리드 행 수 (1=1~5층만, 2=+6~10, 3=+11~15). JSON: plannedFloorRowCount */
  const [v2PlannedFloorRowCount, setV2PlannedFloorRowCount] = useState<V2PlannedRowCount>(1);
  const [portalMounted, setPortalMounted] = useState(false);
  useEffect(() => {
    setPortalMounted(true);
  }, []);

  const commitV2FloorSelection = useCallback(
    (floor: V2PlannedFloor, packId: number | null, difficultyWhenSelected?: V2PlannedDifficultyKey) => {
      setCheckedCardPackByFloor((prev) => {
        const next = { ...prev };
        if (packId == null) {
          delete next[floor];
        } else {
          next[floor] = packId;
        }
        const ids = [
          ...new Set(
            Object.values(next).filter((x): x is number => typeof x === "number" && !Number.isNaN(x) && x > 0)
          ),
        ];
        setStarredCardPackIds(ids);
        return next;
      });
      setPlannedCardPackDifficultyByFloor((prev) => {
        const next = { ...prev };
        if (packId == null) {
          delete next[floor];
        } else if (difficultyWhenSelected) {
          next[floor] = difficultyWhenSelected;
        }
        return next;
      });
      setV2FloorModalFloor(null);
    },
    []
  );

  const addV2PlannedFloorRow = useCallback(() => {
    setV2PlannedFloorRowCount((prev) => (prev >= 3 ? 3 : ((prev + 1) as V2PlannedRowCount)));
  }, []);

  const removeLastV2PlannedFloorRow = useCallback(() => {
    setV2PlannedFloorRowCount((prev) => {
      if (prev <= 1) return 1;
      const rowFloors = [...V2_FLOOR_ROWS[prev - 1]];
      setCheckedCardPackByFloor((c) => {
        const next = { ...c };
        for (const f of rowFloors) delete next[f];
        const ids = [
          ...new Set(
            Object.values(next).filter((x): x is number => typeof x === "number" && !Number.isNaN(x) && x > 0)
          ),
        ];
        setStarredCardPackIds(ids);
        return next;
      });
      setPlannedCardPackDifficultyByFloor((p) => {
        const next = { ...p };
        for (const f of rowFloors) delete next[f];
        return next;
      });
      return (prev - 1) as V2PlannedRowCount;
    });
  }, []);

  useEffect(() => {
    if (selectedFavoriteId == null || selectedReportSchemaVersion !== 2) {
      setPlannableCardPacks([]);
      setV2PlannedFloorRowCount(1);
      return;
    }
    let cancelled = false;
    setPlannableCardPacksLoading(true);
    fetch(`${API_BASE_URL}/user/cardpack?page=1&size=1000`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: unknown[] }) => {
        if (cancelled) return;
        const rows = (data.items ?? [])
          .map((row: unknown) => parsePlannableCardPackRow(row as Record<string, unknown>))
          .filter(Boolean) as PlannableCardPack[];
        setPlannableCardPacks(rows);
      })
      .catch(() => {
        if (!cancelled) setPlannableCardPacks([]);
      })
      .finally(() => {
        if (!cancelled) setPlannableCardPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFavoriteId, selectedReportSchemaVersion]);

  const v2ModalFilteredPacks = useMemo(() => {
    if (v2FloorModalFloor == null) return [];
    return plannableCardPacks.filter((p) =>
      packMatchesFloorAndModalDifficulty(p, v2FloorModalFloor, v2ModalDifficulty)
    );
  }, [plannableCardPacks, v2FloorModalFloor, v2ModalDifficulty]);

  const v2ModalDisplayPacks = useMemo(() => {
    const q = v2ModalTitleSearch.trim().toLowerCase();
    if (!q) return v2ModalFilteredPacks;
    return v2ModalFilteredPacks.filter((p) => p.title.toLowerCase().includes(q));
  }, [v2ModalFilteredPacks, v2ModalTitleSearch]);

  const v2ModalLimitedIdSet = useMemo(() => new Set(v2ModalLimitedHighlightIds), [v2ModalLimitedHighlightIds]);

  /** 층 모달 열 때 난이도·검색 초기화 — layout에서 먼저 반영해 한정 하이라이트 조회와 탭이 맞물리게 함 */
  useLayoutEffect(() => {
    if (v2FloorModalFloor != null) {
      setV2ModalDifficulty(getV2ModalDefaultDifficultyForFloor(v2FloorModalFloor));
      setV2ModalTitleSearch("");
    }
  }, [v2FloorModalFloor]);

  // v2 모달: 즐겨찾기 중 한정 카테고리 에고기프트가 출현 가능한 카드팩 (현재 층·난이도 탭 기준, 제외 필터 없음)
  useEffect(() => {
    if (v2FloorModalFloor == null || activeTab !== "result") {
      setV2ModalLimitedHighlightIds([]);
      return;
    }
    const difficulties = V2_MODAL_TAB_API_DIFFICULTIES[v2ModalDifficulty];
    const limitedStarredEgoGiftIds = resultEgoGifts
      .filter((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0)
      .map((eg) => eg.egogiftId);
    if (!difficulties?.length || limitedStarredEgoGiftIds.length === 0) {
      setV2ModalLimitedHighlightIds([]);
      return;
    }
    let cancelled = false;
    const difficultyParams = difficulties.map((d) => `difficulties=${encodeURIComponent(d)}`).join("&");
    const egogiftParams = limitedStarredEgoGiftIds.map((id) => `egogiftIds=${id}`).join("&");
    const query = `${difficultyParams}&floor=${v2FloorModalFloor}&${egogiftParams}`;
    fetch(`${API_BASE_URL}/user/cardpack/for-limited-starred-egogifts?${query}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: unknown[] }) => {
        if (cancelled) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setV2ModalLimitedHighlightIds(
          items
            .map((item) => Number((item as { cardpackId?: unknown }).cardpackId))
            .filter((id) => !Number.isNaN(id) && id > 0)
        );
      })
      .catch(() => {
        if (!cancelled) setV2ModalLimitedHighlightIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [v2FloorModalFloor, v2ModalDifficulty, resultEgoGifts, activeTab]);

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
        const rawList = data.items ?? [];
        const list: FavoriteItem[] = rawList.map((raw: Record<string, unknown>) => ({
          favoriteId: Number(raw.favoriteId),
          pageType: String(raw.pageType ?? ""),
          searchJson: String(raw.searchJson ?? "{}"),
          createdAt: String(raw.createdAt ?? ""),
          updatedAt: String(raw.updatedAt ?? ""),
          schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1,
        }));
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

  useEffect(() => {
    missedLimitedLastFetchSnapshotRef.current = null;
  }, [selectedFavoriteId]);

  // 결과 탭: 선택한 즐겨찾기의 에고기프트 ID로 목록 조회 후 키워드별 표시용으로 저장
  useEffect(() => {
    if (activeTab !== "result" || starredEgoGiftIds.length === 0) {
      setResultEgoGifts([]);
      setResultEgoGiftsLoading(false);
      if (starredEgoGiftIds.length === 0) {
        prevStarredEgoGiftIdsForResultFetchRef.current = [];
      }
      return;
    }
    const prevIds = prevStarredEgoGiftIdsForResultFetchRef.current;
    const prevSet = new Set(prevIds);
    const isStrictSubsetRemoval =
      prevIds.length > starredEgoGiftIds.length &&
      starredEgoGiftIds.every((id) => prevSet.has(id));
    prevStarredEgoGiftIdsForResultFetchRef.current = [...starredEgoGiftIds];

    let cancelled = false;
    if (!isStrictSubsetRemoval) {
      setResultEgoGiftsLoading(true);
    }
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

  // 결과 탭: 선택한 카드팩 목록 ID 목록으로 조회 (v2는 진행 예정 슬롯만 사용 — 중복 목록 없음)
  useEffect(() => {
    if (activeTab !== "result" || starredCardPackIds.length === 0 || selectedReportSchemaVersion === 2) {
      setResultStarredCardPacks([]);
      if (selectedReportSchemaVersion === 2) setResultStarredCardPacksLoading(false);
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
  }, [activeTab, starredCardPackIds, selectedReportSchemaVersion]);

  // 결과 탭: 한정 즐겨찾기 에고기프트 출현 카드팩 중 아직 선택 목록에 없는 것 (v1: 난이도·층 필터 / v2: 전 난이도·전 층)
  useEffect(() => {
    const difficulty = resultCardPackDifficulty;
    const floor = resultCardPackFloor;
    if (activeTab !== "result") {
      setResultLimitedEgoGiftCardPacks([]);
      setResultLimitedEgoGiftCardPacksLoading(false);
      missedLimitedLastFetchSnapshotRef.current = null;
      return;
    }
    const limitedStarredEgoGiftIds = resultEgoGifts
      .filter((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0)
      .map((eg) => eg.egogiftId);
    if (limitedStarredEgoGiftIds.length === 0) {
      setResultLimitedEgoGiftCardPacks([]);
      setResultLimitedEgoGiftCardPacksLoading(false);
      missedLimitedLastFetchSnapshotRef.current = null;
      return;
    }

    let difficulties: string[];
    let floorParam: number | null | undefined;

    if (selectedReportSchemaVersion === 2) {
      // 스키마 v2: 노말·하드·익스트림 전체, 층 미지정(모든 층) — 진행 예정 슬롯에 넣지 않은 카드팩 표시
      difficulties = ["노말", "하드", "익스트림"];
      floorParam = null;
    } else {
      if (difficulty == null) {
        setResultLimitedEgoGiftCardPacks([]);
        setResultLimitedEgoGiftCardPacksLoading(false);
        missedLimitedLastFetchSnapshotRef.current = null;
        return;
      }
      const allowedByDifficulty: Record<string, string[]> = {
        노말: ["노말"],
        하드: ["하드"],
        익스트림: ["하드", "익스트림"],
      };
      const d = allowedByDifficulty[difficulty];
      if (!d?.length) {
        setResultLimitedEgoGiftCardPacks([]);
        setResultLimitedEgoGiftCardPacksLoading(false);
        missedLimitedLastFetchSnapshotRef.current = null;
        return;
      }
      difficulties = [...d];
      floorParam = floor;
    }

    const curLimitedSorted = [...limitedStarredEgoGiftIds].sort((a, b) => a - b);
    const curExcludeSorted = [...starredCardPackIds].sort((a, b) => a - b);
    const filterKey =
      selectedReportSchemaVersion === 2
        ? "v2:all"
        : `v1:${difficulty}:${floor === null ? "all" : floor}`;
    const snap = missedLimitedLastFetchSnapshotRef.current;
    const contextMatch =
      snap != null &&
      snap.schemaVersion === selectedReportSchemaVersion &&
      snap.filterKey === filterKey &&
      limitedEgoGiftIdSetsEqual(snap.excludeIdsSorted, curExcludeSorted);
    // 한정이 아닌 에고기프트만 제거한 경우: 조회 생략(깜빡임 방지)
    if (contextMatch && limitedEgoGiftIdSetsEqual(snap.limitedIdsSorted, curLimitedSorted)) {
      return;
    }
    const skipMissedLimitedLoading =
      contextMatch && snap != null && isProperSubsetById(curLimitedSorted, snap.limitedIdsSorted);

    let cancelled = false;
    if (!skipMissedLimitedLoading) {
      setResultLimitedEgoGiftCardPacksLoading(true);
    }
    const difficultyParams = difficulties.map((d) => `difficulties=${encodeURIComponent(d)}`).join("&");
    const egogiftParams = limitedStarredEgoGiftIds.map((id) => `egogiftIds=${id}`).join("&");
    const excludeParams = starredCardPackIds.length > 0 ? starredCardPackIds.map((id) => `excludeCardpackIds=${id}`).join("&") : "";
    const floorParamStr = floorParam != null ? `floor=${floorParam}` : "";
    const query = [difficultyParams, floorParamStr, egogiftParams, excludeParams].filter(Boolean).join("&");
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
        missedLimitedLastFetchSnapshotRef.current = {
          limitedIdsSorted: curLimitedSorted,
          excludeIdsSorted: curExcludeSorted,
          schemaVersion: selectedReportSchemaVersion,
          filterKey,
        };
      })
      .catch(() => {
        if (!cancelled) {
          setResultLimitedEgoGiftCardPacks([]);
          missedLimitedLastFetchSnapshotRef.current = null;
        }
      })
      .finally(() => {
        if (!cancelled) setResultLimitedEgoGiftCardPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, resultCardPackDifficulty, resultCardPackFloor, resultEgoGifts, starredCardPackIds, selectedReportSchemaVersion]);

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
        await document.fonts.ready;
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
        await document.fonts.ready;
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
        await document.fonts.ready;
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

  /** 카드팩 목록형 섹션 DOM → PNG (선택한 카드팩 / 진행 예정 등 공통) */
  const captureCardPackListRegionAsImage = useCallback(
    async (el: HTMLElement | null, fileNameMiddle: string) => {
      if (!el || typeof window === "undefined") return;
      const favoriteTitle = getFavoriteTitle();
      const dateStr = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      })();
      const baseName = `${favoriteTitle}_${fileNameMiddle}_${dateStr}.png`;

      const restores: { img: HTMLImageElement; originalSrc: string; blobUrl: string }[] = [];
      try {
        const imgs = el.querySelectorAll<HTMLImageElement>("img[src]");
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
          try {
            const absUrl = new URL(src, window.location.href).href;
            // 동일 출처도 blob으로 바꿔 html2canvas가 썸네일을 안정적으로 그리도록 (진행 예정 슬롯 등)
            let res = await fetch(absUrl, { credentials: "include", mode: "cors" }).catch(() => null);
            if (!res?.ok) {
              const proxyUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(absUrl)}`;
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
        const prevMinHeight = el.style.minHeight;
        el.style.minHeight = `${el.scrollHeight}px`;
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await new Promise<void>((r) => setTimeout(r, 80));
        await document.fonts.ready;
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
        el.style.minHeight = prevMinHeight;
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
        el.style.minHeight = "";
        el.classList.remove("keyword-capture-hex");
        for (const { img, originalSrc, blobUrl } of restores) {
          img.src = originalSrc;
          URL.revokeObjectURL(blobUrl);
        }
        console.error("카드팩 목록 영역 캡처 실패:", err);
      }
    },
    [getFavoriteTitle]
  );

  const captureStarredCardPacksSectionAsImage = useCallback(async () => {
    await captureCardPackListRegionAsImage(starredCardPacksSectionRef.current, "즐겨찾기한카드팩");
  }, [captureCardPackListRegionAsImage]);

  const captureV2PlannedCardPacksSectionAsImage = useCallback(async () => {
    await captureCardPackListRegionAsImage(v2PlannedCardPacksSectionRef.current, "진행예정카드팩목록");
  }, [captureCardPackListRegionAsImage]);

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
      plannedCardPackDifficultyByFloor: {} as Record<string, string>,
      plannedFloorRowCount: 1,
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
        setPlannedCardPackDifficultyByFloor({});
        setV2PlannedFloorRowCount(1);
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

  /** 선택된 즐겨찾기 전체 저장 (상단 저장 버튼·스키마 v2+ 자동 저장) */
  const handleSave = useCallback(async () => {
    if (selectedFavoriteId === null) return;
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    const existing = items.find((i) => i.favoriteId === selectedFavoriteId);
    let parsed: {
      title?: string;
      egogiftIds?: number[];
      cardPackIds?: number[];
      cardPackDifficulty?: string;
      cardPackCheckedByFloor?: Record<string, number>;
      plannedCardPackDifficultyByFloor?: Record<string, string>;
      plannedFloorRowCount?: number;
      checkedEgoGiftIds?: number[];
    } = {};
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
      egogiftIds: starredEgoGiftIds,
      cardPackIds: starredCardPackIds,
      cardPackDifficulty: resultCardPackDifficulty,
      cardPackCheckedByFloor: Object.fromEntries(Object.entries(checkedCardPackByFloor).map(([k, v]) => [String(k), v])),
      plannedCardPackDifficultyByFloor: Object.fromEntries(
        Object.entries(plannedCardPackDifficultyByFloor).map(([k, v]) => [String(k), v])
      ),
      plannedFloorRowCount: v2PlannedFloorRowCount,
      checkedEgoGiftIds: checkedEgoGiftIds,
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
  }, [
    selectedFavoriteId,
    items,
    titleInput,
    starredEgoGiftIds,
    starredCardPackIds,
    resultCardPackDifficulty,
    checkedCardPackByFloor,
    plannedCardPackDifficultyByFloor,
    v2PlannedFloorRowCount,
    checkedEgoGiftIds,
    fetchFavorites,
  ]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const prevTabForV2AutosaveRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabForV2AutosaveRef.current !== "result" && activeTab === "result") {
      v2AutosaveSkipNextRef.current = true;
    }
    prevTabForV2AutosaveRef.current = activeTab;
  }, [activeTab]);

  /** 스키마 v2 이상 + 결과 탭: 층별 카드팩·에고기프트 목록 등 변경 시 자동 저장 (handleSave는 ref로 호출해 저장 후 items 갱신으로 재트리거 방지) */
  useEffect(() => {
    if (!favoriteSchemaV2OrHigher || activeTab !== "result" || selectedFavoriteId == null) return;
    if (v2AutosaveSkipNextRef.current) {
      v2AutosaveSkipNextRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void handleSaveRef.current();
    }, 150);
    return () => window.clearTimeout(t);
  }, [
    favoriteSchemaV2OrHigher,
    activeTab,
    selectedFavoriteId,
    checkedCardPackByFloor,
    starredCardPackIds,
    plannedCardPackDifficultyByFloor,
    v2PlannedFloorRowCount,
    starredEgoGiftIds,
    checkedEgoGiftIds,
    resultCardPackDifficulty,
  ]);

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
          plannedCardPackDifficultyByFloor?: Record<string, string>;
          plannedFloorRowCount?: number;
          checkedEgoGiftIds?: number[];
        };
        v2AutosaveSkipNextRef.current = true;
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
        setPlannedCardPackDifficultyByFloor(parsePlannedCardPackDifficultyByFloor(parsed.plannedCardPackDifficultyByFloor));
        setV2PlannedFloorRowCount(parseV2PlannedRowCount(parsed.plannedFloorRowCount, byFloor as Record<number, number>));
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
          setPlannedCardPackDifficultyByFloor({});
          setV2PlannedFloorRowCount(1);
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
                      v2AutosaveSkipNextRef.current = true;
                      setSelectedFavoriteId(item.favoriteId);
                      try {
                        const parsed = JSON.parse(item.searchJson) as {
                          title?: string;
                          egogiftIds?: number[];
                          cardPackIds?: number[];
                          cardPackDifficulty?: string;
                          cardPackCheckedByFloor?: Record<string, number>;
                          plannedCardPackDifficultyByFloor?: Record<string, string>;
                          plannedFloorRowCount?: number;
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
                        setPlannedCardPackDifficultyByFloor(parsePlannedCardPackDifficultyByFloor(parsed.plannedCardPackDifficultyByFloor));
                        setV2PlannedFloorRowCount(parseV2PlannedRowCount(parsed.plannedFloorRowCount, byFloor as Record<number, number>));
                        setCheckedEgoGiftIds(Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []);
                      } catch {
                        setTitleInput("");
                        setStarredEgoGiftIds([]);
                        setStarredCardPackIds([]);
                        setResultCardPackDifficulty("노말");
                        setCheckedCardPackByFloor({});
                        setPlannedCardPackDifficultyByFloor({});
                        setV2PlannedFloorRowCount(1);
                        setCheckedEgoGiftIds([]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (deletingId === item.favoriteId || editingFavoriteId === item.favoriteId) return;
                        v2AutosaveSkipNextRef.current = true;
                        setSelectedFavoriteId(item.favoriteId);
                        try {
                          const parsed = JSON.parse(item.searchJson) as {
                            title?: string;
                            egogiftIds?: number[];
                            cardPackIds?: number[];
                            cardPackDifficulty?: string;
                            cardPackCheckedByFloor?: Record<string, number>;
                            plannedCardPackDifficultyByFloor?: Record<string, string>;
                            plannedFloorRowCount?: number;
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
                          setPlannedCardPackDifficultyByFloor(parsePlannedCardPackDifficultyByFloor(parsed.plannedCardPackDifficultyByFloor));
                          setV2PlannedFloorRowCount(parseV2PlannedRowCount(parsed.plannedFloorRowCount, byFloor as Record<number, number>));
                          setCheckedEgoGiftIds(Array.isArray(parsed.checkedEgoGiftIds) ? parsed.checkedEgoGiftIds : []);
                        } catch {
                          setTitleInput("");
                          setStarredEgoGiftIds([]);
                          setStarredCardPackIds([]);
                          setResultCardPackDifficulty("노말");
                          setCheckedCardPackByFloor({});
                          setPlannedCardPackDifficultyByFloor({});
                          setV2PlannedFloorRowCount(1);
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
                        <span className="shrink-0 text-xs text-gray-500 tabular-nums select-none" title="스키마 버전">
                          ver. {item.schemaVersion ?? 1}
                        </span>
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
                        <div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
                          <span className="min-w-0 truncate">{title}</span>
                          <span className="shrink-0 text-xs text-gray-500 tabular-nums select-none" title="스키마 버전">
                            ver. {item.schemaVersion ?? 1}
                          </span>
                        </div>
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
      <style dangerouslySetInnerHTML={{ __html: ".keyword-capture-hex .exclude-from-capture { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; } .keyword-capture-hex [data-cardpack-title] { min-height: 3.5rem !important; padding-bottom: 0.375rem !important; } .keyword-capture-hex [data-cardpack-title] p:first-of-type { line-height: 1.5 !important; min-height: 3em !important; overflow: visible !important; }" }} />
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
                    ) : (
                      <>
                        {selectedReportSchemaVersion === 2 && (
                          <div ref={v2PlannedCardPacksSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 mb-4 overflow-visible pb-10">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#b8860b]/40 pb-3 mb-4">
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => void captureV2PlannedCardPacksSectionAsImage()}
                                  className="text-base md:text-lg font-semibold text-yellow-200/90 text-left cursor-pointer hover:text-yellow-100 hover:underline focus:outline-none focus:underline rounded px-0 py-0 min-w-0"
                                  title="클릭 시 진행(예정) 카드팩 목록 영역 전체를 이미지로 저장"
                                >
                                  진행(예정) 카드팩 목록
                                </button>
                                <span className="relative inline-flex shrink-0 group">
                                  <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500 bg-red-950/70 text-[11px] font-bold leading-none text-red-300 shadow-sm hover:bg-red-900/80 hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                                    aria-label="진행 예정 카드팩 사용 안내"
                                    aria-describedby="v2-planned-cardpack-help-tooltip"
                                  >
                                    ?
                                  </button>
                                  <div
                                    id="v2-planned-cardpack-help-tooltip"
                                    role="tooltip"
                                    className="pointer-events-none absolute left-1/2 bottom-[calc(100%+8px)] z-[70] w-max max-w-[min(20rem,calc(100vw-3rem))] -translate-x-1/2 rounded-xl border border-[#b8860b]/50 bg-[#1a1a1f] px-3 py-2.5 text-left text-[11px] sm:text-xs leading-snug text-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.55)] opacity-0 transition-opacity duration-200 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible"
                                  >
                                    <div className="flex flex-col gap-2">
                                      <p>1행 1~5층, 추가 시 2행 6~10층·3행 11~15층입니다.</p>
                                      <p>각 층 칸을 눌러 출현 카드팩을 고릅니다.</p>
                                      <p>
                                        변경 후 상단 <strong className="text-yellow-200/90">저장</strong>을 눌러주세요.
                                      </p>
                                    </div>
                                    {/* 말풍선 꼬리 */}
                                    <span
                                      className="absolute left-1/2 top-full -translate-x-1/2 -mt-px block h-0 w-0 border-x-[8px] border-x-transparent border-t-[8px] border-t-[#b8860b]/50"
                                      aria-hidden
                                    />
                                    <span
                                      className="absolute left-1/2 top-full -translate-x-1/2 mt-[-6px] block h-0 w-0 border-x-[7px] border-x-transparent border-t-[7px] border-t-[#1a1a1f]"
                                      aria-hidden
                                    />
                                  </div>
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={addV2PlannedFloorRow}
                                  disabled={v2PlannedFloorRowCount >= 3 || plannableCardPacksLoading || plannableCardPacks.length === 0}
                                  className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                                  title="6~10층 행 추가 (최대 11~15층까지)"
                                >
                                  층 행 추가
                                </button>
                                <button
                                  type="button"
                                  onClick={removeLastV2PlannedFloorRow}
                                  disabled={v2PlannedFloorRowCount <= 1}
                                  className="px-2.5 py-1.5 text-xs sm:text-sm rounded border border-rose-500/50 text-rose-200 hover:bg-rose-500/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                                  title="마지막 층 행 삭제 (1행 1~5층은 유지)"
                                >
                                  마지막 행 삭제
                                </button>
                              </div>
                            </div>
                            {plannableCardPacksLoading ? (
                              <p className="text-gray-400 text-sm mb-3">카드팩 목록을 불러오는 중…</p>
                            ) : plannableCardPacks.length === 0 ? (
                              <p className="text-gray-400 text-sm mb-3">카드팩 목록을 불러올 수 없습니다.</p>
                            ) : null}
                            <div className="min-h-[120px] rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]/50 p-3 md:p-3 lg:p-4 overflow-visible">
                              <div className="w-full space-y-3 sm:space-y-4">
                                {V2_FLOOR_ROWS.slice(0, v2PlannedFloorRowCount).map((rowFloors, rowIdx) => (
                                  <div
                                    key={rowIdx}
                                    className="w-full grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-2 lg:gap-3"
                                  >
                                    {rowFloors.map((floor) => {
                                      const packId = checkedCardPackByFloor[floor];
                                      const pack = packId
                                        ? plannableCardPacks.find((p) => p.cardpackId === packId)
                                        : undefined;
                                      const slotDiff = pack ? plannedCardPackDifficultyByFloor[floor] : undefined;
                                      const borderCls =
                                        pack && slotDiff
                                          ? v2SlotBorderClass(slotDiff)
                                          : "border-[#b8860b]/50 hover:border-yellow-400/60";
                                      const floorTitle =
                                        pack && slotDiff
                                          ? `${floor}층 - ${v2DifficultySlotLabel(slotDiff)}`
                                          : `${floor}층`;
                                      const slotDisabled = plannableCardPacksLoading || plannableCardPacks.length === 0;
                                      return (
                                        <div
                                          key={floor}
                                          role="button"
                                          tabIndex={slotDisabled ? -1 : 0}
                                          onClick={() => {
                                            if (slotDisabled) return;
                                            setV2FloorModalFloor(floor);
                                          }}
                                          onKeyDown={(e) => {
                                            if (slotDisabled) return;
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setV2FloorModalFloor(floor);
                                            }
                                          }}
                                          className={`flex flex-col items-stretch rounded-lg border bg-[#131316]/80 transition-colors text-left min-h-[180px] sm:min-h-[200px] md:min-h-[220px] lg:min-h-[240px] outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] ${
                                            slotDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"
                                          } ${borderCls}`}
                                        >
                                          <span className="text-center text-xs sm:text-sm md:text-base font-semibold text-yellow-200/90 py-1.5 md:py-2 border-b border-[#b8860b]/30 bg-[#131316] shrink-0 px-1 leading-tight">
                                            {floorTitle}
                                          </span>
                                          <div className="relative flex-1 flex flex-col items-center justify-center p-1.5 min-h-[140px] sm:min-h-[160px] md:min-h-[170px]">
                                            {plannableCardPacksLoading ? (
                                              <span className="text-gray-500 text-sm text-center">…</span>
                                            ) : pack ? (
                                              <>
                                                <div className="aspect-[1/2] w-full max-w-[3.5rem] sm:max-w-[4.25rem] md:max-w-none mx-auto rounded overflow-hidden bg-[#1a1a1a] mb-1 shrink-0">
                                                  {pack.thumbnail ? (
                                                    <img
                                                      src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                                      alt=""
                                                      className="w-full h-full object-cover"
                                                      onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                      }}
                                                    />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-0.5 text-center">
                                                      없음
                                                    </div>
                                                  )}
                                                </div>
                                                <p className="text-[10px] sm:text-xs md:text-sm text-gray-200 line-clamp-2 text-center leading-snug w-full mt-0.5">
                                                  {pack.title}
                                                </p>
                                                {!slotDisabled && (
                                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center exclude-from-capture">
                                                    <button
                                                      type="button"
                                                      className="pointer-events-auto rounded-full bg-black/55 p-1.5 sm:p-2 text-white shadow-lg border border-white/25 hover:bg-black/75 hover:scale-105 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 z-10 exclude-from-capture"
                                                      title="카드팩 정보"
                                                      aria-label={`${pack.title} 카드팩 정보 보기`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        cardPackDetailOpenRef.current?.open(pack.cardpackId);
                                                      }}
                                                    >
                                                      <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="w-4 h-4 sm:w-[1.15rem] sm:h-[1.15rem]"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden
                                                      >
                                                        <circle cx="11" cy="11" r="8" />
                                                        <path d="m21 21-4.35-4.35" />
                                                      </svg>
                                                    </button>
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <span className="text-gray-500 text-xs sm:text-sm text-center px-1 leading-snug">
                                                비어 있음
                                                <br />
                                                <span className="text-gray-600 text-[11px] sm:text-xs">탭하여 선택</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                            {portalMounted &&
                              v2FloorModalFloor != null &&
                              createPortal(
                                <div
                                  className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/75"
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="v2-floor-modal-title"
                                  onClick={() => setV2FloorModalFloor(null)}
                                >
                                  <div
                                    className="relative w-full max-w-3xl max-h-[min(90vh,720px)] flex flex-col rounded-xl border border-[#b8860b]/50 bg-[#131316] shadow-xl overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-[#b8860b]/40 shrink-0">
                                      <div>
                                        <h4 id="v2-floor-modal-title" className="text-lg font-semibold text-yellow-200">
                                          {v2FloorModalFloor}층 출현 카드팩
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          난이도를 고른 뒤 카드팩을 선택하세요.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setV2FloorModalFloor(null)}
                                        className="shrink-0 px-2 py-1 text-gray-400 hover:text-white rounded border border-transparent hover:border-[#b8860b]/40"
                                        aria-label="닫기"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div className="px-4 py-2 border-b border-[#b8860b]/25 flex flex-wrap items-center gap-2 shrink-0">
                                      <span className="text-xs text-gray-500 mr-1">난이도</span>
                                      {(["노말", "하드", "익스트림"] as const).map((d) => (
                                        <button
                                          key={d}
                                          type="button"
                                          onClick={() => setV2ModalDifficulty(d)}
                                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                            v2ModalDifficulty === d
                                              ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                                              : "border-[#b8860b]/35 text-gray-400 hover:bg-white/5"
                                          }`}
                                        >
                                          {d === "익스트림" ? "평행중첩" : d}
                                        </button>
                                      ))}
                                    </div>
                                    {resultEgoGifts.some((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0) ? (
                                      <p className="text-[11px] sm:text-xs text-amber-200/85 px-4 py-1.5 border-b border-amber-500/20 bg-amber-500/5 leading-snug">
                                        <span className="text-amber-400 font-bold" aria-hidden>
                                          ●
                                        </span>{" "}
                                        호박색 테두리: 이 보고서 즐겨찾기 중{" "}
                                        <strong className="text-amber-100/90">한정</strong> 에고기프트가 이 층·난이도에서 출현할 수 있는 카드팩입니다.
                                      </p>
                                    ) : null}
                                    <div className="px-4 py-2 border-b border-[#b8860b]/20 shrink-0">
                                      <label htmlFor="v2-modal-pack-search" className="sr-only">
                                        카드팩 제목 검색
                                      </label>
                                      <input
                                        id="v2-modal-pack-search"
                                        type="search"
                                        value={v2ModalTitleSearch}
                                        onChange={(e) => setV2ModalTitleSearch(e.target.value)}
                                        placeholder="제목으로 검색…"
                                        className="w-full px-3 py-2 text-sm rounded border border-[#b8860b]/35 bg-[#0d0d0f] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400/50"
                                      />
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                                      {v2ModalDisplayPacks.length === 0 ? (
                                        <p className="text-gray-500 text-sm text-center py-8">
                                          {v2ModalFilteredPacks.length === 0
                                            ? `이 조건에서 ${v2FloorModalFloor}층에 출현하는 카드팩이 없습니다.`
                                            : "검색어에 맞는 카드팩이 없습니다."}
                                        </p>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                          {v2ModalDisplayPacks.map((cp) => {
                                            const currentId = checkedCardPackByFloor[v2FloorModalFloor];
                                            const isCurrent = currentId === cp.cardpackId;
                                            const hasLimitedHighlight = v2ModalLimitedIdSet.has(cp.cardpackId);
                                            const cardSurfaceClass = isCurrent
                                              ? "border-yellow-400 ring-2 ring-yellow-400/30 bg-[#1a1810]"
                                              : hasLimitedHighlight
                                                ? "border-amber-400/85 ring-2 ring-amber-400/40 bg-[#1a1408] hover:border-amber-300 hover:ring-amber-300/50"
                                                : "border-[#b8860b]/40 bg-[#0d0d0f] hover:border-[#d4af37]/60";
                                            return (
                                              <button
                                                key={cp.cardpackId}
                                                type="button"
                                                onClick={() =>
                                                  commitV2FloorSelection(v2FloorModalFloor, cp.cardpackId, v2ModalDifficulty)
                                                }
                                                className={`relative rounded-lg border flex flex-col text-left overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/50 ${cardSurfaceClass}`}
                                              >
                                                {hasLimitedHighlight ? (
                                                  <span className="absolute top-1 right-1 z-10 px-1 py-0.5 rounded bg-amber-500 text-black text-[9px] sm:text-[10px] font-bold leading-none shadow-md pointer-events-none">
                                                    한정
                                                  </span>
                                                ) : null}
                                                <div className="aspect-[1/2] w-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
                                                  {cp.thumbnail ? (
                                                    <img
                                                      src={RESULT_EGOGIFT_BASE_URL + cp.thumbnail}
                                                      alt=""
                                                      className="w-full h-full object-cover"
                                                      onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                      }}
                                                    />
                                                  ) : (
                                                    <span className="text-gray-500 text-xs px-1 text-center">이미지 없음</span>
                                                  )}
                                                </div>
                                                <div className="px-2 py-2">
                                                  <p className="text-gray-200 text-xs font-medium line-clamp-2 leading-snug">{cp.title}</p>
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div className="px-4 py-3 border-t border-[#b8860b]/40 flex flex-wrap gap-2 justify-end shrink-0 bg-[#0f0f12]">
                                      {checkedCardPackByFloor[v2FloorModalFloor] != null && (
                                        <button
                                          type="button"
                                          onClick={() => commitV2FloorSelection(v2FloorModalFloor, null)}
                                          className="px-3 py-2 text-sm rounded border border-red-400/50 text-red-200 hover:bg-red-500/10"
                                        >
                                          이 층 선택 해제
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setV2FloorModalFloor(null)}
                                        className="px-3 py-2 text-sm rounded bg-[#2a2a2d] text-gray-200 border border-[#b8860b]/40 hover:bg-[#333338]"
                                      >
                                        닫기
                                      </button>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              )}
                            <div className="mt-4 pt-4 border-t border-[#b8860b]/30">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <h4 className="text-sm font-semibold text-yellow-200/80">놓친 한정 에고기프트 출현 카드팩</h4>
                                  <span className="relative group shrink-0">
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#b8860b]/50 text-[#b8860b]/80 text-xs font-bold cursor-help">
                                      ?
                                    </span>
                                    <span className="absolute left-0 top-full mt-1.5 z-10 px-3 py-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] text-xs text-gray-200 bg-[#1a1a1d] border border-[#b8860b]/40 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
                                      선택한 에고기프트 중 한정 카드팩에서 출연하지만 해당 카드팩이 진행 예정 슬롯에 저장되지 않은 경우 아래에 표시됩니다. (노말·하드·익스트림 전 층 기준)
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMissedLimitedCardPacksExpanded((v) => !v)}
                                  className="shrink-0 p-1 rounded text-yellow-200/80 hover:text-yellow-100 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
                                  aria-expanded={missedLimitedCardPacksExpanded}
                                  title={missedLimitedCardPacksExpanded ? "놓친 한정 카드팩 목록 접기" : "놓친 한정 카드팩 목록 펼치기"}
                                  aria-label={missedLimitedCardPacksExpanded ? "접기" : "펼치기"}
                                >
                                  <span
                                    className={`inline-block transition-transform duration-200 ${missedLimitedCardPacksExpanded ? "rotate-90" : ""}`}
                                    aria-hidden
                                  >
                                    ▶
                                  </span>
                                </button>
                              </div>
                              {missedLimitedCardPacksExpanded && (
                              <>
                              {resultLimitedEgoGiftCardPacksLoading ? (
                                <p className="text-gray-400 text-sm">불러오는 중...</p>
                              ) : resultLimitedEgoGiftCardPacks.length === 0 ? (
                                <p className="text-gray-500 text-sm">해당 조건에 한정 에고기프트가 출현하는 카드팩이 없습니다.</p>
                              ) : (
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-2 lg:gap-3 xl:gap-4 grid-auto-rows-[minmax(15rem,auto)] md:grid-auto-rows-[minmax(13rem,auto)] xl:grid-auto-rows-[minmax(17rem,auto)]">
                                  {[...resultLimitedEgoGiftCardPacks]
                                    .sort((a, b) => {
                                      const floorsA = getFloorsWhereCardPackChecked(a.cardpackId);
                                      const floorsB = getFloorsWhereCardPackChecked(b.cardpackId);
                                      const minA = floorsA.length > 0 ? Math.min(...floorsA) : 999;
                                      const minB = floorsB.length > 0 ? Math.min(...floorsB) : 999;
                                      return minA - minB;
                                    })
                                    .map((pack) => (
                                      <div
                                        key={pack.cardpackId}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => cardPackDetailOpenRef.current?.open(pack.cardpackId)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            cardPackDetailOpenRef.current?.open(pack.cardpackId);
                                          }
                                        }}
                                        className="relative rounded border border-amber-500/40 bg-[#131316]/80 flex flex-col cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-all"
                                      >
                                        <div className="aspect-[1/2] w-full flex-shrink-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden rounded-t">
                                          {pack.thumbnail ? (
                                            <img
                                              src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                              alt={pack.title}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                              }}
                                            />
                                          ) : (
                                            <span className="text-gray-500 text-[10px] md:text-xs">이미지 없음</span>
                                          )}
                                        </div>
                                        <div className="px-1.5 pt-1.5 pb-1 text-center min-h-0 flex-shrink-0 flex flex-col justify-center rounded-b overflow-visible md:px-1.5 md:pt-1 md:pb-1 xl:px-2 xl:pt-2 xl:pb-1.5" data-cardpack-title>
                                          <p className="text-gray-200 text-xs font-medium break-words leading-snug h-[2.7em] overflow-hidden md:text-[11px] md:leading-tight md:h-[2.65em] xl:text-sm xl:leading-[1.5] xl:h-[3em]">
                                            {pack.title}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                              </>
                              )}
                            </div>
                          </div>
                        )}
                        {resultEgoGiftsLoading ? (
                      <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                        <p className="text-gray-400">불러오는 중...</p>
                      </div>
                    ) : starredEgoGiftIds.length === 0 && starredCardPackIds.length === 0 ? (
                      <div className="space-y-4">
                        {selectedReportSchemaVersion !== 2 && (
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                          <p className="text-gray-400">이 보고서에 등록된 카드팩이 없습니다.</p>
                        </div>
                        )}
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
                      {selectedReportSchemaVersion !== 2 && (
                      <>
                      {starredCardPackIds.length === 0 ? (
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6 mb-4">
                          <p className="text-gray-400">이 보고서에 등록된 카드팩이 없습니다.</p>
                        </div>
                      ) : (
                      <div ref={starredCardPacksSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 mb-4 overflow-visible pb-10">
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
                              onClick={() => {
                                setCheckedCardPackByFloor({});
                                setPlannedCardPackDifficultyByFloor({});
                              }}
                              disabled={Object.keys(checkedCardPackByFloor).length === 0}
                              className="px-2 py-1 text-xs rounded border border-cyan-400 bg-cyan-400/25 text-cyan-200 hover:bg-cyan-400/35 hover:text-cyan-100 transition-colors shadow-[0_0_12px_rgba(34,211,238,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-400/25 disabled:hover:text-cyan-200"
                              title="층별 선택 초기화"
                            >
                              선택 초기화
                            </button>
                          </div>
                        </div>
                        <div className={resultStarredCardPacks.length === 0 && !resultStarredCardPacksLoading ? "" : "min-h-[120px] rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]/50 p-4 overflow-visible"}>
                          {resultStarredCardPacksLoading ? (
                            <p className="text-gray-400 text-sm">불러오는 중...</p>
                          ) : resultStarredCardPacks.length === 0 ? (
                            <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                              <p className="text-gray-400">이 보고서에 등록된 카드팩이 없습니다.</p>
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
                                  className="relative rounded border border-[#b8860b]/40 bg-[#131316]/80 flex flex-col cursor-pointer hover:ring-2 hover:ring-yellow-400/50 transition-all"
                                >
                                  <div className="aspect-[1/2] w-full flex-shrink-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden rounded-t">
                                    {pack.thumbnail ? (
                                      <img
                                        src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                        alt={pack.title}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      <span className="text-gray-500 text-xs">이미지 없음</span>
                                    )}
                                  </div>
                                  <div className="px-2 pt-2 pb-1.5 text-center min-h-0 flex-shrink-0 flex flex-col justify-center rounded-b overflow-visible" data-cardpack-title>
                                    <p className="text-gray-200 text-sm font-medium break-words leading-[1.5] h-[3em] overflow-hidden">{pack.title}</p>
                                    {resultCardPackFloor == null && (() => {
                                      const floors = getFloorsWhereCardPackChecked(pack.cardpackId);
                                      return floors.length > 0 ? (
                                        <p className="text-yellow-400/90 text-xs mt-0">
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
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-yellow-200/80">놓친 한정 에고기프트 출현 카드팩</h4>
                                <span className="relative group shrink-0">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#b8860b]/50 text-[#b8860b]/80 text-xs font-bold cursor-help">?</span>
                                  <span className="absolute left-0 top-full mt-1.5 z-10 px-3 py-2 w-72 text-xs text-gray-200 bg-[#1a1a1d] border border-[#b8860b]/40 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
                                    선택한 에고기프트 중 한정 카드팩에서 출연하지만 해당 카드팩이 선택 목록에 저장되지 않은 경우 아래 영역에 표시됩니다.
                                  </span>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMissedLimitedCardPacksExpanded((v) => !v)}
                                className="shrink-0 p-1 rounded text-yellow-200/80 hover:text-yellow-100 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
                                aria-expanded={missedLimitedCardPacksExpanded}
                                title={missedLimitedCardPacksExpanded ? "놓친 한정 카드팩 목록 접기" : "놓친 한정 카드팩 목록 펼치기"}
                                aria-label={missedLimitedCardPacksExpanded ? "접기" : "펼치기"}
                              >
                                <span
                                  className={`inline-block transition-transform duration-200 ${missedLimitedCardPacksExpanded ? "rotate-90" : ""}`}
                                  aria-hidden
                                >
                                  ▶
                                </span>
                              </button>
                            </div>
                            {missedLimitedCardPacksExpanded && (
                            <>
                            {resultLimitedEgoGiftCardPacksLoading ? (
                              <p className="text-gray-400 text-sm">불러오는 중...</p>
                            ) : resultLimitedEgoGiftCardPacks.length === 0 ? (
                              <p className="text-gray-500 text-sm">해당 조건에 한정 에고기프트가 출현하는 카드팩이 없습니다.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-2 lg:gap-3 xl:gap-4 grid-auto-rows-[minmax(15rem,auto)] md:grid-auto-rows-[minmax(13rem,auto)] xl:grid-auto-rows-[minmax(17rem,auto)]">
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
                                    className="relative rounded border border-amber-500/40 bg-[#131316]/80 flex flex-col cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-all"
                                  >
                                    <div className="aspect-[1/2] w-full flex-shrink-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden rounded-t">
                                      {pack.thumbnail ? (
                                        <img
                                          src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                          alt={pack.title}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <span className="text-gray-500 text-[10px] md:text-xs">이미지 없음</span>
                                      )}
                                    </div>
                                    <div className="px-1.5 pt-1.5 pb-1 text-center min-h-0 flex-shrink-0 flex flex-col justify-center rounded-b overflow-visible md:px-1.5 md:pt-1 md:pb-1 xl:px-2 xl:pt-2 xl:pb-1.5" data-cardpack-title>
                                      <p className="text-gray-200 text-xs font-medium break-words leading-snug h-[2.7em] overflow-hidden md:text-[11px] md:leading-tight md:h-[2.65em] xl:text-sm xl:leading-[1.5] xl:h-[3em]">{pack.title}</p>
                                      {resultCardPackFloor == null && (() => {
                                        const floors = getFloorsWhereCardPackChecked(pack.cardpackId);
                                        return floors.length > 0 ? (
                                          <p className="text-amber-400/90 text-xs mt-0">
                                            {floors.length === 1 ? `${floors[0]}층에서 선택됨` : `${floors.join(", ")}층에서 선택됨`}
                                          </p>
                                        ) : null;
                                      })()}
                                    </div>
                                    {resultCardPackFloor != null && !isCardPackCheckedOnOtherFloor(pack.cardpackId, resultCardPackFloor) && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleCardPackCheck(pack.cardpackId); }}
                                        className={`absolute top-1.5 right-1.5 md:top-1 md:right-1 w-8 h-8 md:w-7 md:h-7 xl:top-2 xl:right-2 xl:w-9 xl:h-9 rounded flex items-center justify-center transition-colors shadow-md border-2 border-blue-400 exclude-from-capture ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "bg-blue-500 hover:bg-blue-600" : "bg-black/70 hover:bg-black/90"}`}
                                        title={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                        aria-label={checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "체크 해제" : "체크"}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 md:w-3.5 md:h-3.5 xl:w-5 xl:h-5 ${checkedCardPackByFloor[resultCardPackFloor] === pack.cardpackId ? "text-white" : "text-gray-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            </>
                            )}
                        </div>
                        )}
                      </div>
                      )}
                      </>
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
                            onRemoveStarredEgoGift={removeStarredEgoGift}
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

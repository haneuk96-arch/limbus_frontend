"use client";

import { Suspense, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
const RESULT_EGOGIFT_BASE_URL = API_BASE_URL.replace("/api", "");
import { getOrCreateUUID } from "@/lib/uuid";
import { EgoGiftPageContent } from "@/app/egogift/page";
import { CardPackPageContent } from "@/app/cardpack/page";
import {
  ResultKeywordSection,
  SynthesisRecipesSubsetBlock,
  filterSynthesisRecipesForEgoIds,
  type ResultEgoGiftItem,
  type SynthesisRecipeItem,
} from "./ResultKeywordSection";
import {
  ObservedEgoGiftsSection,
  isObservableEgoGiftCandidate,
  type ObservableEgoCatalogItem,
} from "./ObservedEgoGiftsSection";
import {
  ReportSectionHelpModal,
  ReportHelpTrigger,
  type ReportHelpSectionId,
} from "./ReportSectionHelpModal";
import {
  inlineExternalImagesForCapture,
  snapshotElementToPngDataUrl,
  downloadPngDataUrl,
  formatCaptureError,
} from "@/lib/captureDomToPng";
import { fetchUserPersonalityList, type UserPersonalityListItem } from "@/lib/userPersonalityApi";
import { fetchUserPersonalityEgoList, type UserPersonalityEgoListItem } from "@/lib/userPersonalityEgoApi";
import { keywordColorMap } from "@/lib/keywordParser";

/** 관측 카탈로그: 한 페이지(size) 제한을 넘는 전체 건수까지 순회 조회 */
async function fetchAllUserEgoGiftsForObservableCatalog(signal: AbortSignal): Promise<any[]> {
  const PAGE_SIZE = 2000;
  const acc: any[] = [];
  let page = 0;
  let totalPages = 1;
  const MAX_PAGES = 500;
  do {
    const res = await fetch(
      `${API_BASE_URL}/user/egogift?page=${page}&size=${PAGE_SIZE}`,
      { credentials: "include", signal },
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch: any[] = data.items || [];
    acc.push(...batch);
    totalPages = Math.max(1, Number(data.totalPages) || 1);
    const totalEl = Number(data.totalElements);
    if (Number.isFinite(totalEl) && acc.length >= totalEl) break;
    if (batch.length === 0) break;
    page++;
    if (page >= totalPages || page >= MAX_PAGES) break;
  } while (true);
  const byId = new Map<number, any>();
  for (const item of acc) {
    const id = Number(item.egogiftId);
    if (Number.isFinite(id) && id > 0) byId.set(id, item);
  }
  return [...byId.values()];
}

/** ego_gift_recipe_map 타입「결과」에 등록된 ID (synthesis_yn 과 무관) */
async function fetchRecipeResultEgogiftIds(signal: AbortSignal): Promise<Set<number>> {
  const res = await fetch(`${API_BASE_URL}/user/egogift/synthesis-result-egogift-ids`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) return new Set();
  const data = await res.json();
  const raw = data.egogiftIds ?? [];
  const out = new Set<number>();
  for (const x of raw) {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  return out;
}

const REPORT_EGO_ACQUIRE_ORDER_REF_URL =
  "https://arca.live/b/lobotomycoperation/162218167";

const REPORT_EGO_ACQUIRE_ORDER_ENHANCE_NOTE_REF_URL =
  "https://gall.dcinside.com/mgallery/board/view/?id=limbuscompany&no=462114";

const REPORT_EGO_GRADE_ROMAN: Record<1 | 2 | 3 | 4, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

/** 에고기프트 등급(로마 숫자, 노란색) + 이름 */
function ReportEgoGiftGradeName({
  grade,
  name,
}: {
  grade: 1 | 2 | 3 | 4;
  name: string;
}) {
  return (
    <>
      <span className="font-semibold tabular-nums text-yellow-400">
        {REPORT_EGO_GRADE_ROMAN[grade]}
      </span>{" "}
      {name}
    </>
  );
}

/** 보고서 내 에고기프트 선택: 키워드 체인(트리거·효과) 요약 표 */
function ReportEgoGiftKeywordChainTable() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-4 rounded border border-[#b8860b]/35 bg-[#0f0f12] overflow-hidden">
      <div className="border-b border-[#b8860b]/25 bg-[#1a1a1d] px-2 py-2 sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/10 hover:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            aria-expanded={expanded}
          >
            <span
              className="inline-flex w-4 shrink-0 select-none text-amber-300/90"
              aria-hidden
            >
              {expanded ? "▼" : "▶"}
            </span>
            에고기프트 획득 순서
          </button>
          <a
            href={REPORT_EGO_ACQUIRE_ORDER_REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-sky-400/95 underline-offset-2 hover:text-sky-300 hover:underline sm:text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            참고 링크
          </a>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3 pl-0.5 sm:pl-1">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-gray-400 sm:text-xs">
            획득 이후 강화에 따른 순서변경 없음
          </p>
          <a
            href={REPORT_EGO_ACQUIRE_ORDER_ENHANCE_NOTE_REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-sky-400/95 underline-offset-2 hover:text-sky-300 hover:underline sm:text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            참고 링크
          </a>
        </div>
      </div>
      {expanded ? (
        <div className="overflow-x-auto">
      <table className="w-full min-w-[min(100%,28rem)] text-left text-[11px] sm:text-sm border-collapse">
        <caption className="sr-only">키워드별 트리거와 효과 발동 정리</caption>
        <thead>
          <tr className="border-b border-[#b8860b]/30 bg-[#1a1a1d] text-amber-200/95">
            <th scope="col" className="px-2 py-2 font-semibold whitespace-nowrap">
              구분
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              트리거
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              효과 발동
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              특이사항
            </th>
          </tr>
        </thead>
        <tbody className="text-gray-300 [&_td]:align-top [&_td]:border-b [&_td]:border-[#b8860b]/15 [&_td]:px-2 [&_td]:py-1.5">
          <tr>
            <td
              className={`whitespace-nowrap font-medium ${keywordColorMap["화상"]}`}
            >
              화상
            </td>
            <td>
              <ReportEgoGiftGradeName grade={3} name="먼지에서 먼지로" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={3} name="그을린 원반" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium ${keywordColorMap["출혈"]}`}
            >
              출혈
            </td>
            <td>-</td>
            <td>-</td>
            <td>순서 상관 없음</td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium ${keywordColorMap["진동"]}`}
            >
              진동
            </td>
            <td>-</td>
            <td>-</td>
            <td>순서 상관 없음</td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium ${keywordColorMap["파열"]}`}
            >
              파열
            </td>
            <td>
              <ReportEgoGiftGradeName grade={4} name="쾌감" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={1} name="부서진 리볼버" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium ${keywordColorMap["침잠"]}`}
            >
              침잠
            </td>
            <td>
              <ReportEgoGiftGradeName grade={3} name="고장난 나침반" /> or{" "}
              <ReportEgoGiftGradeName grade={4} name="서릿발 발자국" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={2} name="녹아내린 시계태엽" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium align-middle ${keywordColorMap["호흡"]}`}
              rowSpan={2}
            >
              호흡
            </td>
            <td>
              <ReportEgoGiftGradeName grade={2} name="네뷸라이저" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={2} name="물부리" />,{" "}
              <ReportEgoGiftGradeName grade={2} name="톱니파편" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td>
              <ReportEgoGiftGradeName grade={2} name="네뷸라이저++" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={3} name="미련" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td
              className={`whitespace-nowrap font-medium align-middle ${keywordColorMap["충전"]}`}
              rowSpan={2}
            >
              충전
            </td>
            <td>
              <ReportEgoGiftGradeName grade={4} name="충전식 장갑" /> or{" "}
              <ReportEgoGiftGradeName grade={3} name="피뢰침(++)" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={1} name="손목 보호대" />
            </td>
            <td></td>
          </tr>
          <tr>
            <td>
              <ReportEgoGiftGradeName grade={4} name="충전식 장갑(++)" /> +{" "}
              <ReportEgoGiftGradeName grade={3} name="피뢰침" />
            </td>
            <td>
              <ReportEgoGiftGradeName grade={2} name="야간 투시경" />
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
        </div>
      ) : null}
    </div>
  );
}

interface FavoriteItem {
  favoriteId: number;
  pageType: string;
  searchJson: string;
  createdAt: string;
  updatedAt: string;
  /** 1: 레거시, 2: 신규 (API 미배포 시 없으면 1로 간주) */
  schemaVersion?: number;
}

interface ShareBoardPostItem {
  postId: number;
  favoriteId: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  recommendCount?: number;
  periodRecommendCount?: number;
  recommendedByMe?: boolean;
  commentCount?: number;
  authorNickname?: string;
  pageType?: string;
  searchJson?: string;
  schemaVersion?: number;
  isMine?: boolean;
}

interface ShareBoardCommentItem {
  commentId: number;
  postId: number;
  parentCommentId?: number | null;
  depth: number;
  authorNickname?: string;
  content: string;
  deletedYn?: string;
  createdAt: string;
  updatedAt: string;
  isMine?: boolean;
}

type FavoritesTab = "result" | "share-board";

const TAB_LIST: { key: FavoritesTab; label: string }[] = [
  { key: "result", label: "파우스트의 보고서" },
  { key: "share-board", label: "공유게시판" },
];

/** 파우스트의 보고서 — 인격(수감자) 선택용 (관리자 인격 order 와 동일) */
const REPORT_PERSONALITY_OPTIONS = [
  { order: 1, name: "이상", image: "/images/identities/yi-sang.png" },
  { order: 2, name: "파우스트", image: "/images/identities/faust.png" },
  { order: 3, name: "돈키호테", image: "/images/identities/don-quixote.png" },
  { order: 4, name: "로슈", image: "/images/identities/ryoshu.png" },
  { order: 5, name: "뫼르소", image: "/images/identities/meursault.png" },
  { order: 6, name: "홍루", image: "/images/identities/hong-lu.png" },
  { order: 7, name: "히스클리프", image: "/images/identities/heathcliff.png" },
  { order: 8, name: "이스마엘", image: "/images/identities/ishmael.png" },
  { order: 9, name: "로쟈", image: "/images/identities/rodion.png" },
  { order: 11, name: "싱클레어", image: "/images/identities/sinclair.png" },
  { order: 12, name: "오티스", image: "/images/identities/outis.png" },
  { order: 13, name: "그레고르", image: "/images/identities/gregor.png" },
] as const;
const REPORT_PERSONALITY_ICON_BACKGROUND_BY_ORDER: Record<number, string> = {
  1: "/images/identities/Yi_Sang_Icon.png",
  2: "/images/identities/Faust_Icon.png",
  3: "/images/identities/Don_Quixote_Icon.png",
  4: "/images/identities/Ryoshu_Icon.png",
  5: "/images/identities/Meursault_Icon.png",
  6: "/images/identities/Hong_Lu_Icon.png",
  7: "/images/identities/Heathcliff_Icon.png",
  8: "/images/identities/Ishmael_Icon.png",
  9: "/images/identities/Rodion_Icon.png",
  11: "/images/identities/Sinclair_Icon.png",
  12: "/images/identities/Outis_Icon.png",
  13: "/images/identities/Gregor_Icon.png",
};

/** 보고서 12슬롯(수감자 순)에 저장되는 선택 인격 1칸 */
type ReportPersonalitySlotSaved = {
  personalityId: number;
  name: string;
  grade: number;
  imagePath: string;
  keywords?: string[];
  beforeSyncImagePath?: string;
  afterSyncImagePath?: string;
  useAfterSyncImage?: boolean;
  formationOrder?: number | null;
  skillAttributes?: string[];
  skillAttackTypes?: string[];
  skillInputValues?: string[];
};

type ReportEgoPickItem = {
  egoId: number;
  title: string;
  libraryGrade: string;
  imagePath: string;
  wrathCost: number;
  lustCost: number;
  slothCost: number;
  gluttonyCost: number;
  gloomCost: number;
  prideCost: number;
  envyCost: number;
};

type ReportEgoSlotSaved = {
  selectedByGrade: Partial<Record<"ZAYIN" | "TETH" | "HE" | "WAW" | "ALEPH", ReportEgoPickItem>>;
};

const REPORT_EGO_GRADE_ORDER = ["ZAYIN", "TETH", "HE", "WAW", "ALEPH"] as const;
const EGO_RESOURCE_ICON_MAP: Record<string, string> = {
  분노: "/images/keyword/Wrath.webp",
  색욕: "/images/keyword/Lust.webp",
  나태: "/images/keyword/Sloth.webp",
  탐식: "/images/keyword/Gluttony.webp",
  우울: "/images/keyword/Gloom.webp",
  오만: "/images/keyword/Pride.webp",
  질투: "/images/keyword/Envy.webp",
};
const EGO_GRADE_LABEL_ICON_MAP: Record<string, string> = {
  ZAYIN: "/images/keyword/ZAYIN_Label.webp",
  TETH: "/images/keyword/TETH_Label.webp",
  HE: "/images/keyword/HE_Label.webp",
  WAW: "/images/keyword/WAW_Label.webp",
};
const SKILL_ATTRIBUTE_BORDER_COLOR_MAP: Record<string, string> = {
  분노: "#ef4444",
  색욕: "#f97316",
  나태: "#eab308",
  탐식: "#22c55e",
  우울: "#22d3ee",
  오만: "#2563eb",
  질투: "#a855f7",
};

function extractPathFromUnknownImage(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && "path" in (raw as Record<string, unknown>)) {
    return String((raw as { path?: unknown }).path ?? "").trim();
  }
  return "";
}

function emptyReportPersonalitySlots(): (ReportPersonalitySlotSaved | null)[] {
  return Array.from({ length: 12 }, () => null);
}

function parseReportPersonalitySlots(raw: unknown): (ReportPersonalitySlotSaved | null)[] {
  const out = emptyReportPersonalitySlots();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 12 && i < raw.length; i++) {
    const el = raw[i];
    if (el == null || typeof el !== "object") {
      out[i] = null;
      continue;
    }
    const o = el as Record<string, unknown>;
    const personalityId = Number(o.personalityId);
    if (!Number.isFinite(personalityId) || personalityId <= 0) {
      out[i] = null;
      continue;
    }
    const name = String(o.name ?? "").trim();
    const grade = Number(o.grade);
    const imagePath = String(o.imagePath ?? o.thumbPath ?? "").trim();
    const keywords = Array.isArray(o.keywords)
      ? (o.keywords as unknown[])
          .map((k) => String(k ?? "").trim())
          .filter(Boolean)
      : [];
    const beforeSyncImagePath = String(
      o.beforeSyncImagePath ?? extractPathFromUnknownImage(o.beforeSyncImage),
    ).trim();
    const afterSyncImagePath = String(
      o.afterSyncImagePath ?? extractPathFromUnknownImage(o.afterSyncImage),
    ).trim();
    const useAfterSyncImage = Boolean(o.useAfterSyncImage);
    const skillAttributes = Array.isArray(o.skillAttributes)
      ? (o.skillAttributes as unknown[]).map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 3)
      : [];
    const skillAttackTypes = Array.isArray(o.skillAttackTypes)
      ? (o.skillAttackTypes as unknown[]).map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 3)
      : [];
    const skillInputValues = Array.isArray(o.skillInputValues)
      ? (o.skillInputValues as unknown[]).map((v) => String(v ?? "").trim()).slice(0, 3)
      : [];
    const formationOrderRaw = Number(o.formationOrder);
    const formationOrder =
      Number.isFinite(formationOrderRaw) && formationOrderRaw >= 1 && formationOrderRaw <= 12
        ? formationOrderRaw
        : null;
    out[i] = {
      personalityId,
      name: name || "이름 없음",
      grade: Number.isFinite(grade) ? grade : 0,
      imagePath,
      keywords,
      beforeSyncImagePath,
      afterSyncImagePath,
      useAfterSyncImage,
      formationOrder,
      skillAttributes,
      skillAttackTypes,
      skillInputValues,
    };
  }
  return out;
}

function emptyReportEgoSlots(): ReportEgoSlotSaved[] {
  return Array.from({ length: 12 }, () => ({ selectedByGrade: {} }));
}

function parseReportEgoSlots(raw: unknown): ReportEgoSlotSaved[] {
  const out = emptyReportEgoSlots();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 12 && i < raw.length; i += 1) {
    const el = raw[i];
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    const selectedRaw = o.selectedByGrade;
    const selectedByGrade: ReportEgoSlotSaved["selectedByGrade"] = {};
    if (selectedRaw && typeof selectedRaw === "object") {
      for (const grade of REPORT_EGO_GRADE_ORDER) {
        const v = (selectedRaw as Record<string, unknown>)[grade];
        if (!v || typeof v !== "object") continue;
        const egoId = Number((v as Record<string, unknown>).egoId);
        if (!Number.isFinite(egoId) || egoId <= 0) continue;
        selectedByGrade[grade] = {
          egoId,
          title: String((v as Record<string, unknown>).title ?? "").trim() || "이름 없음",
          libraryGrade: grade,
          imagePath: String((v as Record<string, unknown>).imagePath ?? "").trim(),
          wrathCost: Number((v as Record<string, unknown>).wrathCost ?? 0) || 0,
          lustCost: Number((v as Record<string, unknown>).lustCost ?? 0) || 0,
          slothCost: Number((v as Record<string, unknown>).slothCost ?? 0) || 0,
          gluttonyCost: Number((v as Record<string, unknown>).gluttonyCost ?? 0) || 0,
          gloomCost: Number((v as Record<string, unknown>).gloomCost ?? 0) || 0,
          prideCost: Number((v as Record<string, unknown>).prideCost ?? 0) || 0,
          envyCost: Number((v as Record<string, unknown>).envyCost ?? 0) || 0,
        };
      }
    }
    out[i] = { selectedByGrade };
  }
  return out;
}

/** 결과 탭 모아보기: 단일 ResultKeywordSection(ref·접기 state 키) */
const RESULT_EGO_FLAT_SECTION_KEY = "__flat__";

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

/** 간소화 목록 줄 — 난이도 글자색(노말·하드·익스트림) */
function v2DifficultyLineTextClass(d: V2PlannedDifficultyKey | undefined): string {
  if (!d) return "text-amber-200/90";
  if (d === "노말") return "text-lime-300";
  if (d === "하드") return "text-pink-300";
  return "text-red-400";
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

const RESULT_KEYWORD_ORDER = [
  "화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "참격", "관통", "타격", "범용", "기타",
];
const START_EGOGIFT_KEYWORD_ORDER = [
  "화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "참격", "관통", "타격",
] as const;

function previewTierSortOrder(tier: string | undefined): number {
  if (tier == null || tier === "") return 99;
  const t = String(tier).trim().toUpperCase();
  if (t === "1") return 1;
  if (t === "2") return 2;
  if (t === "3") return 3;
  if (t === "4") return 4;
  if (t === "5") return 5;
  if (t === "EX") return 6;
  return 99;
}

function previewGradeSortOrder(grades: string[] | undefined): number {
  if (!grades || grades.length === 0) return 99;
  let min = 99;
  for (const g of grades) {
    if (g === "N") min = Math.min(min, 1);
    else if (g === "H") min = Math.min(min, 2);
    else if (g === "E") min = Math.min(min, 3);
  }
  return min;
}

/** v2 모달 → for-limited-starred-egogifts API (탭별 난이도 파라미터) */
const V2_MODAL_TAB_API_DIFFICULTIES: Record<V2PlannedDifficultyKey, readonly string[]> = {
  노말: ["노말"],
  하드: ["하드"],
  익스트림: ["하드", "익스트림"],
};

/** 결과 탭 에고기프트: 키워드별 / 모아보기 / 층별(한정·선택 카드팩 요약) */
type ResultEgoGiftViewMode = "keyword" | "flat" | "floor";

function parseResultEgoGiftViewMode(parsed: {
  resultEgoGiftViewMode?: unknown;
  resultEgoGiftViewByKeyword?: unknown;
}): ResultEgoGiftViewMode {
  const m = parsed.resultEgoGiftViewMode;
  if (m === "keyword" || m === "flat" || m === "floor") return m;
  if (typeof m === "string") {
    const t = m.trim();
    if (t === "keyword" || t === "flat" || t === "floor") return t;
  }
  if (parsed.resultEgoGiftViewByKeyword === false) return "flat";
  /* 값 없음·알 수 없는 값 → 키워드별 보기 */
  return "keyword";
}

/** searchJson 안의 결과 탭 UI(간소화·접기 등) — 없으면 초기값과 동일하게 처리 */
function parseResultTabUiPrefs(parsed: Record<string, unknown>) {
  const bool = (key: string, defaultVal: boolean) =>
    typeof parsed[key] === "boolean" ? (parsed[key] as boolean) : defaultVal;
  return {
    resultSimplified: bool("resultSimplified", false),
    v2PlannedSectionExpanded: bool("v2PlannedSectionExpanded", true),
    v2PlannedSectionSimplified: bool("v2PlannedSectionSimplified", false),
    missedLimitedCardPacksExpanded: bool("missedLimitedCardPacksExpanded", true),
    pinnedEgoSectionsExpanded: bool("pinnedEgoSectionsExpanded", true),
    pinnedEgoSectionsSimplified: bool("pinnedEgoSectionsSimplified", true),
  };
}

function parsePinnedEgoGiftIds(raw: unknown, maxCount = 3): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, maxCount);
}

/** 합성 결과 에고 ID로 조합식 재료 egogiftId 목록 조회 (합성 결과가 아니면 빈 배열) */
async function fetchSynthesisMaterialEgogiftIdsForResult(resultEgogiftId: number): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/user/egogift/synthesis-recipes?egogiftIds=${resultEgogiftId}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    const items = Array.isArray(data) ? data : [];
    const materialIds = new Set<number>();
    for (const r of items as { resultEgogiftId?: unknown; materials?: { egogiftId?: unknown }[] }[]) {
      if (Number(r.resultEgogiftId) !== resultEgogiftId) continue;
      for (const m of r.materials ?? []) {
        const mid = Number(m.egogiftId);
        if (!Number.isNaN(mid) && mid > 0) materialIds.add(mid);
      }
    }
    return [...materialIds];
  } catch {
    return [];
  }
}

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
  탄환: "/images/keyword/bullet.webp",
  참격: "/images/keyword/slash.webp",
  관통: "/images/keyword/penetration.webp",
  타격: "/images/keyword/blow.webp",
};

const PERSONALITY_MODAL_KEYWORD_ORDER = [
  "화상",
  "출혈",
  "진동",
  "파열",
  "침잠",
  "호흡",
  "충전",
  "탄환",
  "참격",
  "관통",
  "타격",
] as const;

/** 인격 모달: API 키워드 문자열 → 아이콘 경로 (침장 등 오타 보정, 정해진 순서 우선) */
function getPersonalityKeywordIconPaths(keywords: string[] | undefined): string[] {
  if (!keywords?.length) return [];
  const normalized = keywords
    .map((raw) => {
      const t = String(raw ?? "").trim();
      if (t === "침장") return "침잠";
      return t;
    })
    .filter(Boolean);
  const paths: string[] = [];
  const used = new Set<string>();
  for (const kw of PERSONALITY_MODAL_KEYWORD_ORDER) {
    if (normalized.includes(kw)) {
      const p = RESULT_KEYWORD_ICON_MAP[kw];
      if (p && !used.has(p)) {
        used.add(p);
        paths.push(p);
      }
    }
  }
  for (const t of normalized) {
    const p = RESULT_KEYWORD_ICON_MAP[t];
    if (p && !used.has(p)) {
      used.add(p);
      paths.push(p);
    }
  }
  return paths;
}

function getSkillAttributeBorderColor(attributes: string[] | undefined, idx: number): string {
  const attr = String(attributes?.[idx] ?? "").trim();
  return SKILL_ATTRIBUTE_BORDER_COLOR_MAP[attr] ?? "rgba(184,134,11,0.25)";
}

/** 스킬 속성 문자열 → 자원 키 (분노·색욕·…). 매칭 실패 시 null */
function normalizeSkillResourceAttribute(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (EGO_RESOURCE_ICON_MAP[t]) return t;
  if (SKILL_ATTRIBUTE_BORDER_COLOR_MAP[t]) return t;
  return null;
}

const SKILL_RESOURCE_ATTRIBUTE_ORDER = ["분노", "색욕", "나태", "탐식", "우울", "오만", "질투"] as const;

/**
 * 편성 인격(formationOrder 1~7)만 — 스킬별 「기준」값이 1 이상인 칸만 포함.
 * 한 인격 안에서 같은 속성이 여러 스킬에 있으면 그 인격에서는 그 속성을 1번만 반영한 뒤,
 * 편성 인원 전체에서는 인격별 기여를 합산한다.
 */
function computeFormationRound1AcquirableResources(
  slots: (ReportPersonalitySlotSaved | null)[]
): Array<{ name: string; iconPath: string; count: number }> {
  const acc: Record<string, number> = {
    분노: 0,
    색욕: 0,
    나태: 0,
    탐식: 0,
    우울: 0,
    오만: 0,
    질투: 0,
  };
  for (const slot of slots) {
    if (!slot || !slot.formationOrder || slot.formationOrder < 1 || slot.formationOrder > 7) continue;
    const attrs = slot.skillAttributes ?? [];
    const values = slot.skillInputValues ?? [];
    /** 동일 인격 슬롯 내 속성 중복은 1회만 */
    const uniqueAttrsThisIdentity = new Set<string>();
    for (let idx = 0; idx < 3; idx++) {
      const rawVal = String(values[idx] ?? "").trim();
      const fallback = idx === 0 ? "3" : idx === 1 ? "2" : "1";
      const merged = rawVal || fallback;
      const n = Number(merged);
      if (!Number.isFinite(n) || n < 1) continue;
      const resName = normalizeSkillResourceAttribute(String(attrs[idx] ?? ""));
      if (!resName) continue;
      uniqueAttrsThisIdentity.add(resName);
    }
    for (const name of uniqueAttrsThisIdentity) {
      if (acc[name] !== undefined) acc[name] += 1;
    }
  }
  return SKILL_RESOURCE_ATTRIBUTE_ORDER.filter((name) => acc[name] > 0).map((name) => ({
    name,
    iconPath: EGO_RESOURCE_ICON_MAP[name],
    count: acc[name],
  }));
}

function colorWithAlpha(hexColor: string, alpha: number): string {
  const hex = String(hexColor || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "rgba(184,134,11,0.08)";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSkillAttackTypeIconPath(attackTypes: string[] | undefined, idx: number): string | null {
  const t = String(attackTypes?.[idx] ?? "").trim();
  if (!t) return null;
  return RESULT_KEYWORD_ICON_MAP[t] ?? null;
}

function normalizePersonalityKeyword(raw: unknown): string {
  const t = String(raw ?? "").trim();
  if (t === "침장") return "침잠";
  return t;
}

/** 인격 카드 등급별 테두리 톤 (1성 기본 유지, 2성 빨강, 3성 노랑) */
function personalityGradeCardToneClass(grade: number | undefined): string {
  if (grade === 2) {
    return "border-red-500/75 ring-1 ring-red-500/35 bg-red-500/10 hover:border-red-400/80";
  }
  if (grade === 3) {
    return "border-yellow-400/75 ring-1 ring-yellow-400/35 bg-yellow-400/10 hover:border-yellow-300/85";
  }
  return "border-[#b8860b]/40 bg-[#1a1a1d] hover:border-[#d4af37]/50";
}

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

function FavoritesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [favoriteActionsMenuId, setFavoriteActionsMenuId] = useState<number | null>(null);
  const [favoriteActionsMenuPosition, setFavoriteActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(true);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [shareToastMessage, setShareToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 불러오기 모달 표시 여부 및 입력값 */
  const [importShareModalOpen, setImportShareModalOpen] = useState(false);
  /** 파우스트의 보고서: 에고기프트 검색·선택(기존 에고기프트 탭 UI) 모달 */
  const [reportEgoGiftSelectModalOpen, setReportEgoGiftSelectModalOpen] = useState(false);
  /** 결과 탭 섹션별 이미지+설명 도움말 모달 */
  const [reportSectionHelpId, setReportSectionHelpId] = useState<ReportHelpSectionId | null>(null);
  const [importShareTokenInput, setImportShareTokenInput] = useState("");
  /** 조회 성공 시 표시할 데이터(2단계). null이면 코드 입력 단계 */
  const [importLookupResult, setImportLookupResult] = useState<{ searchJson: string; pageType: string } | null>(null);
  /** 2단계에서 저장할 보고서 명 */
  const [importSaveTitleInput, setImportSaveTitleInput] = useState("");
  const [shareBoardFavoriteId, setShareBoardFavoriteId] = useState<number | "">("");
  const [shareBoardTitleInput, setShareBoardTitleInput] = useState("");
  const [shareBoardDescriptionInput, setShareBoardDescriptionInput] = useState("");
  const [shareBoardRegistering, setShareBoardRegistering] = useState(false);
  const [shareBoardLoading, setShareBoardLoading] = useState(false);
  const [shareBoardPosts, setShareBoardPosts] = useState<ShareBoardPostItem[]>([]);
  const [shareBoardSelectedPost, setShareBoardSelectedPost] = useState<ShareBoardPostItem | null>(null);
  const [shareBoardSearchText, setShareBoardSearchText] = useState("");
  const [shareBoardSearchType, setShareBoardSearchType] = useState<"title" | "author">("title");
  const [shareBoardSort, setShareBoardSort] = useState<"latest" | "recommend7" | "recommend15" | "recommend30">("latest");
  const [shareBoardPopularOnly, setShareBoardPopularOnly] = useState(false);
  const [shareBoardPage, setShareBoardPage] = useState(1);
  const [shareBoardTotalPages, setShareBoardTotalPages] = useState(1);
  const [shareBoardTotalCount, setShareBoardTotalCount] = useState(0);
  const [shareBoardEditing, setShareBoardEditing] = useState(false);
  const [shareBoardEditTitle, setShareBoardEditTitle] = useState("");
  const [shareBoardEditDescription, setShareBoardEditDescription] = useState("");
  const [shareBoardUpdating, setShareBoardUpdating] = useState(false);
  const [shareBoardDeleting, setShareBoardDeleting] = useState(false);
  const [shareBoardPreviewLoading, setShareBoardPreviewLoading] = useState(false);
  const [shareBoardPreviewCardPacks, setShareBoardPreviewCardPacks] = useState<Array<{ cardpackId: number; title: string; thumbnail?: string; floors?: number[]; difficulties?: string[] }>>([]);
  const [shareBoardPreviewEgoGifts, setShareBoardPreviewEgoGifts] = useState<Array<{ egogiftId: number; giftName: string; thumbnail?: string; giftTier?: string; keywordName?: string; grades?: string[]; synthesisYn?: string; limitedCategoryNames?: string[] }>>([]);
  const [shareBoardPreviewSynthesisRecipes, setShareBoardPreviewSynthesisRecipes] = useState<SynthesisRecipeItem[]>([]);
  const [shareBoardPreviewKeywordGiftExpandedByKeyword, setShareBoardPreviewKeywordGiftExpandedByKeyword] = useState<Record<string, boolean>>({});
  const [shareBoardPreviewSynthesisExpandedByKeyword, setShareBoardPreviewSynthesisExpandedByKeyword] = useState<Record<string, boolean>>({});
  const [shareBoardPreviewSchemaVersion, setShareBoardPreviewSchemaVersion] = useState<number>(1);
  const [shareBoardPreviewCheckedCardPackByFloor, setShareBoardPreviewCheckedCardPackByFloor] = useState<Record<number, number>>({});
  const [shareBoardPreviewPlannedCardPackDifficultyByFloor, setShareBoardPreviewPlannedCardPackDifficultyByFloor] = useState<Record<number, V2PlannedDifficultyKey>>({});
  const [shareBoardPreviewStartEgoGiftIds, setShareBoardPreviewStartEgoGiftIds] = useState<number[]>([]);
  const [shareBoardPreviewObservedEgoGiftIds, setShareBoardPreviewObservedEgoGiftIds] = useState<number[]>([]);
  const [shareBoardPreviewEgoGiftViewMode, setShareBoardPreviewEgoGiftViewMode] = useState<ResultEgoGiftViewMode>("keyword");
  const [shareBoardPreviewReportPersonalitySlots, setShareBoardPreviewReportPersonalitySlots] = useState<(ReportPersonalitySlotSaved | null)[]>(() =>
    emptyReportPersonalitySlots()
  );
  const [shareBoardPreviewReportEgoSlots, setShareBoardPreviewReportEgoSlots] = useState<ReportEgoSlotSaved[]>(() =>
    emptyReportEgoSlots()
  );
  const [shareBoardPreviewFlippedSlots, setShareBoardPreviewFlippedSlots] = useState<Record<number, boolean>>({});
  const [shareBoardPreviewIdentityTab, setShareBoardPreviewIdentityTab] = useState<"personality" | "ego">("personality");
  const [shareBoardComments, setShareBoardComments] = useState<ShareBoardCommentItem[]>([]);
  const [shareBoardCommentsLoading, setShareBoardCommentsLoading] = useState(false);
  const [shareBoardCommentInput, setShareBoardCommentInput] = useState("");
  const [shareBoardReplyParentId, setShareBoardReplyParentId] = useState<number | null>(null);
  const [shareBoardReplyInput, setShareBoardReplyInput] = useState("");
  const [shareBoardCommentSubmitting, setShareBoardCommentSubmitting] = useState(false);
  const [shareBoardAuthenticated, setShareBoardAuthenticated] = useState(false);
  const [shareBoardAuthChecked, setShareBoardAuthChecked] = useState(false);

  const shareBoardMode = (searchParams.get("shareBoardMode") ?? "list") as "list" | "new" | "detail";
  const shareBoardPostIdParam = Number(searchParams.get("postId") || 0);
  const shareBoardFavoriteIdParam = Number(searchParams.get("favoriteId") || 0);
  /** 삭제 확인 모달: 삭제 대상 favoriteId (null이면 모달 숨김) */
  const [deleteConfirmFavoriteId, setDeleteConfirmFavoriteId] = useState<number | null>(null);
  /** 보고서(에고기프트 모달)에서 별로 선택한 에고기프트 ID 목록 (저장 시 JSON에 egogiftIds로 포함) */
  const [starredEgoGiftIds, setStarredEgoGiftIds] = useState<number[]>([]);
  /** 보고서에 포함된 카드팩 ID (JSON 동기화, 결과 탭 표시용) */
  const [starredCardPackIds, setStarredCardPackIds] = useState<number[]>([]);
  /** 결과 탭: 관측 에고기프트 (최대 3, Ⅳ·EX·조합 결과 등 제외 후보만, searchJson.observedEgoGiftIds) */
  const [observedEgoGiftIds, setObservedEgoGiftIds] = useState<number[]>([]);
  /** 결과 탭: 시작 에고기프트 (최대 3, searchJson.startEgoGiftIds) */
  const [startEgoGiftIds, setStartEgoGiftIds] = useState<number[]>([]);
  const [observableEgoGiftCatalog, setObservableEgoGiftCatalog] = useState<ObservableEgoCatalogItem[]>([]);
  const [observableEgoGiftCatalogLoading, setObservableEgoGiftCatalogLoading] = useState(false);
  /** 결과 탭에서 관측 카탈로그 API를 이미 성공 조회했는지(보고서 바꿀 때마다 전체 재조회 방지, 공유게시판 탭 갔다 오면 다시 조회) */
  const observableEgoCatalogFetchedRef = useRef(false);
  /** 등록된 즐겨찾기 목록에서 선택한 항목 (favoriteId, null이면 미선택) */
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<number | null>(null);
  /** 저장(등록·수정·자동저장) 실패 시에만 표시하는 토스트 */
  const [saveFailureToastMessage, setSaveFailureToastMessage] = useState<string | null>(null);
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
    /** 보고서 키워드별 목록 정렬: Y면 같은 키워드 내에서 앞 */
    priorityYn?: string;
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
  /** 결과 탭 자동 저장: 보고서 전환·불러오기 직후 1회는 저장 스킵 */
  const reportAutosaveSkipNextRef = useRef(true);
  /** 키워드별 카드 영역만 캡처용 (키워드 클릭 시, 합성 조합식 제외) */
  const keywordSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 키워드별 합성 조합식 영역만 캡처용 (조합식 클릭 시) */
  const synthesisSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** 전체 결과 영역 캡처용 (전체 다운로드 / 전체 다운로드 합성제외) */
  const allResultRef = useRef<HTMLDivElement | null>(null);
  /** 보고서 인격/에고 선택 섹션 이동용 */
  const reportIdentitySectionRef = useRef<HTMLDivElement | null>(null);
  const shareBoardListSectionRef = useRef<HTMLDivElement | null>(null);
  const shareBoardNewSectionRef = useRef<HTMLDivElement | null>(null);
  const shareBoardDetailPostInfoSectionRef = useRef<HTMLDivElement | null>(null);
  const shareBoardDetailPreviewSectionRef = useRef<HTMLDivElement | null>(null);
  const shareBoardDetailCommentsSectionRef = useRef<HTMLDivElement | null>(null);
  /** 층별 보기 2depth 이동용 */
  const floorRangeSectionRefs = useRef<Record<"1-5" | "6-10" | "11-15", HTMLDivElement | null>>({
    "1-5": null,
    "6-10": null,
    "11-15": null,
  });
  /** 선택한 카드팩 목록 섹션 전체 캡처용 */
  const starredCardPacksSectionRef = useRef<HTMLDivElement | null>(null);
  /** 스키마 v2 진행(예정) 카드팩 그리드 섹션 캡처용 */
  const v2PlannedCardPacksSectionRef = useRef<HTMLDivElement | null>(null);
  /** 「보고서 내 에고기프트 선택」 블록 — 플로팅 E 이동 */
  const reportEgoGiftPickSectionRef = useRef<HTMLDivElement | null>(null);
  /** 결과 탭 키워드별 에고: 「정보 보기」 클릭 시 상세 모달 (EgoGiftPageContent가 설정) */
  const egoGiftPreviewOpenRef = useRef<((giftName: string) => void) | null>(null);
  /** 결과 탭에서 카드팩 클릭 시 상세 모달 열기 (CardPackPageContent가 설정) */
  const cardPackDetailOpenRef = useRef<{ open: (cardpackId: number) => void } | null>(null);
  /** 키워드별 합성 조합식 펼침 여부 (없으면 펼침) */
  const [synthesisExpandedByKeyword, setSynthesisExpandedByKeyword] = useState<Record<string, boolean>>({});
  /** 키워드별 에고기프트 그리드 펼침 여부 (없으면 펼침, 합성 조합식과 별도) */
  const [keywordGiftExpandedByKeyword, setKeywordGiftExpandedByKeyword] = useState<Record<string, boolean>>({});
  /** 결과 탭 간소화: 이름/출현카드팩/합성 여부만, 조합식은 이름만 */
  const [resultSimplified, setResultSimplified] = useState(false);
  /** v2 진행(예정) 카드팩 섹션: 접기 / 간소화 */
  const [v2PlannedSectionExpanded, setV2PlannedSectionExpanded] = useState(true);
  const [v2PlannedSectionSimplified, setV2PlannedSectionSimplified] = useState(false);
  /** 시작·관측 에고기프트: 접기 / 간소화 (2열 그리드와 함께) — 기본은 간소화(컴팩트) 크기 */
  const [pinnedEgoSectionsExpanded, setPinnedEgoSectionsExpanded] = useState(true);
  const [pinnedEgoSectionsSimplified, setPinnedEgoSectionsSimplified] = useState(true);
  /** 보고서 12인격 슬롯 — searchJson.reportPersonalitySlots (REPORT_PERSONALITY_OPTIONS 순서) */
  const [reportPersonalitySlots, setReportPersonalitySlots] = useState<(ReportPersonalitySlotSaved | null)[]>(() =>
    emptyReportPersonalitySlots()
  );
  /** 보고서 에고선택 슬롯 — searchJson.reportEgoSlots (인격선택과 별도 저장) */
  const [reportEgoSlots, setReportEgoSlots] = useState<ReportEgoSlotSaved[]>(() => emptyReportEgoSlots());
  const [personalityPickerSlotIndex, setPersonalityPickerSlotIndex] = useState<number | null>(null);
  const [personalityPickerList, setPersonalityPickerList] = useState<UserPersonalityListItem[]>([]);
  const [personalityPickerLoading, setPersonalityPickerLoading] = useState(false);
  const [personalityPickerError, setPersonalityPickerError] = useState("");
  const [personalityPickerShowAfter, setPersonalityPickerShowAfter] = useState<Record<number, boolean>>({});
  const [skillPresetMenuSlotIndex, setSkillPresetMenuSlotIndex] = useState<number | null>(null);
  const [egoPickerSlotIndex, setEgoPickerSlotIndex] = useState<number | null>(null);
  const [egoPickerList, setEgoPickerList] = useState<UserPersonalityEgoListItem[]>([]);
  const [egoPickerLoading, setEgoPickerLoading] = useState(false);
  const [egoPickerError, setEgoPickerError] = useState("");
  const [egoPickerSelectedByGrade, setEgoPickerSelectedByGrade] = useState<ReportEgoSlotSaved["selectedByGrade"]>({});
  const personalitySlotBackfillAttemptedRef = useRef<Set<string>>(new Set());
  const reportPersonalityInitialRefreshDoneRef = useRef<Set<number>>(new Set());
  const [reportIdentityTab, setReportIdentityTab] = useState<"personality" | "ego">("personality");
  const [resultEgoGiftViewMode, setResultEgoGiftViewMode] = useState<ResultEgoGiftViewMode>("keyword");
  const [resultFloatingNavOpen, setResultFloatingNavOpen] = useState(false);
  const [resultFloatingNavEgoDepthOpen, setResultFloatingNavEgoDepthOpen] = useState(false);
  const resultFloatingNavRef = useRef<HTMLDivElement | null>(null);
  /** 본문 `container` 기준 — 넓은 화면에서는 바깥, 좁으면 안쪽에 플로팅 네비 정렬 */
  const mainContentContainerRef = useRef<HTMLDivElement | null>(null);
  const [floatingNavLeftPx, setFloatingNavLeftPx] = useState<number | null>(null);
  /** 모아보기: 키워드 순 정렬(켜면 키워드 그룹 순, 끄면 즐겨찾기 순). 등급 정렬과 동시 적용 가능 */
  const [flatSortByKeyword, setFlatSortByKeyword] = useState(false);
  /** 모아보기: 등급 정렬 — 첫 클릭 DESC, 두 번째 ASC, 세 번째 해제 */
  const [flatTierSort, setFlatTierSort] = useState<"off" | "desc" | "asc">("off");
  /** 결과 탭: 선택한 카드팩 목록 (ID로 조회한 상세) */
  const [resultStarredCardPacks, setResultStarredCardPacks] = useState<Array<{
    cardpackId: number;
    title: string;
    thumbnail?: string;
    floors?: number[];
    difficulties?: string[];
    difficultyFloors?: Array<{ difficulty: string; floors: number[] }>;
  }>>([]);

  const applyResultTabUiPrefsFromRecord = useCallback((raw: object) => {
    const u = parseResultTabUiPrefs(raw as Record<string, unknown>);
    setResultSimplified(u.resultSimplified);
    setV2PlannedSectionExpanded(u.v2PlannedSectionExpanded);
    setV2PlannedSectionSimplified(u.v2PlannedSectionSimplified);
    setMissedLimitedCardPacksExpanded(u.missedLimitedCardPacksExpanded);
    setPinnedEgoSectionsExpanded(u.pinnedEgoSectionsExpanded);
    setPinnedEgoSectionsSimplified(u.pinnedEgoSectionsSimplified);
  }, []);

  const resetResultTabUiPrefsToDefaults = useCallback(() => {
    setResultSimplified(false);
    setV2PlannedSectionExpanded(true);
    setV2PlannedSectionSimplified(false);
    setMissedLimitedCardPacksExpanded(true);
    setPinnedEgoSectionsExpanded(true);
    setPinnedEgoSectionsSimplified(true);
  }, []);

  const filteredShareBoardPosts = shareBoardPosts;
  const floatingNavScrollOffset = 124;

  useEffect(() => {
    let cancelled = false;
    const fetchShareBoardAuth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/google/me`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setShareBoardAuthenticated(false);
            setShareBoardAuthChecked(true);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setShareBoardAuthenticated(Boolean(data?.authenticated));
          setShareBoardAuthChecked(true);
        }
      } catch {
        if (!cancelled) {
          setShareBoardAuthenticated(false);
          setShareBoardAuthChecked(true);
        }
      }
    };
    void fetchShareBoardAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureShareBoardRegisterAccess = useCallback(() => {
    if (!shareBoardAuthChecked) {
      const message = "로그인 상태를 확인 중입니다. 잠시 후 다시 시도해주세요.";
      setError(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
      return false;
    }
    if (!shareBoardAuthenticated) {
      const message = "로그인이 필요합니다.";
      setError(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
      return false;
    }
    return true;
  }, [shareBoardAuthChecked, shareBoardAuthenticated]);

  const shareBoardPreviewEgoGiftsExcludingObserved = useMemo(() => {
    if (shareBoardPreviewObservedEgoGiftIds.length === 0 && shareBoardPreviewStartEgoGiftIds.length === 0) {
      return shareBoardPreviewEgoGifts;
    }
    const hiddenSet = new Set([...shareBoardPreviewObservedEgoGiftIds, ...shareBoardPreviewStartEgoGiftIds]);
    return shareBoardPreviewEgoGifts.filter((eg) => !hiddenSet.has(eg.egogiftId));
  }, [shareBoardPreviewEgoGifts, shareBoardPreviewObservedEgoGiftIds, shareBoardPreviewStartEgoGiftIds]);

  const shareBoardPreviewEgoGiftsByKeyword = useMemo(() => {
    const map = new Map<string, typeof shareBoardPreviewEgoGifts>();
    for (const eg of shareBoardPreviewEgoGiftsExcludingObserved) {
      const key = (eg.keywordName ?? "기타").trim() || "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(eg);
    }
    const ordered: Array<{ keyword: string; egogifts: typeof shareBoardPreviewEgoGifts }> = [];
    for (const kw of RESULT_KEYWORD_ORDER) {
      const list = map.get(kw);
      if (list && list.length > 0) {
        ordered.push({
          keyword: kw,
          egogifts: [...list].sort((a, b) => {
            const td = previewTierSortOrder(a.giftTier) - previewTierSortOrder(b.giftTier);
            if (td !== 0) return td;
            return previewGradeSortOrder(a.grades) - previewGradeSortOrder(b.grades);
          }),
        });
      }
    }
    const rest = Array.from(map.keys()).filter((k) => !RESULT_KEYWORD_ORDER.includes(k)).sort((a, b) => a.localeCompare(b, "ko"));
    for (const kw of rest) {
      const list = map.get(kw)!;
      ordered.push({
        keyword: kw,
        egogifts: [...list].sort((a, b) => {
          const td = previewTierSortOrder(a.giftTier) - previewTierSortOrder(b.giftTier);
          if (td !== 0) return td;
          return previewGradeSortOrder(a.grades) - previewGradeSortOrder(b.grades);
        }),
      });
    }
    return ordered;
  }, [shareBoardPreviewEgoGiftsExcludingObserved]);

  const shareBoardPreviewEgoGiftsFlat = useMemo(() => {
    return [...shareBoardPreviewEgoGiftsExcludingObserved].sort((a, b) => {
      const td = previewTierSortOrder(a.giftTier) - previewTierSortOrder(b.giftTier);
      if (td !== 0) return td;
      const gd = previewGradeSortOrder(a.grades) - previewGradeSortOrder(b.grades);
      if (gd !== 0) return gd;
      return (a.giftName ?? "").localeCompare(b.giftName ?? "", "ko");
    });
  }, [shareBoardPreviewEgoGiftsExcludingObserved]);

  const shareBoardPreviewCardPackById = useMemo(() => {
    const m = new Map<number, { cardpackId: number; title: string; thumbnail?: string; floors?: number[]; difficulties?: string[] }>();
    shareBoardPreviewCardPacks.forEach((p) => m.set(p.cardpackId, p));
    return m;
  }, [shareBoardPreviewCardPacks]);

  const shareBoardPreviewObservableCatalog = useMemo<ObservableEgoCatalogItem[]>(() => {
    return shareBoardPreviewEgoGifts
      .map((eg) => ({
        egogiftId: eg.egogiftId,
        giftName: eg.giftName,
        keywordName: (eg.keywordName ?? "기타").trim() || "기타",
        giftTier: eg.giftTier,
        grades: eg.grades,
        synthesisYn: eg.synthesisYn,
        thumbnail: eg.thumbnail,
        limitedCategoryNames:
          Array.isArray(eg.limitedCategoryNames) && eg.limitedCategoryNames.length > 0
            ? eg.limitedCategoryNames.map((x) => String(x).trim()).filter(Boolean)
            : undefined,
      }));
  }, [shareBoardPreviewEgoGifts]);

  const shareBoardPreviewFloorRows = useMemo(() => {
    const rows: Array<{
      floor: number;
      cardpackId: number;
      title: string;
      thumbnail?: string;
      limitedEgoGifts: typeof shareBoardPreviewEgoGifts;
    }> = [];
    for (const [floorRaw, packId] of Object.entries(shareBoardPreviewCheckedCardPackByFloor)) {
        const floor = Number(floorRaw);
        const cardpackId = Number(packId);
        if (!Number.isFinite(floor) || floor <= 0 || !Number.isFinite(cardpackId) || cardpackId <= 0) continue;
        const pack = shareBoardPreviewCardPackById.get(cardpackId);
        if (!pack) continue;
        const limitedEgoGifts = shareBoardPreviewEgoGiftsExcludingObserved.filter((eg) =>
          (eg.limitedCategoryNames ?? []).some((name) => name === pack.title)
        );
        rows.push({ floor, cardpackId, title: pack.title, thumbnail: pack.thumbnail, limitedEgoGifts });
    }
    rows.sort((a, b) => a.floor - b.floor);
    return rows;
  }, [shareBoardPreviewCheckedCardPackByFloor, shareBoardPreviewCardPackById, shareBoardPreviewEgoGiftsExcludingObserved]);

  const shareBoardPreviewFloorRowsForDisplay = useMemo(
    () =>
      shareBoardPreviewFloorRows.map((row) => {
        if (row.limitedEgoGifts.length === 0) return row;
        const limitedIdSet = new Set(row.limitedEgoGifts.map((e) => e.egogiftId));
        const sorted = shareBoardPreviewEgoGiftsFlat.filter((eg) => limitedIdSet.has(eg.egogiftId));
        const sortedIds = new Set(sorted.map((e) => e.egogiftId));
        for (const eg of row.limitedEgoGifts) {
          if (!sortedIds.has(eg.egogiftId)) sorted.push(eg);
        }
        return { ...row, limitedEgoGifts: sorted };
      }),
    [shareBoardPreviewFloorRows, shareBoardPreviewEgoGiftsFlat]
  );

  const shareBoardPreviewEgoGiftsFlatExcludingFloorLimited = useMemo(() => {
    if (shareBoardPreviewEgoGiftViewMode !== "floor") return shareBoardPreviewEgoGiftsFlat;
    const shown = new Set<number>();
    for (const row of shareBoardPreviewFloorRows) {
      for (const eg of row.limitedEgoGifts) shown.add(eg.egogiftId);
    }
    if (shown.size === 0) return shareBoardPreviewEgoGiftsFlat;
    return shareBoardPreviewEgoGiftsFlat.filter((eg) => !shown.has(eg.egogiftId));
  }, [shareBoardPreviewEgoGiftViewMode, shareBoardPreviewEgoGiftsFlat, shareBoardPreviewFloorRows]);

  const shareBoardPreviewPersonalityKeywordCounts = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const slot of shareBoardPreviewReportPersonalitySlots) {
      if (!slot) continue;
      const uniq = new Set<string>();
      for (const raw of slot.keywords ?? []) {
        const keyword = normalizePersonalityKeyword(raw);
        if (!keyword || !RESULT_KEYWORD_ICON_MAP[keyword]) continue;
        uniq.add(keyword);
      }
      for (const keyword of uniq) countMap.set(keyword, (countMap.get(keyword) ?? 0) + 1);
    }
    const ordered = PERSONALITY_MODAL_KEYWORD_ORDER
      .map((keyword) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count: countMap.get(keyword) ?? 0,
      }))
      .filter((row) => row.count > 0);
    const rest = Array.from(countMap.entries())
      .filter(([keyword]) => !PERSONALITY_MODAL_KEYWORD_ORDER.some((k) => k === keyword))
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([keyword, count]) => ({ keyword, iconPath: RESULT_KEYWORD_ICON_MAP[keyword], count }))
      .filter((row) => row.iconPath);
    return [...ordered, ...rest];
  }, [shareBoardPreviewReportPersonalitySlots]);

  const shareBoardPreviewFormationKeywordCounts = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const slot of shareBoardPreviewReportPersonalitySlots) {
      if (!slot || !slot.formationOrder || slot.formationOrder < 1 || slot.formationOrder > 7) continue;
      const uniq = new Set<string>();
      for (const raw of slot.keywords ?? []) {
        const keyword = normalizePersonalityKeyword(raw);
        if (!keyword || !RESULT_KEYWORD_ICON_MAP[keyword]) continue;
        uniq.add(keyword);
      }
      for (const keyword of uniq) countMap.set(keyword, (countMap.get(keyword) ?? 0) + 1);
    }
    const ordered = PERSONALITY_MODAL_KEYWORD_ORDER
      .map((keyword) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count: countMap.get(keyword) ?? 0,
      }))
      .filter((row) => row.count > 0);
    const rest = Array.from(countMap.entries())
      .filter(([keyword]) => !PERSONALITY_MODAL_KEYWORD_ORDER.some((k) => k === keyword))
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([keyword, count]) => ({ keyword, iconPath: RESULT_KEYWORD_ICON_MAP[keyword], count }))
      .filter((row) => row.iconPath);
    return [...ordered, ...rest];
  }, [shareBoardPreviewReportPersonalitySlots]);

  const shareBoardPreviewFormationRound1AcquirableResources = useMemo(
    () => computeFormationRound1AcquirableResources(shareBoardPreviewReportPersonalitySlots),
    [shareBoardPreviewReportPersonalitySlots]
  );

  const shareBoardPreviewEgoResourceCounts = useMemo(() => {
    const acc: Record<string, number> = {
      분노: 0,
      색욕: 0,
      나태: 0,
      탐식: 0,
      우울: 0,
      오만: 0,
      질투: 0,
    };
    for (const slot of shareBoardPreviewReportEgoSlots) {
      const selected = slot?.selectedByGrade;
      if (!selected) continue;
      for (const grade of REPORT_EGO_GRADE_ORDER) {
        const picked = selected[grade];
        if (!picked) continue;
        acc.분노 += Number(picked.wrathCost ?? 0) || 0;
        acc.색욕 += Number(picked.lustCost ?? 0) || 0;
        acc.나태 += Number(picked.slothCost ?? 0) || 0;
        acc.탐식 += Number(picked.gluttonyCost ?? 0) || 0;
        acc.우울 += Number(picked.gloomCost ?? 0) || 0;
        acc.오만 += Number(picked.prideCost ?? 0) || 0;
        acc.질투 += Number(picked.envyCost ?? 0) || 0;
      }
    }
    return Object.entries(acc).map(([name, value]) => ({
      name,
      value,
      iconPath: EGO_RESOURCE_ICON_MAP[name],
    }));
  }, [shareBoardPreviewReportEgoSlots]);

  const pushFavoritesRoute = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams]);

  /** 결과/공유 탭: 플로팅 네비를 본문 컨테이너 오른쪽 바깥(여유 시) / 안쪽(좁을 때) */
  useLayoutEffect(() => {
    if (activeTab !== "result" && activeTab !== "share-board") return;
    const el = mainContentContainerRef.current;
    if (!el) return;
    const BUTTON_COL_W = 44;
    const OUT_GAP = 6;
    const VIEW_MARGIN = 8;
    const INSIDE_INSET = 10;
    const update = () => {
      const cr = el.getBoundingClientRect();
      const vw = typeof window !== "undefined" ? window.innerWidth : 0;
      let left = cr.right + OUT_GAP;
      if (left + BUTTON_COL_W > vw - VIEW_MARGIN) {
        left = Math.max(VIEW_MARGIN, cr.right - BUTTON_COL_W - INSIDE_INSET);
      }
      setFloatingNavLeftPx(left);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "egogift") {
      setActiveTab("result");
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "result");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
      return;
    }
    if (tab === "result" || tab === "share-board") {
      setActiveTab(tab);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!reportEgoGiftSelectModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReportEgoGiftSelectModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reportEgoGiftSelectModalOpen]);

  const scrollToSection = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - floatingNavScrollOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setResultFloatingNavOpen(false);
  }, [floatingNavScrollOffset]);

  const scrollToPageTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToPageBottom = useCallback(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!resultFloatingNavOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const root = resultFloatingNavRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setResultFloatingNavOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [resultFloatingNavOpen]);

  useEffect(() => {
    if (!resultFloatingNavOpen) {
      setResultFloatingNavEgoDepthOpen(false);
    }
  }, [resultFloatingNavOpen]);

  useEffect(() => {
    if (activeTab !== "result" && activeTab !== "share-board") {
      setResultFloatingNavOpen(false);
      setResultFloatingNavEgoDepthOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "result" && selectedFavoriteId === null) {
      setResultFloatingNavOpen(false);
      setResultFloatingNavEgoDepthOpen(false);
    }
  }, [activeTab, selectedFavoriteId]);
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
  /** 층별 보기: 각 층 슬롯의 카드팩에서 획득 가능한 한정 즐겨찾기 에고기프트 */
  const [floorLimitedRows, setFloorLimitedRows] = useState<
    Array<{ floor: number; cardpackId: number; title: string; thumbnail?: string; limitedEgoGifts: ResultEgoGiftItem[] }>
  >([]);
  const [floorLimitedRowsLoading, setFloorLimitedRowsLoading] = useState(false);

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

  /** 놓친 한정 API exclude: 즐겨찾기 카드팩 ID + 층별 슬롯에 체크한 카드팩 ID (백엔드가 에고 단위로 동일 출현 풀 전부 제외) */
  const mergedExcludeCardpackIdsForMissedLimited = useMemo(() => {
    const fromFloors = Object.values(checkedCardPackByFloor).filter(
      (id): id is number => typeof id === "number" && !Number.isNaN(id) && id > 0
    );
    return [...new Set([...starredCardPackIds, ...fromFloors])].sort((a, b) => a - b);
  }, [starredCardPackIds, checkedCardPackByFloor]);

  const toggleEgoGiftCheck = useCallback((egogiftId: number) => {
    setCheckedEgoGiftIds((prev) => {
      if (prev.includes(egogiftId)) {
        return prev.filter((id) => id !== egogiftId);
      }
      const recipe = synthesisRecipes.find((r) => r.resultEgogiftId === egogiftId);
      const next = [...prev, egogiftId];
      const seen = new Set(next);
      if (recipe?.materials?.length) {
        for (const m of recipe.materials) {
          const mid = Number(m.egogiftId);
          if (Number.isNaN(mid) || mid <= 0 || seen.has(mid)) continue;
          next.push(mid);
          seen.add(mid);
        }
      }
      return next;
    });
  }, [synthesisRecipes]);

  // 노말/하드 선택 시 6~15층 미표시이므로, 해당 층이 선택돼 있으면 5층으로 초기화 (1~5층·전체는 유지)
  useEffect(() => {
    if ((resultCardPackDifficulty === "노말" || resultCardPackDifficulty === "하드") && resultCardPackFloor != null && resultCardPackFloor >= 6) {
      setResultCardPackFloor(5);
    }
  }, [resultCardPackDifficulty]);

  const handleStarToggle = useCallback((egogiftId: number) => {
    let addedResult = false;
    setStarredEgoGiftIds((prev) => {
      if (prev.includes(egogiftId)) {
        return prev.filter((id) => id !== egogiftId);
      }
      addedResult = true;
      return [...prev, egogiftId];
    });
    if (!addedResult) return;
    void (async () => {
      const materialIds = await fetchSynthesisMaterialEgogiftIdsForResult(egogiftId);
      if (materialIds.length === 0) return;
      setStarredEgoGiftIds((prev) => {
        if (!prev.includes(egogiftId)) return prev;
        const next = [...prev];
        for (const id of materialIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
    })();
  }, []);

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

  /** 결과 탭: 관측 후보 = 전체 에고기프트 + 조합식「결과」ID·Ⅳ·EX·synthesisYn 등 제외 — 보고서 미선택 시에는 요청하지 않음 */
  useEffect(() => {
    if (activeTab !== "result") {
      observableEgoCatalogFetchedRef.current = false;
      setObservableEgoGiftCatalog([]);
      setObservableEgoGiftCatalogLoading(false);
      return;
    }
    if (selectedFavoriteId == null) {
      setObservableEgoGiftCatalogLoading(false);
      return;
    }
    if (observableEgoCatalogFetchedRef.current) {
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    setObservableEgoGiftCatalogLoading(true);
    Promise.all([
      fetchAllUserEgoGiftsForObservableCatalog(ac.signal),
      fetchRecipeResultEgogiftIds(ac.signal).catch(() => new Set<number>()),
    ])
      .then(([rawItems, recipeResultIds]) => {
        if (cancelled) return;
        const items: ObservableEgoCatalogItem[] = rawItems
          .map((item: any) => {
            const rawTier = item.giftTier ?? item.gift_tier;
            const giftTier = rawTier != null && rawTier !== "" ? String(rawTier).trim() : undefined;
            const rawSyn = item.synthesisYn ?? item.synthesis_yn;
            const synthesisYn =
              rawSyn != null && rawSyn !== "" ? String(rawSyn).trim() : undefined;
            const rawGrades = item.grades;
            const grades = Array.isArray(rawGrades)
              ? rawGrades.map((x: unknown) => String(x).trim().toUpperCase()).filter(Boolean)
              : undefined;
            const rawLimited = item.limitedCategoryNames ?? item.limited_category_names;
            const limitedCategoryNames = Array.isArray(rawLimited)
              ? rawLimited.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
              : undefined;
            return {
              egogiftId: Number(item.egogiftId),
              giftName: String(item.giftName ?? "").trim(),
              keywordName: item.keywordName ? String(item.keywordName).trim() || "기타" : "기타",
              giftTier,
              synthesisYn,
              grades: grades?.length ? grades : undefined,
              thumbnail: item.thumbnail ?? item.thumbnail_path,
              limitedCategoryNames: limitedCategoryNames?.length ? limitedCategoryNames : undefined,
            };
          })
          .filter(
            (x: ObservableEgoCatalogItem) =>
              x.egogiftId > 0 &&
              x.giftName &&
              isObservableEgoGiftCandidate(x.giftTier, x.synthesisYn, x.egogiftId, recipeResultIds),
          );
        setObservableEgoGiftCatalog(items);
        observableEgoCatalogFetchedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setObservableEgoGiftCatalog([]);
          observableEgoCatalogFetchedRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setObservableEgoGiftCatalogLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [activeTab, selectedFavoriteId]);

  /** 카탈로그 갱신 시: 목록에 없는 ID·4슬롯 초과 제거 */
  useEffect(() => {
    if (observableEgoGiftCatalog.length === 0) return;
    const allowed = new Set(observableEgoGiftCatalog.map((c) => c.egogiftId));
    setStartEgoGiftIds((prev) => {
      const next = prev.filter((id) => allowed.has(id)).slice(0, 3);
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
    setObservedEgoGiftIds((prev) => {
      const next = prev.filter((id) => allowed.has(id)).slice(0, 3);
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [observableEgoGiftCatalog]);

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
              priorityYn: item.priorityYn ?? item.priority_yn ?? "N",
              limitedCategoryNames: Array.isArray(item.limitedCategoryNames) ? item.limitedCategoryNames : [],
            };
          });
        setResultEgoGifts(filtered);
        /** 합성 전용(Y)만이 아니라 재료로만 쓰이는 에고(층별 한정 등) 조합식도 API가 반환하도록 전부 전달 */
        const resultRowsForSynthesis = filtered as Array<{ egogiftId: number }>;
        const synthesisIds: number[] = [...new Set<number>(resultRowsForSynthesis.map((eg) => eg.egogiftId))];
        if (synthesisIds.length > 0) {
          const q = synthesisIds.map((id) => "egogiftIds=" + id).join("&");
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
    const curExcludeSorted = mergedExcludeCardpackIdsForMissedLimited;
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
    const excludeParams =
      mergedExcludeCardpackIdsForMissedLimited.length > 0
        ? mergedExcludeCardpackIdsForMissedLimited.map((id) => `excludeCardpackIds=${id}`).join("&")
        : "";
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
  }, [
    activeTab,
    resultCardPackDifficulty,
    resultCardPackFloor,
    resultEgoGifts,
    mergedExcludeCardpackIdsForMissedLimited,
    selectedReportSchemaVersion,
  ]);

  // 결과 탭: 키워드별 그룹 (키워드 순서 고정, 기타는 맨 뒤), 그룹 내는 등급 낮은 순(1 → 2 → … → EX)
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
  /** 우선순위 Y인 에고기프트를 같은 키워드 그룹 안에서 먼저 */
  const prioritySortOrder = (priorityYn: string | undefined): number =>
    String(priorityYn ?? "N").trim().toUpperCase() === "Y" ? 0 : 1;
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
      const safeKeyword =
        keyword === RESULT_EGO_FLAT_SECTION_KEY
          ? "모아보기"
          : keyword.replace(/[\\/:*?"<>|]/g, "_").trim() || "키워드";
      const dateStr = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      })();
      const baseName = `${favoriteTitle}_에고기프트_${safeKeyword}${isSynthesis ? "_조합식" : ""}_${dateStr}.png`;

      try {
        const restoreImgs = await inlineExternalImagesForCapture(el);
        try {
          const dataUrl = await snapshotElementToPngDataUrl(el);
          downloadPngDataUrl(baseName, dataUrl);
        } finally {
          restoreImgs();
        }
      } catch (err) {
        console.error(isSynthesis ? "조합식 영역 캡처 실패:" : "키워드 영역 캡처 실패:", formatCaptureError(err), err);
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
      try {
        const restoreImgs = await inlineExternalImagesForCapture(el);
        try {
          const dataUrl = await snapshotElementToPngDataUrl(el);
          downloadPngDataUrl(baseName, dataUrl);
        } finally {
          restoreImgs();
        }
      } catch (err) {
        console.error("전체 에고기프트 캡처 실패:", formatCaptureError(err), err);
      } finally {
        if (excludeSynthesis) el.classList.remove("capture-exclude-synthesis");
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

      try {
        const restoreImgs = await inlineExternalImagesForCapture(cardEl);
        try {
          const dataUrl = await snapshotElementToPngDataUrl(cardEl);
          downloadPngDataUrl(baseName, dataUrl);
        } finally {
          restoreImgs();
        }
      } catch (err) {
        console.error("카드팩 이미지 캡처 실패:", formatCaptureError(err), err);
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

      try {
        const restoreImgs = await inlineExternalImagesForCapture(el);
        try {
          const dataUrl = await snapshotElementToPngDataUrl(el, { expandToScrollHeight: true });
          downloadPngDataUrl(baseName, dataUrl);
        } finally {
          restoreImgs();
        }
      } catch (err) {
        el.style.minHeight = "";
        console.error("카드팩 목록 영역 캡처 실패:", formatCaptureError(err), err);
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

  const captureReportIdentitySectionAsImage = useCallback(async () => {
    const el = reportIdentitySectionRef.current;
    if (!el || typeof window === "undefined") return;
    const favoriteTitle = getFavoriteTitle();
    const tabLabel = reportIdentityTab === "ego" ? "E.G.O선택" : "인격선택";
    const dateStr = (() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    })();
    const baseName = `${favoriteTitle}_인격EGO선택_${tabLabel}_${dateStr}.png`;

    try {
      const restoreImgs = await inlineExternalImagesForCapture(el);
      try {
        const dataUrl = await snapshotElementToPngDataUrl(el, { expandToScrollHeight: true });
        downloadPngDataUrl(baseName, dataUrl);
      } finally {
        restoreImgs();
      }
    } catch (err) {
      console.error("인격/E.G.O 선택 영역 캡처 실패:", formatCaptureError(err), err);
    }
  }, [getFavoriteTitle, reportIdentityTab]);

  const resultEgoGiftsExcludingObserved = useMemo(() => {
    if (observedEgoGiftIds.length === 0 && startEgoGiftIds.length === 0) return resultEgoGifts;
    const hiddenSet = new Set([...observedEgoGiftIds, ...startEgoGiftIds]);
    return resultEgoGifts.filter((eg) => !hiddenSet.has(eg.egogiftId));
  }, [resultEgoGifts, observedEgoGiftIds, startEgoGiftIds]);

  const resultEgoGiftsByKeyword = useMemo(() => {
    const map = new Map<string, typeof resultEgoGifts>();
    for (const eg of resultEgoGiftsExcludingObserved) {
      const key = eg.keywordName ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(eg);
    }
    const ordered: Array<{ keyword: string; egogifts: typeof resultEgoGifts }> = [];
    for (const kw of RESULT_KEYWORD_ORDER) {
      const list = map.get(kw);
      if (list && list.length > 0) {
        const sorted = [...list].sort((a, b) => {
          const priDiff = prioritySortOrder(a.priorityYn) - prioritySortOrder(b.priorityYn);
          if (priDiff !== 0) return priDiff;
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
          const priDiff = prioritySortOrder(a.priorityYn) - prioritySortOrder(b.priorityYn);
          if (priDiff !== 0) return priDiff;
          const tierDiff = tierSortOrder(a.giftTier) - tierSortOrder(b.giftTier);
          if (tierDiff !== 0) return tierDiff;
          return gradeSortOrder(a.grades) - gradeSortOrder(b.grades);
        });
        ordered.push({ keyword: kw, egogifts: sorted });
      }
    }
    return ordered;
  }, [resultEgoGiftsExcludingObserved]);

  /** 모아보기: 키워드 순·등급 정렬 옵션을 반영한 단일 목록 */
  const resultEgoGiftsFlatDisplay = useMemo(() => {
    const cmpKeywordOrder = (a: (typeof resultEgoGifts)[number], b: (typeof resultEgoGifts)[number]) => {
      const ka = ((a.keywordName ?? "기타").trim() || "기타");
      const kb = ((b.keywordName ?? "기타").trim() || "기타");
      const ia = RESULT_KEYWORD_ORDER.indexOf(ka);
      const ib = RESULT_KEYWORD_ORDER.indexOf(kb);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return ka.localeCompare(kb, "ko");
    };
    let base: (typeof resultEgoGifts)[number][];
    if (flatSortByKeyword) {
      base = [];
      for (const { egogifts } of resultEgoGiftsByKeyword) {
        for (const eg of egogifts) base.push(eg);
      }
    } else {
      const seen = new Set<number>();
      base = [];
      for (const id of starredEgoGiftIds) {
        const eg = resultEgoGiftsExcludingObserved.find((e) => e.egogiftId === id);
        if (eg != null && !seen.has(eg.egogiftId)) {
          base.push(eg);
          seen.add(eg.egogiftId);
        }
      }
    }
    if (flatTierSort === "off") {
      return [...base];
    }
    const arr = [...base];
    arr.sort((a, b) => {
      if (flatSortByKeyword) {
        const w = cmpKeywordOrder(a, b);
        if (w !== 0) return w;
      }
      if (flatTierSort === "desc") {
        const td = tierSortOrder(b.giftTier) - tierSortOrder(a.giftTier);
        if (td !== 0) return td;
      } else {
        const ta = tierSortOrder(a.giftTier) - tierSortOrder(b.giftTier);
        if (ta !== 0) return ta;
      }
      const pri = prioritySortOrder(a.priorityYn) - prioritySortOrder(b.priorityYn);
      if (pri !== 0) return pri;
      const gr = gradeSortOrder(a.grades) - gradeSortOrder(b.grades);
      if (gr !== 0) return gr;
      return a.egogiftId - b.egogiftId;
    });
    return arr;
  }, [
    flatSortByKeyword,
    flatTierSort,
    resultEgoGiftsByKeyword,
    starredEgoGiftIds,
    resultEgoGiftsExcludingObserved,
  ]);

  /** 층별 보기: 층별 한정 블록에 이미 나온 에고는 하단 모아보기 그리드에서 제외 */
  const resultEgoGiftsFlatDisplayExcludingFloorLimited = useMemo(() => {
    if (resultEgoGiftViewMode !== "floor") {
      return resultEgoGiftsFlatDisplay;
    }
    const shown = new Set<number>();
    for (const row of floorLimitedRows) {
      for (const eg of row.limitedEgoGifts) {
        shown.add(eg.egogiftId);
      }
    }
    if (shown.size === 0) {
      return resultEgoGiftsFlatDisplay;
    }
    return resultEgoGiftsFlatDisplay.filter((eg) => !shown.has(eg.egogiftId));
  }, [resultEgoGiftViewMode, resultEgoGiftsFlatDisplay, floorLimitedRows]);

  const showFloorLimitedEgoSection = useMemo(
    () =>
      resultEgoGiftViewMode === "floor" &&
      Object.keys(checkedCardPackByFloor).length > 0 &&
      resultEgoGiftsExcludingObserved.some((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0),
    [resultEgoGiftViewMode, checkedCardPackByFloor, resultEgoGiftsExcludingObserved]
  );

  /** 층별 보기: 각 층「조합식」블록 + 하단 모아보기(`__flat__`) 조합식 — 전체 접기 토글 대상 키 */
  const floorViewSynthesisSectionKeys = useMemo(
    () => [RESULT_EGO_FLAT_SECTION_KEY, ...floorLimitedRows.map((r) => `__floor_lim_syn_${r.floor}__`)],
    [floorLimitedRows],
  );
  const floorViewSynthesisAllExpanded = floorViewSynthesisSectionKeys.every(
    (k) => synthesisExpandedByKeyword[k] !== false,
  );

  /** 층별 한정: 키워드별·등급별 정렬을 모아보기 목록과 동일하게 적용(표시 순만 `resultEgoGiftsFlatDisplay`에 맞춤) */
  const floorLimitedRowsForDisplay = useMemo(
    () =>
      floorLimitedRows.map((row) => {
        if (row.limitedEgoGifts.length === 0) {
          return row;
        }
        const limitedIdSet = new Set(row.limitedEgoGifts.map((e) => e.egogiftId));
        const sorted = resultEgoGiftsFlatDisplay.filter((eg) => limitedIdSet.has(eg.egogiftId));
        const sortedIds = new Set(sorted.map((e) => e.egogiftId));
        for (const eg of row.limitedEgoGifts) {
          if (!sortedIds.has(eg.egogiftId)) {
            sorted.push(eg);
          }
        }
        return { ...row, limitedEgoGifts: sorted };
      }),
    [floorLimitedRows, resultEgoGiftsFlatDisplay]
  );

  const resolveCardPackMetaForFloor = useCallback(
    (cardpackId: number): { title: string; thumbnail?: string } => {
      const fromPlan = plannableCardPacks.find((p) => p.cardpackId === cardpackId);
      if (fromPlan) return { title: fromPlan.title, thumbnail: fromPlan.thumbnail };
      const fromStarred = resultStarredCardPacks.find((p) => p.cardpackId === cardpackId);
      if (fromStarred) return { title: fromStarred.title, thumbnail: fromStarred.thumbnail };
      return { title: `카드팩 #${cardpackId}` };
    },
    [plannableCardPacks, resultStarredCardPacks]
  );

  useEffect(() => {
    if (resultEgoGiftViewMode !== "floor" || activeTab !== "result") {
      setFloorLimitedRows([]);
      setFloorLimitedRowsLoading(false);
      return;
    }
    const limited = resultEgoGiftsExcludingObserved.filter((eg) => eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0);
    const floors = Object.keys(checkedCardPackByFloor)
      .map(Number)
      .filter((f) => !Number.isNaN(f))
      .sort((a, b) => a - b);
    if (floors.length === 0 || limited.length === 0) {
      setFloorLimitedRows([]);
      setFloorLimitedRowsLoading(false);
      return;
    }
    let cancelled = false;
    setFloorLimitedRowsLoading(true);
    void (async () => {
      const floorRequests = floors
        .map((floor) => {
          const packId = checkedCardPackByFloor[floor];
          if (!packId) return null;
          let difficulties: string[];
          if (selectedReportSchemaVersion === 2) {
            const tab = plannedCardPackDifficultyByFloor[floor] ?? getV2ModalDefaultDifficultyForFloor(floor);
            difficulties = [...V2_MODAL_TAB_API_DIFFICULTIES[tab]];
          } else {
            const allowed = MODAL_DIFFICULTY_ALLOWED[resultCardPackDifficulty];
            difficulties = allowed?.length ? [...allowed] : ["노말"];
          }
          return { floor, difficulties };
        })
        .filter((row): row is { floor: number; difficulties: string[] } => row != null);

      let byFloor: Record<string, Record<string, { cardpackId?: unknown }[]>> = {};
      try {
        const res = await fetch(`${API_BASE_URL}/user/cardpack/for-limited-starred-egogifts-by-floor-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            floorRequests,
            egogiftIds: limited.map((eg) => eg.egogiftId),
            excludeCardpackIds: [],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            byFloor?: Record<string, Record<string, { cardpackId?: unknown }[]>>;
          };
          byFloor = data.byFloor ?? {};
        }
      } catch {
        byFloor = {};
      }

      const built = floorRequests.map(({ floor }) => {
        const packId = checkedCardPackByFloor[floor];
        if (!packId) return null;
        const byEgo = byFloor[String(floor)] ?? {};
        const matched: ResultEgoGiftItem[] = [];
        for (const eg of limited) {
          const items = byEgo[String(eg.egogiftId)] ?? [];
          if (items.some((item) => Number(item.cardpackId) === packId)) {
            matched.push(eg);
          }
        }
        matched.sort((a, b) => a.egogiftId - b.egogiftId);
        const meta = resolveCardPackMetaForFloor(packId);
        return {
          floor,
          cardpackId: packId,
          title: meta.title,
          limitedEgoGifts: matched,
          ...(meta.thumbnail != null && meta.thumbnail !== "" ? { thumbnail: meta.thumbnail } : {}),
        };
      });
      const rows = built.filter((row) => row != null);
      rows.sort((a, b) => a.floor - b.floor);
      if (!cancelled) {
        setFloorLimitedRows(rows);
        setFloorLimitedRowsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    resultEgoGiftViewMode,
    activeTab,
    checkedCardPackByFloor,
    resultEgoGiftsExcludingObserved,
    selectedReportSchemaVersion,
    plannedCardPackDifficultyByFloor,
    resultCardPackDifficulty,
    resolveCardPackMetaForFloor,
  ]);

  // 저장 실패 토스트: 잠시 후 제거
  useEffect(() => {
    if (!saveFailureToastMessage) return;
    const t = setTimeout(() => setSaveFailureToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [saveFailureToastMessage]);

  // 공유 링크 복사 토스트: 2초 후 제거
  useEffect(() => {
    if (!shareToastMessage) return;
    const t = setTimeout(() => setShareToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [shareToastMessage]);

  useEffect(() => {
    if (favoriteActionsMenuId == null) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-favorite-actions-menu-root]")) return;
      setFavoriteActionsMenuId(null);
      setFavoriteActionsMenuPosition(null);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [favoriteActionsMenuId]);

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
      setSaveFailureToastMessage("UUID를 생성할 수 없습니다.");
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
      startEgoGiftIds: [] as number[],
      observedEgoGiftIds: [] as number[],
      reportPersonalitySlots: emptyReportPersonalitySlots(),
      reportEgoSlots: emptyReportEgoSlots(),
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
        setResultEgoGiftViewMode("keyword");
        setStartEgoGiftIds([]);
        setObservedEgoGiftIds([]);
        setReportPersonalitySlots(emptyReportPersonalitySlots());
        setReportEgoSlots(emptyReportEgoSlots());
        setSelectedFavoriteId(null);
        resetResultTabUiPrefsToDefaults();
        await fetchFavorites();
      } else {
        setSaveFailureToastMessage(data.message ?? "등록에 실패했습니다.");
      }
    } catch {
      setSaveFailureToastMessage("등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  /** 결과 탭 보고서 JSON — handleSave·자동 저장 스킵 판별에서 동일 규칙으로 사용 */
  const computeReportFavoriteSaveSearchJson = useCallback((): string | null => {
    if (selectedFavoriteId === null) return null;
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
      startEgoGiftIds?: number[];
      observedEgoGiftIds?: number[];
      resultEgoGiftViewByKeyword?: boolean;
      resultEgoGiftViewMode?: string;
      reportPersonalitySlots?: unknown;
      reportEgoSlots?: unknown;
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
      startEgoGiftIds: startEgoGiftIds.slice(0, 3),
      observedEgoGiftIds: observedEgoGiftIds.slice(0, 3),
      ...(resultEgoGiftViewMode === "keyword"
        ? {}
        : resultEgoGiftViewMode === "flat"
          ? { resultEgoGiftViewByKeyword: false }
          : { resultEgoGiftViewByKeyword: false, resultEgoGiftViewMode: "floor" }),
      reportPersonalitySlots,
      reportEgoSlots,
      resultSimplified,
      v2PlannedSectionExpanded,
      v2PlannedSectionSimplified,
      missedLimitedCardPacksExpanded,
      pinnedEgoSectionsExpanded,
      pinnedEgoSectionsSimplified,
    };
    return JSON.stringify(merged);
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
    startEgoGiftIds,
    observedEgoGiftIds,
    resultEgoGiftViewMode,
    reportPersonalitySlots,
    reportEgoSlots,
    resultSimplified,
    v2PlannedSectionExpanded,
    v2PlannedSectionSimplified,
    missedLimitedCardPacksExpanded,
    pinnedEgoSectionsExpanded,
    pinnedEgoSectionsSimplified,
  ]);

  /** 선택된 즐겨찾기 전체 저장 (상단 저장 버튼·결과 탭 자동 저장) */
  const handleSave = useCallback(async (options?: { refreshList?: boolean }) => {
    const shouldRefreshList = options?.refreshList ?? true;
    if (selectedFavoriteId === null) return;
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setSaveFailureToastMessage("UUID를 생성할 수 없습니다.");
      return;
    }
    const searchJson = computeReportFavoriteSaveSearchJson();
    if (searchJson == null) return;
    const payload = { searchJson };
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
        if (shouldRefreshList) {
          await fetchFavorites();
        } else {
          setItems((prev) =>
            prev.map((item) =>
              item.favoriteId === selectedFavoriteId
                ? { ...item, searchJson: payload.searchJson }
                : item
            )
          );
        }
      } else {
        setSaveFailureToastMessage(data.message ?? "저장에 실패했습니다.");
      }
    } catch {
      setSaveFailureToastMessage("저장에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  }, [selectedFavoriteId, computeReportFavoriteSaveSearchJson, fetchFavorites]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const openPersonalityPicker = useCallback(async (slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= REPORT_PERSONALITY_OPTIONS.length) return;
    setPersonalityPickerSlotIndex(slotIndex);
    setPersonalityPickerShowAfter({});
    setPersonalityPickerLoading(true);
    setPersonalityPickerError("");
    setPersonalityPickerList([]);
    const order = REPORT_PERSONALITY_OPTIONS[slotIndex].order;
    try {
      const list = await fetchUserPersonalityList(order);
      const sorted = [...list].sort((a, b) => {
        const ga = Number(a.grade) || 0;
        const gb = Number(b.grade) || 0;
        if (ga !== gb) return ga - gb;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""), "ko");
      });
      setPersonalityPickerList(sorted);
    } catch {
      setPersonalityPickerError("인격 목록을 불러오지 못했습니다.");
    } finally {
      setPersonalityPickerLoading(false);
    }
  }, []);

  const applyPersonalityFromPicker = useCallback(
    (slotIndex: number, row: UserPersonalityListItem, useAfterThumb: boolean) => {
      const beforePath = extractPathFromUnknownImage(row.beforeSyncImage);
      const afterPath = extractPathFromUnknownImage(row.afterSyncImage);
      const path =
        (useAfterThumb ? afterPath : beforePath) ||
        beforePath ||
        afterPath ||
        "";
      const normalizedKeywords = (row.keywords ?? [])
        .map((k) => String(k ?? "").trim())
        .filter(Boolean);
      setReportPersonalitySlots((prev) => {
        const next = [...prev];
        const prevFormationOrder = next[slotIndex]?.formationOrder ?? null;
        next[slotIndex] = {
          personalityId: row.personalityId,
          name: row.name.trim() || "이름 없음",
          grade: row.grade,
          imagePath: path,
          keywords: normalizedKeywords,
          beforeSyncImagePath: beforePath,
          afterSyncImagePath: afterPath,
          useAfterSyncImage: useAfterThumb,
          formationOrder: prevFormationOrder,
          skillAttributes: (row.skillAttributes ?? []).slice(0, 3),
          skillAttackTypes: (row.skillAttackTypes ?? []).slice(0, 3),
          skillInputValues: ["3", "2", "1"],
        };
        return next;
      });
      setPersonalityPickerSlotIndex(null);
    },
    []
  );

  const clearPersonalityFromPicker = useCallback(() => {
    if (personalityPickerSlotIndex == null) return;
    setReportPersonalitySlots((prev) => {
      const next = [...prev];
      const removedOrder = next[personalityPickerSlotIndex]?.formationOrder ?? null;
      next[personalityPickerSlotIndex] = null;
      if (removedOrder != null) {
        for (let i = 0; i < next.length; i += 1) {
          const slot = next[i];
          if (!slot?.formationOrder) continue;
          if (slot.formationOrder > removedOrder) {
            next[i] = { ...slot, formationOrder: slot.formationOrder - 1 };
          }
        }
      }
      return next;
    });
    setPersonalityPickerSlotIndex(null);
  }, [personalityPickerSlotIndex]);

  const openEgoPicker = useCallback(async (slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= REPORT_PERSONALITY_OPTIONS.length) return;
    setEgoPickerSlotIndex(slotIndex);
    setEgoPickerLoading(true);
    setEgoPickerError("");
    setEgoPickerList([]);
    const current = reportEgoSlots[slotIndex]?.selectedByGrade ?? {};
    setEgoPickerSelectedByGrade({ ...current });
    const order = REPORT_PERSONALITY_OPTIONS[slotIndex].order;
    try {
      const list = await fetchUserPersonalityEgoList(order);
      setEgoPickerList(list);
    } catch {
      setEgoPickerError("에고 목록을 불러오지 못했습니다.");
    } finally {
      setEgoPickerLoading(false);
    }
  }, [reportEgoSlots]);

  const toggleEgoPickerSelection = useCallback((row: UserPersonalityEgoListItem) => {
    const grade = String(row.libraryGrade ?? "").trim().toUpperCase() as keyof ReportEgoSlotSaved["selectedByGrade"];
    if (!REPORT_EGO_GRADE_ORDER.includes(grade as any)) return;
    const imagePath = extractPathFromUnknownImage(row.image);
    setEgoPickerSelectedByGrade((prev) => {
      const next = { ...prev };
      if (next[grade]?.egoId === row.egoId) {
        delete next[grade];
      } else {
        next[grade] = {
          egoId: row.egoId,
          title: String(row.title ?? "").trim() || "이름 없음",
          libraryGrade: grade,
          imagePath,
          wrathCost: Number(row.wrathCost ?? 0) || 0,
          lustCost: Number(row.lustCost ?? 0) || 0,
          slothCost: Number(row.slothCost ?? 0) || 0,
          gluttonyCost: Number(row.gluttonyCost ?? 0) || 0,
          gloomCost: Number(row.gloomCost ?? 0) || 0,
          prideCost: Number(row.prideCost ?? 0) || 0,
          envyCost: Number(row.envyCost ?? 0) || 0,
        };
      }
      return next;
    });
  }, []);

  const clearAllEgoPickerSelection = useCallback(() => {
    setEgoPickerSelectedByGrade({});
  }, []);

  const applyEgoPickerSelection = useCallback(() => {
    if (egoPickerSlotIndex == null) return;
    setReportEgoSlots((prev) => {
      const next = [...prev];
      next[egoPickerSlotIndex] = { selectedByGrade: { ...egoPickerSelectedByGrade } };
      return next;
    });
    setEgoPickerSlotIndex(null);
  }, [egoPickerSelectedByGrade, egoPickerSlotIndex]);

  useEffect(() => {
    if (selectedFavoriteId == null) return;
    const attemptKeyPrefix = `${selectedFavoriteId}:`;
    const needsBackfill = reportPersonalitySlots.some((slot) => {
      if (!slot) return false;
      const attemptKey = `${attemptKeyPrefix}${slot.personalityId}`;
      if (personalitySlotBackfillAttemptedRef.current.has(attemptKey)) return false;
      const hasKeywords = Array.isArray(slot.keywords);
      const hasSyncPaths = Boolean(slot.beforeSyncImagePath) || Boolean(slot.afterSyncImagePath);
      return !hasKeywords || !hasSyncPaths;
    });
    if (!needsBackfill) return;
    let cancelled = false;
    (async () => {
      const cache = new Map<number, UserPersonalityListItem[]>();
      const next = [...reportPersonalitySlots];
      let changed = false;
      for (let slotIndex = 0; slotIndex < REPORT_PERSONALITY_OPTIONS.length; slotIndex += 1) {
        const slot = next[slotIndex];
        if (!slot?.personalityId) continue;
        const attemptKey = `${attemptKeyPrefix}${slot.personalityId}`;
        if (personalitySlotBackfillAttemptedRef.current.has(attemptKey)) continue;
        const hasKeywords = Array.isArray(slot.keywords);
        const hasBefore = Boolean(slot.beforeSyncImagePath);
        const hasAfter = Boolean(slot.afterSyncImagePath);
        if (hasKeywords && (hasBefore || hasAfter)) {
          personalitySlotBackfillAttemptedRef.current.add(attemptKey);
          continue;
        }
        const order = REPORT_PERSONALITY_OPTIONS[slotIndex].order;
        if (!cache.has(order)) {
          try {
            cache.set(order, await fetchUserPersonalityList(order));
          } catch {
            cache.set(order, []);
          }
        }
        personalitySlotBackfillAttemptedRef.current.add(attemptKey);
        const list = cache.get(order) ?? [];
        const found = list.find((r) => r.personalityId === slot.personalityId);
        if (!found) continue;
        const normalizedKeywords = (found.keywords ?? [])
          .map((k) => String(k ?? "").trim())
          .filter(Boolean);
        const beforePath = extractPathFromUnknownImage(found.beforeSyncImage);
        const afterPath = extractPathFromUnknownImage(found.afterSyncImage);
        const syncedPath = (slot.useAfterSyncImage !== false ? afterPath : beforePath) || beforePath || afterPath;
        const mergedSlot: ReportPersonalitySlotSaved = {
          ...slot,
          keywords: normalizedKeywords,
          skillAttributes: (found.skillAttributes ?? []).slice(0, 3),
          skillAttackTypes: (found.skillAttackTypes ?? []).slice(0, 3),
          beforeSyncImagePath: beforePath || slot.beforeSyncImagePath || "",
          afterSyncImagePath: afterPath || slot.afterSyncImagePath || "",
          imagePath: slot.imagePath || syncedPath || slot.imagePath,
          useAfterSyncImage:
            slot.useAfterSyncImage ?? (afterPath ? true : slot.useAfterSyncImage),
        };
        const prevSerialized = JSON.stringify(slot);
        const nextSerialized = JSON.stringify(mergedSlot);
        if (prevSerialized !== nextSerialized) {
          next[slotIndex] = mergedSlot;
          changed = true;
        }
      }
      if (!cancelled && changed) {
        setReportPersonalitySlots(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFavoriteId, reportPersonalitySlots]);

  const reportPersonalityKeywordCounts = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const slot of reportPersonalitySlots) {
      if (!slot) continue;
      const uniq = new Set<string>();
      for (const raw of slot.keywords ?? []) {
        const keyword = normalizePersonalityKeyword(raw);
        if (!keyword || !RESULT_KEYWORD_ICON_MAP[keyword]) continue;
        uniq.add(keyword);
      }
      for (const keyword of uniq) {
        countMap.set(keyword, (countMap.get(keyword) ?? 0) + 1);
      }
    }
    const ordered = PERSONALITY_MODAL_KEYWORD_ORDER
      .map((keyword) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count: countMap.get(keyword) ?? 0,
      }))
      .filter((row) => row.count > 0);
    const rest = Array.from(countMap.entries())
      .filter(([keyword]) => !PERSONALITY_MODAL_KEYWORD_ORDER.some((k) => k === keyword))
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([keyword, count]) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count,
      }))
      .filter((row) => row.iconPath);
    return [...ordered, ...rest];
  }, [reportPersonalitySlots]);
  const reportPersonalityFormationKeywordCounts = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const slot of reportPersonalitySlots) {
      if (!slot || !slot.formationOrder || slot.formationOrder < 1 || slot.formationOrder > 7) continue;
      const uniq = new Set<string>();
      for (const raw of slot.keywords ?? []) {
        const keyword = normalizePersonalityKeyword(raw);
        if (!keyword || !RESULT_KEYWORD_ICON_MAP[keyword]) continue;
        uniq.add(keyword);
      }
      for (const keyword of uniq) {
        countMap.set(keyword, (countMap.get(keyword) ?? 0) + 1);
      }
    }
    const ordered = PERSONALITY_MODAL_KEYWORD_ORDER
      .map((keyword) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count: countMap.get(keyword) ?? 0,
      }))
      .filter((row) => row.count > 0);
    const rest = Array.from(countMap.entries())
      .filter(([keyword]) => !PERSONALITY_MODAL_KEYWORD_ORDER.some((k) => k === keyword))
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([keyword, count]) => ({
        keyword,
        iconPath: RESULT_KEYWORD_ICON_MAP[keyword],
        count,
      }))
      .filter((row) => row.iconPath);
    return [...ordered, ...rest];
  }, [reportPersonalitySlots]);
  const reportFormationRound1AcquirableResources = useMemo(
    () => computeFormationRound1AcquirableResources(reportPersonalitySlots),
    [reportPersonalitySlots]
  );
  const reportEgoResourceCounts = useMemo(() => {
    const acc: Record<string, number> = {
      분노: 0,
      색욕: 0,
      나태: 0,
      탐식: 0,
      우울: 0,
      오만: 0,
      질투: 0,
    };
    for (const slot of reportEgoSlots) {
      const selected = slot?.selectedByGrade;
      if (!selected) continue;
      for (const grade of REPORT_EGO_GRADE_ORDER) {
        const picked = selected[grade];
        if (!picked) continue;
        acc.분노 += Number(picked.wrathCost ?? 0) || 0;
        acc.색욕 += Number(picked.lustCost ?? 0) || 0;
        acc.나태 += Number(picked.slothCost ?? 0) || 0;
        acc.탐식 += Number(picked.gluttonyCost ?? 0) || 0;
        acc.우울 += Number(picked.gloomCost ?? 0) || 0;
        acc.오만 += Number(picked.prideCost ?? 0) || 0;
        acc.질투 += Number(picked.envyCost ?? 0) || 0;
      }
    }
    return Object.entries(acc).map(([name, value]) => ({
      name,
      value,
      iconPath: EGO_RESOURCE_ICON_MAP[name],
    }));
  }, [reportEgoSlots]);
  /** 인격 슬롯 키워드 초기 갱신: 보고서·결과 탭 전환 시 한 번만 (reportPersonalitySlots 의존 시 슬롯 변경마다 반복 실행됨) */
  useEffect(() => {
    if (selectedFavoriteId == null || activeTab !== "result") return;
    if (reportPersonalityInitialRefreshDoneRef.current.has(selectedFavoriteId)) return;
    const hasPersonality = reportPersonalitySlots.some((slot) => slot?.personalityId);
    if (!hasPersonality) return;
    reportPersonalityInitialRefreshDoneRef.current.add(selectedFavoriteId);
    let cancelled = false;
    (async () => {
      const cache = new Map<number, UserPersonalityListItem[]>();
      const next = [...reportPersonalitySlots];
      let changed = false;
      for (let slotIndex = 0; slotIndex < REPORT_PERSONALITY_OPTIONS.length; slotIndex += 1) {
        const slot = next[slotIndex];
        if (!slot?.personalityId) continue;
        const order = REPORT_PERSONALITY_OPTIONS[slotIndex].order;
        if (!cache.has(order)) {
          try {
            cache.set(order, await fetchUserPersonalityList(order));
          } catch {
            cache.set(order, []);
          }
        }
        const found = (cache.get(order) ?? []).find((r) => r.personalityId === slot.personalityId);
        if (!found) continue;
        const latestKeywords = (found.keywords ?? [])
          .map((kw) => String(kw ?? "").trim())
          .filter(Boolean);
        const latestAttrs = (found.skillAttributes ?? []).slice(0, 3);
        const latestAttackTypes = (found.skillAttackTypes ?? []).slice(0, 3);
        const prevKeywords = (slot.keywords ?? [])
          .map((kw) => String(kw ?? "").trim())
          .filter(Boolean);
        const prevAttrs = (slot.skillAttributes ?? []).slice(0, 3);
        const prevAttackTypes = (slot.skillAttackTypes ?? []).slice(0, 3);
        if (
          JSON.stringify(latestKeywords) !== JSON.stringify(prevKeywords) ||
          JSON.stringify(latestAttrs) !== JSON.stringify(prevAttrs) ||
          JSON.stringify(latestAttackTypes) !== JSON.stringify(prevAttackTypes)
        ) {
          next[slotIndex] = {
            ...slot,
            keywords: latestKeywords,
            skillAttributes: latestAttrs,
            skillAttackTypes: latestAttackTypes,
          };
          changed = true;
        }
      }
      if (!cancelled && changed) {
        setReportPersonalitySlots(next);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 스냅샷만 사용 (reportPersonalitySlots 넣지 않음)
  }, [selectedFavoriteId, activeTab]);

  const egoPickerGroupedByGrade = useMemo(() => {
    const map: Record<string, UserPersonalityEgoListItem[]> = {};
    for (const grade of REPORT_EGO_GRADE_ORDER) map[grade] = [];
    for (const row of egoPickerList) {
      const grade = String(row.libraryGrade ?? "").trim().toUpperCase();
      if (!map[grade]) map[grade] = [];
      map[grade].push(row);
    }
    return map;
  }, [egoPickerList]);
  const activeReportIdentitySlots = reportPersonalitySlots;

  const applyReportSlotSyncThumb = useCallback(
    (slotIndex: number, useAfterThumb: boolean) => {
      setReportPersonalitySlots((prev) => {
        const next = [...prev];
        const cur = next[slotIndex];
        if (!cur) return prev;
        const beforePath = cur.beforeSyncImagePath ?? "";
        const afterPath = cur.afterSyncImagePath ?? "";
        const path = (useAfterThumb ? afterPath : beforePath) || beforePath || afterPath || cur.imagePath;
        next[slotIndex] = {
          ...cur,
          imagePath: path,
          useAfterSyncImage: useAfterThumb,
        };
        return next;
      });
    },
    []
  );

  const toggleFormationForSlot = useCallback(
    (slotIndex: number) => {
      setReportPersonalitySlots((prev) => {
        const next = [...prev];
        const cur = next[slotIndex];
        if (!cur) return prev;
        const currentOrder = cur.formationOrder ?? null;
        if (currentOrder == null) {
          const maxOrder = next.reduce((max, slot) => {
            const n = slot?.formationOrder ?? 0;
            return n > max ? n : max;
          }, 0);
          const newOrder = Math.min(12, maxOrder + 1);
          next[slotIndex] = { ...cur, formationOrder: newOrder };
          return next;
        }
        next[slotIndex] = { ...cur, formationOrder: null };
        for (let i = 0; i < next.length; i += 1) {
          const slot = next[i];
          if (!slot?.formationOrder) continue;
          if (slot.formationOrder > currentOrder) {
            next[i] = { ...slot, formationOrder: slot.formationOrder - 1 };
          }
        }
        return next;
      });
    },
    []
  );

  const resetFormationOrders = useCallback(() => {
    if (reportIdentityTab === "ego") return;
    setReportPersonalitySlots((prev) => prev.map((slot) => (slot ? { ...slot, formationOrder: null } : null)));
  }, [reportIdentityTab]);

  const clearAllIdentitySlots = useCallback(() => {
    if (reportIdentityTab === "ego") {
      setReportEgoSlots(emptyReportEgoSlots());
    } else {
      setReportPersonalitySlots(emptyReportPersonalitySlots());
    }
  }, [reportIdentityTab]);

  useEffect(() => {
    if (skillPresetMenuSlotIndex == null) return;
    const close = () => setSkillPresetMenuSlotIndex(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [skillPresetMenuSlotIndex]);

  const prevTabForV2AutosaveRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabForV2AutosaveRef.current !== "result" && activeTab === "result") {
      reportAutosaveSkipNextRef.current = true;
    }
    prevTabForV2AutosaveRef.current = activeTab;
  }, [activeTab]);

  /** 결과 탭: 보고서 JSON 변경 시 자동 저장 (handleSave는 ref로 호출해 저장 후 items 갱신으로 재트리거 방지) */
  useEffect(() => {
    if (activeTab !== "result" || selectedFavoriteId == null) return;
    if (reportAutosaveSkipNextRef.current) {
      reportAutosaveSkipNextRef.current = false;
      return;
    }
    const nextJson = computeReportFavoriteSaveSearchJson();
    if (nextJson == null) return;
    const item = items.find((i) => i.favoriteId === selectedFavoriteId);
    if (item?.searchJson === nextJson) return;
    const t = window.setTimeout(() => {
      void handleSaveRef.current({ refreshList: false });
    }, 150);
    return () => window.clearTimeout(t);
  }, [activeTab, selectedFavoriteId, items, computeReportFavoriteSaveSearchJson]);

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
      setSaveFailureToastMessage("UUID를 생성할 수 없습니다.");
      return;
    }
    const trimmed = editingTitleInput.trim();
    let parsed: { title?: string; [key: string]: unknown } = {};
    try {
      parsed = JSON.parse(item.searchJson) as { title?: string; [key: string]: unknown };
    } catch {
      setSaveFailureToastMessage("저장 데이터를 읽을 수 없습니다.");
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
        setSaveFailureToastMessage(data.message ?? "제목 수정에 실패했습니다.");
      }
    } catch {
      setSaveFailureToastMessage("제목 수정에 실패했습니다.");
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

  const fetchShareBoardPosts = useCallback(async () => {
    setShareBoardLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", shareBoardSort);
      params.set("page", String(shareBoardPage));
      params.set("size", "20");
      params.set("popularOnly", shareBoardPopularOnly ? "true" : "false");
      if (shareBoardSearchText.trim()) {
        params.set("q", shareBoardSearchText.trim());
        params.set("searchType", shareBoardSearchType);
      }
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const next: ShareBoardPostItem[] = Array.isArray(data.items)
          ? data.items.map((raw: any) => ({
              postId: Number(raw.postId),
              favoriteId: Number(raw.favoriteId),
              title: String(raw.title ?? ""),
              description: String(raw.description ?? ""),
              authorNickname: String(raw.authorNickname ?? ""),
              createdAt: String(raw.createdAt ?? ""),
              updatedAt: String(raw.updatedAt ?? ""),
              viewCount: Number(raw.viewCount ?? 0),
              recommendCount: Number(raw.recommendCount ?? 0),
              periodRecommendCount: Number(raw.periodRecommendCount ?? 0),
              recommendedByMe: Boolean(raw.recommendedByMe),
              commentCount: Number(raw.commentCount ?? 0),
              isMine: Boolean(raw.isMine),
            }))
          : [];
        const normalizedItems = next.filter((post) => post.postId > 0);
        setShareBoardPosts(normalizedItems);
        const parsedTotalPages = Number(data.totalPages);
        const parsedTotalCount = Number(data.totalCount);
        setShareBoardTotalPages(
          Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
            ? Math.max(1, Math.floor(parsedTotalPages))
            : Math.max(1, Math.ceil(normalizedItems.length / 20) || 1)
        );
        setShareBoardTotalCount(
          Number.isFinite(parsedTotalCount) && parsedTotalCount >= 0
            ? Math.max(0, Math.floor(parsedTotalCount))
            : normalizedItems.length
        );
      } else {
        setShareBoardPosts([]);
        setShareBoardTotalPages(1);
        setShareBoardTotalCount(0);
      }
    } catch {
      setShareBoardPosts([]);
      setShareBoardTotalPages(1);
      setShareBoardTotalCount(0);
    } finally {
      setShareBoardLoading(false);
    }
  }, [shareBoardSearchText, shareBoardSearchType, shareBoardSort, shareBoardPage, shareBoardPopularOnly]);

  const fetchShareBoardComments = useCallback(async (postId: number) => {
    if (!Number.isFinite(postId) || postId <= 0) {
      setShareBoardComments([]);
      return;
    }
    setShareBoardCommentsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${postId}/comments`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const next: ShareBoardCommentItem[] = Array.isArray(data.items)
          ? data.items.map((raw: any) => ({
              commentId: Number(raw.commentId),
              postId: Number(raw.postId),
              parentCommentId: raw.parentCommentId == null ? null : Number(raw.parentCommentId),
              depth: Number(raw.depth ?? 1),
              authorNickname: String(raw.authorNickname ?? ""),
              content: String(raw.content ?? ""),
              deletedYn: String(raw.deletedYn ?? "N"),
              createdAt: String(raw.createdAt ?? ""),
              updatedAt: String(raw.updatedAt ?? ""),
              isMine: Boolean(raw.isMine),
            }))
          : [];
        setShareBoardComments(next.filter((c) => c.commentId > 0));
      } else {
        setShareBoardComments([]);
      }
    } catch {
      setShareBoardComments([]);
    } finally {
      setShareBoardCommentsLoading(false);
    }
  }, []);

  const handleShareBoardToggleRecommend = async () => {
    if (!shareBoardSelectedPost) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${shareBoardSelectedPost.postId}/recommend`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "추천 처리에 실패했습니다.");
        return;
      }
      const recommendCount = Number(data.recommendCount ?? 0);
      const recommendedByMe = Boolean(data.recommendedByMe);
      setShareBoardSelectedPost((prev) => (prev ? { ...prev, recommendCount, recommendedByMe } : prev));
      setShareBoardPosts((prev) =>
        prev.map((p) =>
          p.postId === shareBoardSelectedPost.postId ? { ...p, recommendCount, recommendedByMe } : p
        )
      );
    } catch {
      setError("추천 처리에 실패했습니다.");
    }
  };

  const submitShareBoardComment = async (content: string, parentCommentId?: number | null) => {
    if (!shareBoardSelectedPost) return;
    if (!shareBoardAuthenticated) {
      setError("로그인이 필요합니다.");
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) return;
    setShareBoardCommentSubmitting(true);
    try {
      const body: Record<string, unknown> = { content: trimmed };
      if (parentCommentId) body.parentCommentId = parentCommentId;
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${shareBoardSelectedPost.postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "댓글 등록에 실패했습니다.");
        return;
      }
      setShareBoardCommentInput("");
      setShareBoardReplyInput("");
      setShareBoardReplyParentId(null);
      await fetchShareBoardComments(shareBoardSelectedPost.postId);
    } catch {
      setError("댓글 등록에 실패했습니다.");
    } finally {
      setShareBoardCommentSubmitting(false);
    }
  };

  const deleteShareBoardComment = async (commentId: number) => {
    if (!shareBoardSelectedPost) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "댓글 삭제에 실패했습니다.");
        return;
      }
      await fetchShareBoardComments(shareBoardSelectedPost.postId);
    } catch {
      setError("댓글 삭제에 실패했습니다.");
    }
  };

  const moveToShareBoardWithFavorite = (e: React.MouseEvent, favoriteId: number) => {
    e.stopPropagation();
    if (!ensureShareBoardRegisterAccess()) return;
    const target = items.find((it) => it.favoriteId === favoriteId);
    let suggestedTitle = "";
    try {
      const parsed = target ? (JSON.parse(target.searchJson) as { title?: string }) : null;
      suggestedTitle = (parsed?.title ?? "").trim();
    } catch {
      suggestedTitle = "";
    }
    setShareBoardFavoriteId(favoriteId);
    setShareBoardTitleInput(suggestedTitle);
    setShareBoardDescriptionInput("");
    setActiveTab("share-board");
    pushFavoritesRoute({
      tab: "share-board",
      shareBoardMode: "new",
      favoriteId: String(favoriteId),
      postId: null,
    });
  };

  const handleShareBoardRegister = async () => {
    if (!shareBoardFavoriteId) {
      setError("공유할 보고서를 선택해주세요.");
      return;
    }
    const title = shareBoardTitleInput.trim();
    if (!title) {
      setError("게시글 제목을 입력해주세요.");
      return;
    }
    setShareBoardRegistering(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          favoriteId: shareBoardFavoriteId,
          title,
          description: shareBoardDescriptionInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const createdPostId = Number(data.data?.postId ?? 0);
        setShareBoardTitleInput("");
        setShareBoardDescriptionInput("");
        await fetchShareBoardPosts();
        setShareToastMessage("공유게시판에 등록되었습니다.");
        if (createdPostId > 0) {
          await handleShareBoardOpenPost(createdPostId);
        } else {
          pushFavoritesRoute({ tab: "share-board", shareBoardMode: "list", postId: null, favoriteId: null });
        }
      } else {
        setError(data.message ?? "공유게시판 등록에 실패했습니다.");
      }
    } catch {
      setError("공유게시판 등록에 실패했습니다.");
    } finally {
      setShareBoardRegistering(false);
    }
  };

  const handleShareBoardOpenPost = async (postId: number) => {
    pushFavoritesRoute({
      tab: "share-board",
      shareBoardMode: "detail",
      postId: String(postId),
      favoriteId: null,
    });
    setImporting(true);
    setError(null);
    try {
      const detailRes = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${postId}`, {
        credentials: "include",
      });
      const detailData = await detailRes.json();
      if (!detailRes.ok || !detailData.success || !detailData.data?.searchJson) {
        setError(detailData.message ?? "게시글을 불러오지 못했습니다.");
        return;
      }
      setShareBoardSelectedPost({
        postId: Number(detailData.data.postId),
        favoriteId: Number(detailData.data.favoriteId),
        title: String(detailData.data.title ?? ""),
        description: String(detailData.data.description ?? ""),
        authorNickname: String(detailData.data.authorNickname ?? ""),
        createdAt: String(detailData.data.createdAt ?? ""),
        updatedAt: String(detailData.data.updatedAt ?? ""),
        viewCount: Number(detailData.data.viewCount ?? 0),
        recommendCount: Number(detailData.data.recommendCount ?? 0),
        recommendedByMe: Boolean(detailData.data.recommendedByMe),
        commentCount: Number(detailData.data.commentCount ?? 0),
        pageType: String(detailData.data.pageType ?? "FAVORITE"),
        searchJson: String(detailData.data.searchJson ?? "{}"),
        schemaVersion: Number(detailData.data.schemaVersion ?? 1),
        isMine: Boolean(detailData.data.isMine),
      });
      setShareBoardEditing(false);
      setShareBoardEditTitle("");
      setShareBoardEditDescription("");
      await fetchShareBoardComments(Number(detailData.data.postId));
      await fetchShareBoardPosts();
    } catch {
      setError("게시글을 불러오지 못했습니다.");
    } finally {
      setImporting(false);
    }
  };

  const handleShareBoardCopyToReport = async () => {
    if (!shareBoardSelectedPost?.searchJson) return;
    const uuid = getOrCreateUUID();
    if (!uuid) {
      setError("UUID를 생성할 수 없습니다.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const saveRes = await fetch(`${API_BASE_URL}/user/favorite-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-UUID": uuid },
        credentials: "include",
        body: JSON.stringify({
          pageType: "FAVORITE",
          searchJson: shareBoardSelectedPost.searchJson,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success || !saveData.data) {
        setError(saveData.message ?? "게시글 보고서 복사에 실패했습니다.");
        return;
      }

      const savedFavoriteId = Number(saveData.data.favoriteId);
      const updatedItems = await fetchFavorites();
      const parsed = JSON.parse(String(saveData.data.searchJson ?? "{}")) as {
        title?: string;
        egogiftIds?: number[];
        cardPackIds?: number[];
        cardPackDifficulty?: string;
        cardPackCheckedByFloor?: Record<string, number>;
        plannedCardPackDifficultyByFloor?: Record<string, string>;
        plannedFloorRowCount?: number;
        checkedEgoGiftIds?: number[];
        startEgoGiftIds?: number[];
        observedEgoGiftIds?: number[];
        resultEgoGiftViewByKeyword?: boolean;
        resultEgoGiftViewMode?: string;
        reportPersonalitySlots?: unknown;
        reportEgoSlots?: unknown;
      };

      reportAutosaveSkipNextRef.current = true;
      setSelectedFavoriteId(savedFavoriteId);
      setActiveTab("result");
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
      setStartEgoGiftIds(parsePinnedEgoGiftIds(parsed.startEgoGiftIds, 3));
      setObservedEgoGiftIds(parsePinnedEgoGiftIds(parsed.observedEgoGiftIds, 3));
      setReportPersonalitySlots(parseReportPersonalitySlots(parsed.reportPersonalitySlots));
      setReportEgoSlots(parseReportEgoSlots(parsed.reportEgoSlots));
      setResultEgoGiftViewMode(parseResultEgoGiftViewMode(parsed));
      applyResultTabUiPrefsFromRecord(parsed);
      setShareToastMessage("게시글을 보고서로 복사했습니다.");
    } catch {
      setError("게시글 보고서 복사에 실패했습니다.");
    } finally {
      setImporting(false);
    }
  };

  const startShareBoardEdit = () => {
    if (!shareBoardSelectedPost) return;
    setShareBoardEditing(true);
    setShareBoardEditTitle(shareBoardSelectedPost.title);
    setShareBoardEditDescription(shareBoardSelectedPost.description ?? "");
  };

  const handleShareBoardUpdate = async () => {
    if (!shareBoardSelectedPost) return;
    const title = shareBoardEditTitle.trim();
    if (!title) {
      setError("제목을 입력해주세요.");
      return;
    }
    setShareBoardUpdating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${shareBoardSelectedPost.postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description: shareBoardEditDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "게시글 수정에 실패했습니다.");
        return;
      }
      setShareBoardEditing(false);
      await handleShareBoardOpenPost(shareBoardSelectedPost.postId);
      setShareToastMessage("게시글을 수정했습니다.");
    } catch {
      setError("게시글 수정에 실패했습니다.");
    } finally {
      setShareBoardUpdating(false);
    }
  };

  const handleShareBoardDelete = async () => {
    if (!shareBoardSelectedPost) return;
    if (!confirm("이 게시글을 삭제할까요?")) return;
    setShareBoardDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/favorite-search/share-board/posts/${shareBoardSelectedPost.postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "게시글 삭제에 실패했습니다.");
        return;
      }
      setShareBoardSelectedPost(null);
      setShareBoardEditing(false);
      await fetchShareBoardPosts();
      pushFavoritesRoute({ tab: "share-board", shareBoardMode: "list", postId: null, favoriteId: null });
      setShareToastMessage("게시글을 삭제했습니다.");
    } catch {
      setError("게시글 삭제에 실패했습니다.");
    } finally {
      setShareBoardDeleting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "share-board") {
      fetchShareBoardPosts();
    }
  }, [activeTab, fetchShareBoardPosts]);

  useEffect(() => {
    setShareBoardPage(1);
  }, [shareBoardSort, shareBoardSearchType, shareBoardSearchText, shareBoardPopularOnly]);

  const prevActiveTabRef = useRef<FavoritesTab | null>(null);
  useEffect(() => {
    const prev = prevActiveTabRef.current;
    if (activeTab === "share-board" && prev != null && prev !== "share-board") {
      setShareBoardSelectedPost(null);
      setShareBoardEditing(false);
      setShareBoardComments([]);
      setShareBoardReplyParentId(null);
      setShareBoardReplyInput("");
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "share-board") return;
    if (shareBoardMode === "new") {
      if (shareBoardFavoriteIdParam > 0) {
        setShareBoardFavoriteId(shareBoardFavoriteIdParam);
      }
      setShareBoardSelectedPost(null);
      setShareBoardComments([]);
    } else if (shareBoardMode === "list") {
      setShareBoardSelectedPost(null);
      setShareBoardEditing(false);
      setShareBoardComments([]);
    }
  }, [activeTab, shareBoardMode, shareBoardFavoriteIdParam]);

  useEffect(() => {
    if (activeTab !== "share-board" || shareBoardMode !== "new") return;
    if (!shareBoardAuthChecked || shareBoardAuthenticated) return;
    setError("로그인이 필요합니다.");
    pushFavoritesRoute({ tab: "share-board", shareBoardMode: "list", postId: null, favoriteId: null });
  }, [activeTab, shareBoardMode, shareBoardAuthChecked, shareBoardAuthenticated, pushFavoritesRoute]);

  useEffect(() => {
    if (activeTab !== "share-board") return;
    if (shareBoardMode !== "detail") return;
    if (!Number.isFinite(shareBoardPostIdParam) || shareBoardPostIdParam <= 0) return;
    if (shareBoardSelectedPost?.postId === shareBoardPostIdParam) return;
    void handleShareBoardOpenPost(shareBoardPostIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, shareBoardMode, shareBoardPostIdParam]);

  useEffect(() => {
    if (activeTab !== "share-board" || shareBoardMode !== "detail" || !shareBoardSelectedPost?.searchJson) {
      setShareBoardPreviewCardPacks([]);
      setShareBoardPreviewEgoGifts([]);
      setShareBoardPreviewSynthesisRecipes([]);
      setShareBoardPreviewCheckedCardPackByFloor({});
      setShareBoardPreviewPlannedCardPackDifficultyByFloor({});
      setShareBoardPreviewStartEgoGiftIds([]);
      setShareBoardPreviewObservedEgoGiftIds([]);
      setShareBoardPreviewReportPersonalitySlots(emptyReportPersonalitySlots());
      setShareBoardPreviewReportEgoSlots(emptyReportEgoSlots());
      setShareBoardPreviewFlippedSlots({});
      setShareBoardPreviewIdentityTab("personality");
      setShareBoardPreviewSchemaVersion(1);
      setShareBoardPreviewEgoGiftViewMode("keyword");
      setShareBoardPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setShareBoardPreviewLoading(true);
    try {
      const parsed = JSON.parse(shareBoardSelectedPost.searchJson) as {
        cardPackIds?: number[];
        egogiftIds?: number[];
        cardPackCheckedByFloor?: Record<string, number>;
        plannedCardPackDifficultyByFloor?: Record<string, string>;
        startEgoGiftIds?: number[];
        observedEgoGiftIds?: number[];
        resultEgoGiftViewMode?: ResultEgoGiftViewMode;
        resultEgoGiftViewByKeyword?: boolean;
        reportPersonalitySlots?: unknown;
        reportEgoSlots?: unknown;
      };
      setShareBoardPreviewSchemaVersion(Number(shareBoardSelectedPost.schemaVersion ?? 1));
      const cardPackIds = Array.isArray(parsed.cardPackIds) ? parsed.cardPackIds.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
      const egogiftIds = Array.isArray(parsed.egogiftIds) ? parsed.egogiftIds.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
      const startIds = parsePinnedEgoGiftIds(parsed.startEgoGiftIds, 3);
      const observedIds = Array.isArray(parsed.observedEgoGiftIds)
        ? parsed.observedEgoGiftIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 3)
        : [];
      const allEgoGiftIds = [...new Set([...egogiftIds, ...startIds, ...observedIds])];
      const byFloor = parsed.cardPackCheckedByFloor && typeof parsed.cardPackCheckedByFloor === "object"
        ? Object.fromEntries(
            Object.entries(parsed.cardPackCheckedByFloor)
              .map(([k, v]) => [Number(k), Number(v)] as const)
              .filter(([k, v]) => Number.isFinite(k) && k > 0 && Number.isFinite(v) && v > 0)
          )
        : {};
      setShareBoardPreviewCheckedCardPackByFloor(byFloor as Record<number, number>);
      setShareBoardPreviewPlannedCardPackDifficultyByFloor(
        parsePlannedCardPackDifficultyByFloor(parsed.plannedCardPackDifficultyByFloor)
      );
      setShareBoardPreviewStartEgoGiftIds(startIds);
      setShareBoardPreviewObservedEgoGiftIds(
        observedIds
      );
      setShareBoardPreviewReportPersonalitySlots(parseReportPersonalitySlots(parsed.reportPersonalitySlots));
      setShareBoardPreviewReportEgoSlots(parseReportEgoSlots(parsed.reportEgoSlots));
      setShareBoardPreviewFlippedSlots({});
      setShareBoardPreviewIdentityTab("personality");
      setShareBoardPreviewEgoGiftViewMode(parseResultEgoGiftViewMode(parsed));

      const cardPackTask = (async () => {
        if (cardPackIds.length === 0) return [] as Array<{ cardpackId: number; title: string; thumbnail?: string; floors?: number[]; difficulties?: string[] }>;
        const query = cardPackIds.map((id) => `ids=${id}`).join("&");
        const res = await fetch(`${API_BASE_URL}/user/cardpack/by-ids?${query}`, { credentials: "include" });
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        return items.map((item: any) => ({
          cardpackId: Number(item.cardpackId),
          title: String(item.title ?? ""),
          thumbnail: item.thumbnail ?? undefined,
          floors: Array.isArray(item.floors) ? item.floors.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n)) : [],
          difficulties: Array.isArray(item.difficulties) ? item.difficulties.map((x: unknown) => String(x)) : [],
        })).filter((item: { cardpackId: number }) => item.cardpackId > 0);
      })();

      const egoGiftTask = (async () => {
        if (allEgoGiftIds.length === 0) return [] as Array<{ egogiftId: number; giftName: string; thumbnail?: string; giftTier?: string; keywordName?: string; grades?: string[]; synthesisYn?: string; limitedCategoryNames?: string[] }>;
        const res = await fetch(`${API_BASE_URL}/user/egogift?page=0&size=10000`, { credentials: "include" });
        if (!res.ok) return [];
        const data = await res.json();
        const allItems = Array.isArray(data.items) ? data.items : [];
        const idSet = new Set(allEgoGiftIds);
        return allItems
          .filter((item: any) => idSet.has(Number(item.egogiftId)))
          .map((item: any) => ({
            egogiftId: Number(item.egogiftId),
            giftName: String(item.giftName ?? ""),
            thumbnail: item.thumbnail ?? item.thumbnail_path ?? undefined,
            giftTier: item.giftTier ?? item.gift_tier ?? undefined,
            keywordName: item.keywordName ? String(item.keywordName).trim() || "기타" : "기타",
            grades: Array.isArray(item.grades) ? item.grades.map((x: unknown) => String(x).trim().toUpperCase()).filter(Boolean) : [],
            synthesisYn: item.synthesisYn ?? item.synthesis_yn ?? undefined,
            limitedCategoryNames: Array.isArray(item.limitedCategoryNames)
              ? item.limitedCategoryNames.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
              : [],
          }))
          .filter((item: { egogiftId: number }) => item.egogiftId > 0);
      })();

      Promise.all([cardPackTask, egoGiftTask])
        .then(async ([cardPacks, egoGifts]) => {
          if (cancelled) return;
          setShareBoardPreviewCardPacks(cardPacks);
          setShareBoardPreviewEgoGifts(egoGifts);
          const synthesisIds = [
            ...new Set(
              egoGifts
                .map((eg: { egogiftId: number }) => eg.egogiftId)
                .filter((id: number) => Number.isFinite(id) && id > 0)
            ),
          ];
          if (synthesisIds.length === 0) {
            setShareBoardPreviewSynthesisRecipes([]);
            return;
          }
          const q = synthesisIds.map((id) => `egogiftIds=${id}`).join("&");
          try {
            const synRes = await fetch(`${API_BASE_URL}/user/egogift/synthesis-recipes?${q}`, { credentials: "include" });
            const synData = synRes.ok ? await synRes.json() : [];
            if (cancelled) return;
            const list = Array.isArray(synData)
              ? synData.map((r: any) => ({
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
            setShareBoardPreviewSynthesisRecipes(list);
          } catch {
            if (!cancelled) setShareBoardPreviewSynthesisRecipes([]);
          }
        })
        .finally(() => {
          if (!cancelled) setShareBoardPreviewLoading(false);
        });
    } catch {
      setShareBoardPreviewCardPacks([]);
      setShareBoardPreviewEgoGifts([]);
      setShareBoardPreviewSynthesisRecipes([]);
      setShareBoardPreviewReportPersonalitySlots(emptyReportPersonalitySlots());
      setShareBoardPreviewReportEgoSlots(emptyReportEgoSlots());
      setShareBoardPreviewFlippedSlots({});
      setShareBoardPreviewIdentityTab("personality");
      setShareBoardPreviewLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    shareBoardMode,
    shareBoardSelectedPost?.postId,
    shareBoardSelectedPost?.searchJson,
    shareBoardSelectedPost?.schemaVersion,
  ]);

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
        startEgoGiftIds?: number[];
          observedEgoGiftIds?: number[];
          resultEgoGiftViewByKeyword?: boolean;
          resultEgoGiftViewMode?: string;
          reportPersonalitySlots?: unknown;
          reportEgoSlots?: unknown;
        };
        reportAutosaveSkipNextRef.current = true;
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
        setStartEgoGiftIds(parsePinnedEgoGiftIds(parsed.startEgoGiftIds, 3));
        setObservedEgoGiftIds(parsePinnedEgoGiftIds(parsed.observedEgoGiftIds, 3));
        setReportPersonalitySlots(parseReportPersonalitySlots(parsed.reportPersonalitySlots));
        setReportEgoSlots(parseReportEgoSlots(parsed.reportEgoSlots));
        setResultEgoGiftViewMode(parseResultEgoGiftViewMode(parsed));
        applyResultTabUiPrefsFromRecord(parsed);
      } else {
        setSaveFailureToastMessage(data.message ?? "불러오기에 실패했습니다.");
      }
    } catch {
      setSaveFailureToastMessage("불러오기에 실패했습니다.");
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
          setResultEgoGiftViewMode("keyword");
          setStartEgoGiftIds([]);
          setObservedEgoGiftIds([]);
          setReportPersonalitySlots(emptyReportPersonalitySlots());
          setReportEgoSlots(emptyReportEgoSlots());
          resetResultTabUiPrefsToDefaults();
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

  const favoriteActionsTarget = useMemo(
    () => (favoriteActionsMenuId == null ? null : items.find((item) => item.favoriteId === favoriteActionsMenuId) ?? null),
    [favoriteActionsMenuId, items]
  );

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
            onClick={() => {
              void handleSave();
            }}
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
            <div
              className={
                items.length >= 5
                  ? "max-h-[15.75rem] overflow-y-auto overflow-x-hidden pr-0.5 rounded-md [scrollbar-width:thin] [scrollbar-color:#b8860b_#1a1a1a] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-[#1a1a1a] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#b8860b]/55 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-[#131316]/80 [&::-webkit-scrollbar-thumb:hover]:bg-[#d4af37]/70"
                  : undefined
              }
            >
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
                      reportAutosaveSkipNextRef.current = true;
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
                          startEgoGiftIds?: number[];
                          observedEgoGiftIds?: number[];
                          resultEgoGiftViewByKeyword?: boolean;
                          resultEgoGiftViewMode?: string;
                          reportPersonalitySlots?: unknown;
                          reportEgoSlots?: unknown;
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
                        setStartEgoGiftIds(parsePinnedEgoGiftIds(parsed.startEgoGiftIds, 3));
                        setObservedEgoGiftIds(parsePinnedEgoGiftIds(parsed.observedEgoGiftIds, 3));
                        setReportPersonalitySlots(parseReportPersonalitySlots(parsed.reportPersonalitySlots));
                        setReportEgoSlots(parseReportEgoSlots(parsed.reportEgoSlots));
                        setResultEgoGiftViewMode(parseResultEgoGiftViewMode(parsed));
                        applyResultTabUiPrefsFromRecord(parsed);
                      } catch {
                        setTitleInput("");
                        setStarredEgoGiftIds([]);
                        setStarredCardPackIds([]);
                        setResultCardPackDifficulty("노말");
                        setCheckedCardPackByFloor({});
                        setPlannedCardPackDifficultyByFloor({});
                        setV2PlannedFloorRowCount(1);
                        setCheckedEgoGiftIds([]);
                        setStartEgoGiftIds([]);
                        setObservedEgoGiftIds([]);
                        setReportPersonalitySlots(emptyReportPersonalitySlots());
                        setReportEgoSlots(emptyReportEgoSlots());
                        setResultEgoGiftViewMode("keyword");
                        resetResultTabUiPrefsToDefaults();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (deletingId === item.favoriteId || editingFavoriteId === item.favoriteId) return;
                        reportAutosaveSkipNextRef.current = true;
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
                            startEgoGiftIds?: number[];
                            observedEgoGiftIds?: number[];
                            resultEgoGiftViewByKeyword?: boolean;
                            resultEgoGiftViewMode?: string;
                            reportPersonalitySlots?: unknown;
                            reportEgoSlots?: unknown;
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
                          setStartEgoGiftIds(parsePinnedEgoGiftIds(parsed.startEgoGiftIds, 3));
                          setObservedEgoGiftIds(parsePinnedEgoGiftIds(parsed.observedEgoGiftIds, 3));
                          setReportPersonalitySlots(parseReportPersonalitySlots(parsed.reportPersonalitySlots));
                          setReportEgoSlots(parseReportEgoSlots(parsed.reportEgoSlots));
                          setResultEgoGiftViewMode(parseResultEgoGiftViewMode(parsed));
                          applyResultTabUiPrefsFromRecord(parsed);
                        } catch {
                          setTitleInput("");
                          setStarredEgoGiftIds([]);
                          setStarredCardPackIds([]);
                          setResultCardPackDifficulty("노말");
                          setCheckedCardPackByFloor({});
                          setPlannedCardPackDifficultyByFloor({});
                          setV2PlannedFloorRowCount(1);
                          setCheckedEgoGiftIds([]);
                          setStartEgoGiftIds([]);
                          setObservedEgoGiftIds([]);
                          setReportPersonalitySlots(emptyReportPersonalitySlots());
                          setReportEgoSlots(emptyReportEgoSlots());
                          setResultEgoGiftViewMode("keyword");
                          resetResultTabUiPrefsToDefaults();
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
                        <div className="relative shrink-0" data-favorite-actions-menu-root>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const nextId = favoriteActionsMenuId === item.favoriteId ? null : item.favoriteId;
                              setFavoriteActionsMenuId(nextId);
                              if (nextId != null) {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setFavoriteActionsMenuPosition({ top: rect.bottom + 4, left: rect.left });
                              } else {
                                setFavoriteActionsMenuPosition(null);
                              }
                            }}
                            className="p-1 rounded text-gray-300 hover:bg-white/10 hover:text-yellow-200 transition-colors"
                            title="보고서 작업 메뉴"
                            aria-label="보고서 작업 메뉴"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path d="M10 3a1.75 1.75 0 110 3.5A1.75 1.75 0 0110 3zM10 8.25a1.75 1.75 0 110 3.5 1.75 1.75 0 010-3.5zM11.75 15a1.75 1.75 0 11-3.5 0 1.75 1.75 0 013.5 0z" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            </div>
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
      <style dangerouslySetInnerHTML={{ __html: ".keyword-capture-hex .exclude-from-capture { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; } .keyword-capture-hex [data-cardpack-title] { min-height: 3.5rem !important; padding-bottom: 0.375rem !important; } .keyword-capture-hex [data-cardpack-title] p:first-of-type { line-height: 1.5 !important; min-height: 3em !important; overflow: visible !important; } .keyword-capture-hex [data-floor-empty-notice] { overflow: visible !important; white-space: normal !important; text-overflow: clip !important; line-height: 1.625 !important; padding-bottom: 0.25rem !important; min-height: 2.75rem !important; }" }} />
      {/* 저장 실패 토스트 */}
      {saveFailureToastMessage && (
        <div className="fixed left-0 right-0 top-0 z-[9999] flex justify-center pt-4 px-4 pointer-events-none">
          <div className="rounded-lg bg-red-900/95 px-6 py-3 text-white font-medium shadow-lg backdrop-blur-sm border border-red-400/50 max-w-[min(36rem,calc(100vw-2rem))] text-center">
            {saveFailureToastMessage}
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

      {favoriteActionsTarget && favoriteActionsMenuPosition && typeof window !== "undefined" && createPortal(
        <div
          data-favorite-actions-menu-root
          className="fixed z-[1200] inline-flex w-fit flex-col rounded-md border border-[#b8860b]/40 bg-[#1a1a1d] shadow-lg py-1"
          style={{
            top: Math.max(8, Math.round(favoriteActionsMenuPosition.top)),
            left: Math.max(8, Math.round(favoriteActionsMenuPosition.left)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              startEditTitle(e, favoriteActionsTarget);
              setFavoriteActionsMenuId(null);
              setFavoriteActionsMenuPosition(null);
            }}
            disabled={editingId !== null}
            className="whitespace-nowrap text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            제목 수정
          </button>
          <button
            type="button"
            onClick={(e) => {
              handleShare(e, favoriteActionsTarget.favoriteId);
              setFavoriteActionsMenuId(null);
              setFavoriteActionsMenuPosition(null);
            }}
            disabled={sharingId !== null}
            className="whitespace-nowrap text-left px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-400/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            공유
          </button>
          {shareBoardAuthenticated ? (
            <button
              type="button"
              onClick={(e) => {
                moveToShareBoardWithFavorite(e, favoriteActionsTarget.favoriteId);
                setFavoriteActionsMenuId(null);
                setFavoriteActionsMenuPosition(null);
              }}
              className="whitespace-nowrap text-left px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/15"
            >
              공유게시판 등록
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              handleDelete(e, favoriteActionsTarget.favoriteId);
              setFavoriteActionsMenuId(null);
              setFavoriteActionsMenuPosition(null);
            }}
            disabled={deletingId !== null}
            className="whitespace-nowrap text-left px-3 py-1.5 text-sm text-red-300 hover:bg-red-400/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            삭제
          </button>
        </div>,
        document.body
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
        <div ref={mainContentContainerRef} className="container mx-auto px-4 py-8">
          {/* 상단 탭 (스크롤 시 상단 고정) */}
          <div className="sticky top-16 z-[110] flex items-center gap-2 mb-6 flex-wrap py-2 -mx-4 px-4 bg-[#0d0d0f]/95 backdrop-blur-sm border-b border-[#b8860b]/20">
            <div className="flex gap-2">
              {TAB_LIST.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    if (key === "share-board") {
                      pushFavoritesRoute({ tab: "share-board", shareBoardMode: "list", postId: null, favoriteId: null });
                    } else {
                      pushFavoritesRoute({ tab: key, shareBoardMode: null, postId: null, favoriteId: null });
                    }
                  }}
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

          {activeTab === "share-board" ? (
            <div className="w-full">
              <div className="w-full">
                {activeTab === "share-board" && (
                  <div className="space-y-4">
                    <div
                      ref={(el) => {
                        if (shareBoardMode === "list") shareBoardListSectionRef.current = el;
                        if (shareBoardMode === "new") shareBoardNewSectionRef.current = el;
                      }}
                      className={shareBoardMode === "detail" ? "space-y-4" : "bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6"}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-yellow-300">
                          {shareBoardMode === "new" ? "공유게시판 등록" : shareBoardMode === "detail" ? "게시글 상세" : "공유게시판 목록"}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => pushFavoritesRoute({ tab: "share-board", shareBoardMode: "list", postId: null, favoriteId: null })}
                            className="px-3 py-1.5 text-sm rounded border border-[#b8860b]/40 text-gray-200 hover:bg-[#2a2a2d]"
                          >
                            목록
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!ensureShareBoardRegisterAccess()) return;
                              pushFavoritesRoute({
                                tab: "share-board",
                                shareBoardMode: "new",
                                postId: null,
                                favoriteId: shareBoardFavoriteId ? String(shareBoardFavoriteId) : null,
                              });
                            }}
                            className="px-3 py-1.5 text-sm rounded border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                          >
                            등록
                          </button>
                        </div>
                      </div>

                      {shareBoardMode === "new" && (
                        <div className="grid gap-3">
                          <div>
                            <label className="block text-sm text-gray-300 mb-1">기존 보고서 선택</label>
                            <select
                              value={shareBoardFavoriteId}
                              onChange={(e) => setShareBoardFavoriteId(e.target.value ? Number(e.target.value) : "")}
                              className="w-full px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            >
                              <option value="">보고서를 선택하세요</option>
                              {items.map((item) => {
                                let reportTitle = `보고서 ${item.favoriteId}`;
                                try {
                                  const parsed = JSON.parse(item.searchJson) as { title?: string };
                                  reportTitle = (parsed.title ?? "").trim() || reportTitle;
                                } catch {
                                  // noop
                                }
                                return (
                                  <option key={item.favoriteId} value={item.favoriteId}>
                                    {reportTitle}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-1">게시글 제목</label>
                            <input
                              type="text"
                              value={shareBoardTitleInput}
                              onChange={(e) => setShareBoardTitleInput(e.target.value)}
                              placeholder="게시글 제목 입력"
                              className="w-full px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-1">설명</label>
                            <textarea
                              value={shareBoardDescriptionInput}
                              onChange={(e) => setShareBoardDescriptionInput(e.target.value)}
                              placeholder="설명 입력"
                              rows={3}
                              className="w-full px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleShareBoardRegister}
                              disabled={shareBoardRegistering}
                              className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {shareBoardRegistering ? "등록 중..." : "등록 완료"}
                            </button>
                          </div>
                        </div>
                      )}

                      {shareBoardMode === "detail" && (
                        <>
                          {!shareBoardSelectedPost ? (
                            <p className="text-sm text-gray-400">게시글을 불러오는 중...</p>
                          ) : (
                            <div className="space-y-3">
                              {shareBoardEditing ? (
                                <>
                                  <input type="text" value={shareBoardEditTitle} onChange={(e) => setShareBoardEditTitle(e.target.value)} className="w-full px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white" />
                                  <textarea value={shareBoardEditDescription} onChange={(e) => setShareBoardEditDescription(e.target.value)} rows={4} className="w-full px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white" />
                                  <div className="flex items-center gap-2 justify-end">
                                    <button type="button" onClick={() => setShareBoardEditing(false)} className="px-3 py-2 rounded border border-gray-500/50 text-gray-300 hover:bg-white/5">취소</button>
                                    <button type="button" onClick={handleShareBoardUpdate} disabled={shareBoardUpdating} className="px-3 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50">
                                      {shareBoardUpdating ? "저장 중..." : "수정 저장"}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div ref={shareBoardDetailPostInfoSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-5 space-y-3">
                                    <div className="text-xl font-semibold text-yellow-200">{shareBoardSelectedPost.title}</div>
                                    <div className="text-sm text-gray-400">
                                      작성자: {shareBoardSelectedPost.authorNickname || "사용자"} · 추천 {shareBoardSelectedPost.recommendCount ?? 0} · 댓글 {shareBoardSelectedPost.commentCount ?? 0} · 조회 {shareBoardSelectedPost.viewCount} · {shareBoardSelectedPost.createdAt ? new Date(shareBoardSelectedPost.createdAt).toLocaleString() : "-"}
                                    </div>
                                    <div className="text-sm text-gray-200 whitespace-pre-wrap min-h-[60px] bg-[#1a1a1d] border border-[#b8860b]/20 rounded p-3">
                                      {shareBoardSelectedPost.description || "설명 없음"}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <button type="button" onClick={handleShareBoardCopyToReport} disabled={importing} className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold hover:bg-cyan-300 disabled:opacity-50">
                                        {importing ? "복사 중..." : "보고서로 복사"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleShareBoardToggleRecommend}
                                        className={`px-3 py-2 rounded border font-semibold transition-colors ${shareBoardSelectedPost.recommendedByMe ? "border-emerald-400/60 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20" : "border-[#b8860b]/40 text-yellow-300 hover:bg-yellow-500/10"}`}
                                      >
                                        {shareBoardSelectedPost.recommendedByMe ? "추천 취소" : "추천"} ({shareBoardSelectedPost.recommendCount ?? 0})
                                      </button>
                                      {shareBoardSelectedPost.isMine && (
                                        <div className="ml-auto flex items-center gap-2">
                                          <button type="button" onClick={startShareBoardEdit} className="px-3 py-2 rounded border border-[#b8860b]/40 text-yellow-300 hover:bg-yellow-500/10">수정</button>
                                          <button type="button" onClick={handleShareBoardDelete} disabled={shareBoardDeleting} className="px-3 py-2 rounded border border-red-500/50 text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                                            {shareBoardDeleting ? "삭제 중..." : "삭제"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    {shareBoardPreviewLoading ? (
                                      <p className="text-sm text-gray-400">보고서 내용을 불러오는 중...</p>
                                    ) : (
                                      <div className="space-y-4">
                                        <div ref={shareBoardDetailPreviewSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-5">
                                          <div className="border-b border-[#b8860b]/30 pb-2 mb-3 flex items-center justify-between gap-2">
                                            <h4 className="text-lg font-semibold text-yellow-300">인격/에고 편성 현황</h4>
                                            <div className="inline-flex rounded-md border border-[#b8860b]/35 bg-[#1a1a1d] p-0.5">
                                              <button
                                                type="button"
                                                onClick={() => setShareBoardPreviewIdentityTab("personality")}
                                                className={`px-2.5 py-1 text-xs rounded ${
                                                  shareBoardPreviewIdentityTab === "personality"
                                                    ? "bg-amber-500/25 text-amber-100"
                                                    : "text-gray-400 hover:bg-white/5"
                                                }`}
                                              >
                                                인격
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setShareBoardPreviewIdentityTab("ego")}
                                                className={`px-2.5 py-1 text-xs rounded ${
                                                  shareBoardPreviewIdentityTab === "ego"
                                                    ? "bg-amber-500/25 text-amber-100"
                                                    : "text-gray-400 hover:bg-white/5"
                                                }`}
                                              >
                                                E.G.O
                                              </button>
                                            </div>
                                          </div>
                                          <div className="space-y-3">
                                            {shareBoardPreviewIdentityTab === "personality" ? (
                                            <>
                                            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                              <div className="rounded border border-emerald-500/30 bg-emerald-900/10 px-2 py-2">
                                                <div className="mb-1 text-[11px] text-emerald-200/90">편성 인격 키워드</div>
                                                {shareBoardPreviewFormationKeywordCounts.length === 0 ? (
                                                  <p className="text-[11px] text-gray-500">아직 편성된 인격이 없습니다.</p>
                                                ) : (
                                                  <div className="flex flex-wrap items-center gap-1.5">
                                                    {shareBoardPreviewFormationKeywordCounts.map((row) => (
                                                      <div
                                                        key={`share-preview-formation-kw-${row.keyword}`}
                                                        className="inline-flex items-center gap-1 rounded border border-emerald-400/25 bg-[#151b18] px-1.5 py-1"
                                                      >
                                                        <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                                        <span className="text-[11px] text-emerald-100">{row.count}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                <div className="mt-2 border-t border-emerald-500/25 pt-2">
                                                  <div className="mb-1 text-[11px] text-emerald-200/90">속성별 최대 획득 가능 자원 ( 1 라운드 기준 / 집중 전투 )</div>
                                                  {shareBoardPreviewFormationRound1AcquirableResources.length === 0 ? (
                                                    <p className="text-[11px] text-gray-500">편성 인격이 없거나 조건에 맞는 스킬이 없습니다.</p>
                                                  ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                      {shareBoardPreviewFormationRound1AcquirableResources.map((row) => (
                                                        <div
                                                          key={`share-preview-round1-res-${row.name}`}
                                                          className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-[#151b18] px-1.5 py-1"
                                                        >
                                                          <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                                          <span className="text-[11px] text-emerald-100 tabular-nums">{row.count}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="rounded border border-[#b8860b]/25 bg-[#0f0f12] px-2 py-2">
                                                <div className="mb-1 text-[11px] text-gray-400">전체 인격 키워드</div>
                                                {shareBoardPreviewPersonalityKeywordCounts.length === 0 ? (
                                                  <p className="text-[11px] text-gray-500">아직 집계할 키워드가 없습니다.</p>
                                                ) : (
                                                  <div className="flex flex-wrap items-center gap-1.5">
                                                    {shareBoardPreviewPersonalityKeywordCounts.map((row) => (
                                                      <div
                                                        key={`share-preview-kw-${row.keyword}`}
                                                        className="inline-flex items-center gap-1 rounded border border-[#b8860b]/20 bg-[#151518] px-1.5 py-1"
                                                      >
                                                        <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                                        <span className="text-[11px] text-gray-200">{row.count}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-xs font-semibold text-emerald-200/90 mb-2">인격 선택</div>
                                              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
                                                {REPORT_PERSONALITY_OPTIONS.map((p, slotIndex) => {
                                                  const slot = shareBoardPreviewReportPersonalitySlots[slotIndex] ?? null;
                                                  const egoPicked = shareBoardPreviewReportEgoSlots[slotIndex]?.selectedByGrade ?? {};
                                                  const flipped = Boolean(shareBoardPreviewFlippedSlots[slotIndex]);
                                                  const filled = slot != null && slot.imagePath;
                                                  return (
                                                    <button
                                                      key={`share-preview-personality-${p.order}`}
                                                      type="button"
                                                      onClick={() =>
                                                        setShareBoardPreviewFlippedSlots((prev) => ({
                                                          ...prev,
                                                          [slotIndex]: !prev[slotIndex],
                                                        }))
                                                      }
                                                      className={`flex min-w-0 w-full flex-col overflow-hidden rounded-lg border ${
                                                        filled
                                                          ? personalityGradeCardToneClass(slot?.grade)
                                                          : "border-[#b8860b]/40 bg-[#1a1a1d]"
                                                      }`}
                                                      style={{ perspective: "900px" }}
                                                    >
                                                      <div
                                                        className="relative w-full transition-transform duration-300"
                                                        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                                                      >
                                                        <div style={{ backfaceVisibility: "hidden" }}>
                                                          <div className="relative w-full aspect-[2/3] bg-[#111] shrink-0 overflow-hidden">
                                                            {filled ? (
                                                              <img
                                                                src={`${RESULT_EGOGIFT_BASE_URL}${slot!.imagePath}`}
                                                                alt=""
                                                                className="absolute inset-0 h-full w-full object-cover"
                                                              />
                                                            ) : (
                                                              <div
                                                                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45"
                                                                style={{ backgroundImage: `url(${p.image})`, backgroundPosition: "center 18%" }}
                                                                aria-hidden
                                                              />
                                                            )}
                                                            {filled && slot?.formationOrder ? (
                                                              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/15">
                                                                <span className={`text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                                                                  slot.formationOrder <= 7 ? "text-yellow-300" : "text-cyan-300"
                                                                }`}>
                                                                  {slot.formationOrder}
                                                                </span>
                                                              </div>
                                                            ) : null}
                                                            {filled ? (
                                                              <div className="pointer-events-none absolute bottom-0.5 right-0.5 z-[6] flex flex-wrap items-end justify-end gap-px rounded bg-black/35 p-px sm:bottom-1 sm:right-1 sm:gap-0.5 sm:p-0.5">
                                                                {getPersonalityKeywordIconPaths(slot?.keywords).map((src, ki) => (
                                                                  <img
                                                                    key={`share-preview-slot-kw-overlay-${p.order}-${ki}`}
                                                                    src={src}
                                                                    alt=""
                                                                    width={32}
                                                                    height={32}
                                                                    className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8"
                                                                  />
                                                                ))}
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                          <div className="flex flex-col items-center justify-center gap-0.5 border-t border-[#b8860b]/25 px-0.5 py-1.5 text-center leading-snug">
                                                            <span className="flex min-h-[2.5rem] sm:min-h-[2.75rem] w-full items-center justify-center">
                                                              <span className="line-clamp-2 w-full text-center text-[12px] sm:text-[14px] text-gray-200">
                                                                {filled ? slot!.name : p.name}
                                                              </span>
                                                            </span>
                                                            {filled ? (
                                                              <div className="mt-1 w-full border-t border-[#b8860b]/20 px-1 pt-1">
                                                                <div className="flex items-stretch gap-1">
                                                                  {([0, 1, 2] as const).map((idx) => {
                                                                    const rawValue = String(slot?.skillInputValues?.[idx] ?? "").trim();
                                                                    const fallback = idx === 0 ? "3" : idx === 1 ? "2" : "1";
                                                                    const value = rawValue || fallback;
                                                                    const attrColor = getSkillAttributeBorderColor(slot?.skillAttributes, idx);
                                                                    const iconPath = getSkillAttackTypeIconPath(slot?.skillAttackTypes, idx);
                                                                    return (
                                                                      <div
                                                                        key={`share-preview-skill-line-${p.order}-${idx}`}
                                                                        className="min-w-0 flex-1 rounded border px-1 py-0.5"
                                                                        style={{
                                                                          borderColor: attrColor,
                                                                          backgroundColor: colorWithAlpha(attrColor, 0.1),
                                                                        }}
                                                                      >
                                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                                          {iconPath ? (
                                                                            <img src={iconPath} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                                                                          ) : (
                                                                            <span className="h-7 w-7" aria-hidden />
                                                                          )}
                                                                          <span className="text-[18px] font-semibold leading-tight text-gray-200">
                                                                            {value}
                                                                          </span>
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  })}
                                                                </div>
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                        </div>
                                                        <div
                                                          className="absolute inset-0 flex flex-col bg-[#151922]"
                                                          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                                                        >
                                                          <div className="flex min-h-[2rem] items-center justify-center border-b border-[#b8860b]/30 px-2 py-1 text-[10px] font-semibold text-sky-200">
                                                            {p.name} 선택 E.G.O
                                                          </div>
                                                          <div className="flex-1 p-2">
                                                            <div className="space-y-1">
                                                              {REPORT_EGO_GRADE_ORDER.map((grade) => (
                                                                <div key={`share-preview-flip-${p.order}-${grade}`} className="flex items-center gap-1 text-[9px] sm:text-[10px]">
                                                                  <span className="w-9 shrink-0 text-amber-300/90 font-semibold">{grade}</span>
                                                                  <span className="min-w-0 truncate text-gray-200">{egoPicked[grade]?.title ?? "-"}</span>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                            </>
                                            ) : (
                                            <>
                                            <div>
                                              <div className="mb-2 rounded border border-sky-500/30 bg-sky-900/10 px-2 py-2">
                                                <div className="mb-1 text-[11px] text-sky-200/90">필요 자원</div>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  {shareBoardPreviewEgoResourceCounts.map((row) => (
                                                    <div
                                                      key={`share-preview-ego-resource-${row.name}`}
                                                      className="inline-flex items-center gap-1 rounded border border-sky-400/25 bg-[#151922] px-1.5 py-1"
                                                    >
                                                      <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                                      <span className="text-[11px] text-sky-100">{row.value}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                              <div className="text-xs font-semibold text-sky-200/90 mb-2">E.G.O 선택</div>
                                              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
                                                {REPORT_PERSONALITY_OPTIONS.map((p, slotIndex) => {
                                                  const picked = shareBoardPreviewReportEgoSlots[slotIndex]?.selectedByGrade ?? {};
                                                  const egoBackgroundImage = REPORT_PERSONALITY_ICON_BACKGROUND_BY_ORDER[p.order] ?? p.image;
                                                  return (
                                                    <div
                                                      key={`share-preview-ego-${p.order}`}
                                                      className="flex min-w-0 w-full flex-col overflow-hidden rounded-lg border border-[#b8860b]/40 bg-[#1a1a1d]"
                                                    >
                                                      <div className="relative flex h-[126px] sm:h-[158px] w-full items-center justify-center bg-[#111] shrink-0 overflow-hidden">
                                                        <img src={egoBackgroundImage} alt="" className="block h-auto w-auto max-h-full max-w-full object-contain object-center opacity-55" />
                                                      </div>
                                                      <div className="min-h-[5rem] border-t border-[#b8860b]/25 px-1.5 py-2">
                                                        <div className="text-[18px] sm:text-[20px] text-gray-100 font-semibold text-center line-clamp-1 mb-1.5">
                                                          {p.name}
                                                        </div>
                                                        <div className="space-y-1">
                                                          {REPORT_EGO_GRADE_ORDER.map((grade) => (
                                                            <div key={`share-preview-${p.order}-${grade}`} className="flex items-center gap-1.5 text-[16px] sm:text-[18px] leading-tight">
                                                              <span className="w-16 shrink-0 text-amber-300/90 font-semibold">{grade}</span>
                                                              <span className="min-w-0 truncate text-gray-200">{picked[grade]?.title ?? "-"}</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                            </>
                                            )}
                                          </div>
                                        </div>
                                        {shareBoardPreviewSchemaVersion === 2 && (
                                          <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 overflow-visible pb-6">
                                            <div className="border-b border-[#b8860b]/40 pb-3 mb-4">
                                              <h4 className="text-lg font-semibold text-yellow-300">진행(예정) 카드팩 목록</h4>
                                            </div>
                                            <div className="min-h-[120px] rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]/50 p-3 md:p-3 lg:p-4 overflow-visible">
                                              <div className="w-full space-y-3 sm:space-y-4">
                                                {V2_FLOOR_ROWS.map((rowFloors, rowIdx) => (
                                                  <div key={rowIdx} className="w-full grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-2 lg:gap-3">
                                                    {rowFloors.map((floor) => {
                                                      const packId = shareBoardPreviewCheckedCardPackByFloor[floor];
                                                      const pack = packId ? shareBoardPreviewCardPackById.get(packId) : undefined;
                                                      const slotDiff = shareBoardPreviewPlannedCardPackDifficultyByFloor[floor];
                                                      const slotBorderClass = v2SlotBorderClass(slotDiff);
                                                      return (
                                                        <div key={floor} className={`flex flex-col items-stretch rounded-lg border bg-[#131316]/80 min-h-[180px] sm:min-h-[200px] md:min-h-[220px] lg:min-h-[240px] ${slotBorderClass}`}>
                                                          <span className="text-center text-xs sm:text-sm md:text-base font-semibold text-yellow-200/90 py-1.5 md:py-2 border-b border-[#b8860b]/30 bg-[#131316] shrink-0 px-1 leading-tight">
                                                            {floor}층 {slotDiff ? `· ${v2DifficultySlotLabel(slotDiff)}` : ""}
                                                          </span>
                                                          <div className="relative flex-1 flex flex-col items-center justify-center p-1.5 min-h-[140px] sm:min-h-[160px] md:min-h-[170px]">
                                                            {pack ? (
                                                              <>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => cardPackDetailOpenRef.current?.open(pack.cardpackId)}
                                                                  className="aspect-[1/2] w-full max-w-[3.5rem] sm:max-w-[4.25rem] md:max-w-none mx-auto rounded overflow-hidden bg-[#1a1a1a] mb-1 shrink-0 cursor-pointer hover:ring-2 hover:ring-yellow-300/70 transition"
                                                                  title={`${pack.title} 상세 보기`}
                                                                  aria-label={`${pack.title} 상세 보기`}
                                                                >
                                                                  {pack.thumbnail ? (
                                                                    <img src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                  ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-0.5 text-center">없음</div>
                                                                  )}
                                                                </button>
                                                                <p className="text-[10px] sm:text-xs md:text-sm text-gray-200 line-clamp-2 text-center leading-snug w-full mt-0.5">{pack.title}</p>
                                                              </>
                                                            ) : (
                                                              <span className="text-gray-500 text-xs sm:text-sm text-center px-1 leading-snug">비어 있음</span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <ObservedEgoGiftsSection
                                          catalog={shareBoardPreviewObservableCatalog}
                                          catalogLoading={false}
                                          selectedIds={shareBoardPreviewStartEgoGiftIds}
                                          onChange={() => {}}
                                          imageBaseUrl={RESULT_EGOGIFT_BASE_URL}
                                          onOpenEgoGiftByName={(name) => egoGiftPreviewOpenRef.current?.(name)}
                                          sectionTitle="시작 에고기프트"
                                          readOnly
                                        />

                                        <ObservedEgoGiftsSection
                                          catalog={shareBoardPreviewObservableCatalog}
                                          catalogLoading={false}
                                          selectedIds={shareBoardPreviewObservedEgoGiftIds}
                                          onChange={() => {}}
                                          imageBaseUrl={RESULT_EGOGIFT_BASE_URL}
                                          onOpenEgoGiftByName={(name) => egoGiftPreviewOpenRef.current?.(name)}
                                          readOnly
                                        />

                                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6 overflow-visible">
                                          <div className="flex items-center justify-between gap-2 mb-4 border-b border-[#b8860b]/30 pb-3">
                                            <h4 className="text-lg font-semibold text-yellow-300">선택한 에고기프트</h4>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setShareBoardPreviewEgoGiftViewMode("floor")}
                                                className={`px-2 py-1 rounded text-xs border transition ${shareBoardPreviewEgoGiftViewMode === "floor" ? "bg-yellow-400 text-black border-yellow-400" : "bg-[#1a1a1d] text-gray-200 border-[#b8860b]/40 hover:bg-[#232327]"}`}
                                              >
                                                층별 보기
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setShareBoardPreviewEgoGiftViewMode("keyword")}
                                                className={`px-2 py-1 rounded text-xs border transition ${shareBoardPreviewEgoGiftViewMode !== "floor" ? "bg-yellow-400 text-black border-yellow-400" : "bg-[#1a1a1d] text-gray-200 border-[#b8860b]/40 hover:bg-[#232327]"}`}
                                              >
                                                키워드별 보기
                                              </button>
                                            </div>
                                          </div>
                                          {shareBoardPreviewEgoGifts.length === 0 ? (
                                            <p className="text-xs text-gray-500">선택된 에고기프트가 없습니다.</p>
                                          ) : (
                                            <div className="space-y-4">
                                              {shareBoardPreviewEgoGiftViewMode === "floor" ? (
                                                <div className="space-y-4">
                                                  {shareBoardPreviewFloorRowsForDisplay.length > 0 && (
                                                    <div className="space-y-4">
                                                      {shareBoardPreviewFloorRowsForDisplay.map((row) =>
                                                        row.limitedEgoGifts.length === 0 ? (
                                                          <div
                                                            key={`share-floor-${row.floor}-${row.cardpackId}`}
                                                            className="rounded-lg border border-[#b8860b]/40 bg-[#131316]/90 px-3 py-3 md:px-4 md:py-3.5"
                                                          >
                                                            <div className="mb-2 text-sm font-bold tabular-nums text-amber-300/95">{row.floor}층</div>
                                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">카드팩 및 에고기프트</div>
                                                            <p className="text-sm leading-relaxed text-gray-400 break-words [overflow-wrap:anywhere]">
                                                              <span className="text-gray-300">{row.title}</span>
                                                              <span className="text-gray-500"> — </span>
                                                              선택한 카드팩으로 획득할 한정 에고기프트가 없습니다.
                                                            </p>
                                                          </div>
                                                        ) : (
                                                          <div
                                                            key={`share-floor-${row.floor}-${row.cardpackId}`}
                                                            className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#b8860b]/40 bg-[#131316]/90 p-3 md:p-4"
                                                          >
                                                            <div className="mb-2 text-sm font-bold tabular-nums text-amber-300/95">{row.floor}층</div>
                                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">카드팩 및 에고기프트</div>
                                                            <div className="flex min-h-[11rem] flex-col items-stretch gap-4 sm:flex-row">
                                                              <div className="mx-auto flex w-full max-w-[10rem] shrink-0 flex-col self-stretch sm:mx-0 sm:w-[9.5rem] sm:max-w-none">
                                                                <button
                                                                  type="button"
                                                                  onClick={() => cardPackDetailOpenRef.current?.open(row.cardpackId)}
                                                                  className="flex h-full min-h-0 flex-1 flex-col gap-2 rounded-lg border border-[#b8860b]/35 bg-[#1a1a1d]/90 p-2 text-left"
                                                                  title="카드팩 상세"
                                                                >
                                                                  <div className="relative min-h-[9rem] w-full flex-1 basis-0 overflow-hidden rounded bg-[#0d0d10]">
                                                                    {row.thumbnail ? (
                                                                      <img
                                                                        src={RESULT_EGOGIFT_BASE_URL + row.thumbnail}
                                                                        alt={row.title}
                                                                        className="absolute inset-0 h-full w-full object-cover"
                                                                        onError={(e) => {
                                                                          (e.target as HTMLImageElement).style.display = "none";
                                                                        }}
                                                                      />
                                                                    ) : (
                                                                      <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] text-gray-600">
                                                                        이미지 없음
                                                                      </span>
                                                                    )}
                                                                  </div>
                                                                  <p className="w-full shrink-0 break-words text-center text-xs font-medium leading-snug text-gray-200 sm:text-left">
                                                                    {row.title}
                                                                  </p>
                                                                </button>
                                                              </div>
                                                              <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch">
                                                                <ResultKeywordSection
                                                                  keyword={`__share_floor_lim_${row.floor}__`}
                                                                  variant="flat"
                                                                  omitSynthesis
                                                                  fillParentHeight
                                                                  egogifts={row.limitedEgoGifts}
                                                                  keywordIndex={0}
                                                                  resultSimplified={false}
                                                                  keywordGiftExpandedByKeyword={shareBoardPreviewKeywordGiftExpandedByKeyword}
                                                                  setKeywordGiftExpandedByKeyword={setShareBoardPreviewKeywordGiftExpandedByKeyword}
                                                                  synthesisExpandedByKeyword={shareBoardPreviewSynthesisExpandedByKeyword}
                                                                  setSynthesisExpandedByKeyword={setShareBoardPreviewSynthesisExpandedByKeyword}
                                                                  synthesisRecipes={shareBoardPreviewSynthesisRecipes}
                                                                  resultEgoGifts={shareBoardPreviewEgoGifts}
                                                                  checkedEgoGiftIds={[]}
                                                                  onToggleEgoGiftCheck={() => {}}
                                                                  onRemoveStarredEgoGift={() => {}}
                                                                  sectionRef={() => {}}
                                                                  synthesisRef={() => {}}
                                                                  onCaptureSection={() => {}}
                                                                  egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                                  readOnly
                                                                />
                                                              </div>
                                                            </div>
                                                            {filterSynthesisRecipesForEgoIds(
                                                              shareBoardPreviewSynthesisRecipes,
                                                              row.limitedEgoGifts.map((e) => e.egogiftId),
                                                            ).length > 0 ? (
                                                              <div className="mt-4 min-w-0 max-w-full border-t border-[#b8860b]/30 pt-3">
                                                                <div className="mb-2 text-xs font-semibold text-purple-300/95">조합식</div>
                                                                <SynthesisRecipesSubsetBlock
                                                                  sectionKey={`__share_floor_lim_syn_${row.floor}__`}
                                                                  relevantEgoIds={row.limitedEgoGifts.map((e) => e.egogiftId)}
                                                                  synthesisRecipes={shareBoardPreviewSynthesisRecipes}
                                                                  resultEgoGifts={shareBoardPreviewEgoGifts}
                                                                  resultSimplified={false}
                                                                  synthesisExpandedByKeyword={shareBoardPreviewSynthesisExpandedByKeyword}
                                                                  setSynthesisExpandedByKeyword={setShareBoardPreviewSynthesisExpandedByKeyword}
                                                                  onCaptureSection={() => {}}
                                                                  synthesisRef={() => {}}
                                                                  egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                                  showHeaderRow={false}
                                                                  layout="floor"
                                                                />
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                  <ResultKeywordSection
                                                    key="share-board-preview-flat"
                                                    keyword={RESULT_EGO_FLAT_SECTION_KEY}
                                                    egogifts={shareBoardPreviewEgoGiftsFlatExcludingFloorLimited}
                                                    keywordIndex={0}
                                                    resultSimplified={false}
                                                    keywordGiftExpandedByKeyword={shareBoardPreviewKeywordGiftExpandedByKeyword}
                                                    setKeywordGiftExpandedByKeyword={setShareBoardPreviewKeywordGiftExpandedByKeyword}
                                                    synthesisExpandedByKeyword={shareBoardPreviewSynthesisExpandedByKeyword}
                                                    setSynthesisExpandedByKeyword={setShareBoardPreviewSynthesisExpandedByKeyword}
                                                    synthesisRecipes={shareBoardPreviewSynthesisRecipes}
                                                    resultEgoGifts={shareBoardPreviewEgoGifts}
                                                    checkedEgoGiftIds={[]}
                                                    onToggleEgoGiftCheck={() => {}}
                                                    onRemoveStarredEgoGift={() => {}}
                                                    sectionRef={() => {}}
                                                    synthesisRef={() => {}}
                                                    onCaptureSection={() => {}}
                                                    egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                    variant="flat"
                                                    readOnly
                                                  />
                                                </div>
                                              ) : (
                                                shareBoardPreviewEgoGiftsByKeyword.map(({ keyword, egogifts }, idx) => (
                                                  <ResultKeywordSection
                                                    key={`share-board-preview-${keyword}`}
                                                    keyword={keyword}
                                                    egogifts={egogifts}
                                                    keywordIndex={idx}
                                                    resultSimplified={false}
                                                    keywordGiftExpandedByKeyword={shareBoardPreviewKeywordGiftExpandedByKeyword}
                                                    setKeywordGiftExpandedByKeyword={setShareBoardPreviewKeywordGiftExpandedByKeyword}
                                                    synthesisExpandedByKeyword={shareBoardPreviewSynthesisExpandedByKeyword}
                                                    setSynthesisExpandedByKeyword={setShareBoardPreviewSynthesisExpandedByKeyword}
                                                    synthesisRecipes={shareBoardPreviewSynthesisRecipes}
                                                    resultEgoGifts={shareBoardPreviewEgoGifts}
                                                    checkedEgoGiftIds={[]}
                                                    onToggleEgoGiftCheck={() => {}}
                                                    onRemoveStarredEgoGift={() => {}}
                                                    sectionRef={() => {}}
                                                    synthesisRef={() => {}}
                                                    onCaptureSection={() => {}}
                                                    egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                    readOnly
                                                  />
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <div ref={shareBoardDetailCommentsSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-5">
                                          <div className="mb-2 flex items-center justify-between gap-2">
                                            <div className="text-sm font-semibold text-yellow-300">
                                              댓글 ({shareBoardComments.filter((c) => c.deletedYn !== "Y").length})
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (shareBoardSelectedPost?.postId) {
                                                  void fetchShareBoardComments(shareBoardSelectedPost.postId);
                                                }
                                              }}
                                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#b8860b]/40 text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-200"
                                              title="댓글 새로고침"
                                              aria-label="댓글 새로고침"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                                <path d="M21 3v6h-6" />
                                              </svg>
                                            </button>
                                          </div>
                                          <div className="space-y-3">
                                            {shareBoardAuthenticated ? (
                                              <div className="flex gap-2">
                                                <input
                                                  type="text"
                                                  value={shareBoardCommentInput}
                                                  onChange={(e) => setShareBoardCommentInput(e.target.value)}
                                                  placeholder="댓글을 입력하세요"
                                                  className="flex-1 px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => submitShareBoardComment(shareBoardCommentInput)}
                                                  disabled={shareBoardCommentSubmitting}
                                                  className="px-3 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50"
                                                >
                                                  등록
                                                </button>
                                              </div>
                                            ) : (
                                              <p className="text-xs text-gray-400">댓글 등록은 로그인 후 가능합니다.</p>
                                            )}
                                            {shareBoardCommentsLoading ? (
                                              <p className="text-xs text-gray-400">댓글을 불러오는 중...</p>
                                            ) : (
                                              <div className="space-y-2">
                                                {shareBoardComments.filter((c) => c.depth === 1).map((comment) => {
                                                  const children = shareBoardComments.filter((ch) => ch.parentCommentId === comment.commentId);
                                                  return (
                                                    <div key={comment.commentId} className="rounded border border-[#b8860b]/25 bg-[#1a1a1d] p-3">
                                                      <div className="text-xs text-gray-500 mb-1">
                                                        {comment.authorNickname || "사용자"} · {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "-"}
                                                      </div>
                                                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{comment.content}</p>
                                                      <div className="mt-2 flex items-center gap-2 text-xs">
                                                        {shareBoardAuthenticated && comment.deletedYn !== "Y" && (
                                                          <button type="button" onClick={() => setShareBoardReplyParentId((prev) => (prev === comment.commentId ? null : comment.commentId))} className="text-cyan-300 hover:text-cyan-200">
                                                            답글
                                                          </button>
                                                        )}
                                                        {comment.isMine && comment.deletedYn !== "Y" && (
                                                          <button type="button" onClick={() => deleteShareBoardComment(comment.commentId)} className="text-red-300 hover:text-red-200">
                                                            삭제
                                                          </button>
                                                        )}
                                                      </div>
                                                      {shareBoardAuthenticated && shareBoardReplyParentId === comment.commentId && (
                                                        <div className="mt-2 flex gap-2">
                                                          <input
                                                            type="text"
                                                            value={shareBoardReplyInput}
                                                            onChange={(e) => setShareBoardReplyInput(e.target.value)}
                                                            placeholder="답글을 입력하세요"
                                                            className="flex-1 px-3 py-2 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() => submitShareBoardComment(shareBoardReplyInput, comment.commentId)}
                                                            disabled={shareBoardCommentSubmitting}
                                                            className="px-3 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-50"
                                                          >
                                                            등록
                                                          </button>
                                                        </div>
                                                      )}
                                                      {children.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                          {children.map((child) => (
                                                            <div key={child.commentId} className="ml-4 rounded border border-[#b8860b]/20 bg-[#151518] p-3">
                                                              <div className="text-xs text-gray-500 mb-1">
                                                                {child.authorNickname || "사용자"} · {child.createdAt ? new Date(child.createdAt).toLocaleString() : "-"}
                                                              </div>
                                                              <p className="text-sm text-gray-200 whitespace-pre-wrap">{child.content}</p>
                                                              {child.isMine && child.deletedYn !== "Y" && (
                                                                <button type="button" onClick={() => deleteShareBoardComment(child.commentId)} className="mt-2 text-xs text-red-300 hover:text-red-200">
                                                                  삭제
                                                                </button>
                                                              )}
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {shareBoardMode === "list" && (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <select value={shareBoardSort} onChange={(e) => setShareBoardSort((e.target.value as "latest" | "recommend7" | "recommend15" | "recommend30") || "latest")} className="px-2 py-1.5 text-sm rounded bg-[#2a2a2d] border border-[#b8860b]/40 text-gray-200">
                                <option value="latest">최신순</option>
                                <option value="recommend7">추천순(7일)</option>
                                <option value="recommend15">추천순(15일)</option>
                                <option value="recommend30">추천순(30일)</option>
                              </select>
                              <select value={shareBoardSearchType} onChange={(e) => setShareBoardSearchType((e.target.value as "title" | "author") || "title")} className="px-2 py-1.5 text-sm rounded bg-[#2a2a2d] border border-[#b8860b]/40 text-gray-200">
                                <option value="title">제목</option>
                                <option value="author">작성자</option>
                              </select>
                              <button type="button" onClick={() => fetchShareBoardPosts()} className="px-3 py-1.5 text-sm rounded border border-[#b8860b]/40 text-gray-200 hover:bg-[#2a2a2d]">적용</button>
                              <button
                                type="button"
                                onClick={() => setShareBoardPopularOnly((prev) => !prev)}
                                className={`px-3 py-1.5 text-sm rounded border transition-colors ${shareBoardPopularOnly ? "border-yellow-400/70 bg-yellow-500/20 text-yellow-200" : "border-[#b8860b]/40 text-gray-200 hover:bg-[#2a2a2d]"}`}
                                title="추천 10개 이상 게시글만 보기"
                              >
                                추천글
                              </button>
                            </div>
                          </div>
                          <input type="text" value={shareBoardSearchText} onChange={(e) => setShareBoardSearchText(e.target.value)} placeholder={shareBoardSearchType === "author" ? "작성자 검색" : "제목 검색"} className="w-full px-3 py-2 mb-3 bg-[#2a2a2d] border border-[#b8860b]/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                          {shareBoardLoading ? (
                            <p className="text-sm text-gray-400">목록을 불러오는 중...</p>
                          ) : filteredShareBoardPosts.length === 0 ? (
                            <p className="text-sm text-gray-400">등록된 게시글이 없습니다.</p>
                          ) : (
                            <>
                              <div className="space-y-2">
                                {filteredShareBoardPosts.map((post) => (
                                  <button key={post.postId} type="button" onClick={() => handleShareBoardOpenPost(post.postId)} className="w-full text-left bg-[#1a1a1d] border border-[#b8860b]/30 rounded p-3 hover:bg-[#232327] transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-medium text-yellow-200 truncate">{post.title}</div>
                                      <div className="text-xs text-yellow-300 shrink-0">추천 {post.recommendCount ?? 0}</div>
                                    </div>
                                    {post.description && (
                                      <p className="text-sm text-gray-300 mt-1">
                                        {post.description.length > 30 ? `${post.description.slice(0, 30)}...` : post.description}
                                      </p>
                                    )}
                                    <div className="text-xs text-gray-500 mt-1">
                                      작성자: {post.authorNickname || "사용자"} · 댓글 {post.commentCount ?? 0} · {post.createdAt ? new Date(post.createdAt).toLocaleString() : "-"}
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                                <div className="text-gray-400">총 {shareBoardTotalCount}개 · {shareBoardPage}/{shareBoardTotalPages} 페이지</div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShareBoardPage((p) => Math.max(1, p - 1))}
                                    disabled={shareBoardPage <= 1}
                                    className="px-2.5 py-1.5 rounded border border-[#b8860b]/40 text-gray-200 hover:bg-[#2a2a2d] disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    이전
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShareBoardPage((p) => Math.min(shareBoardTotalPages, p + 1))}
                                    disabled={shareBoardPage >= shareBoardTotalPages}
                                    className="px-2.5 py-1.5 rounded border border-[#b8860b]/40 text-gray-200 hover:bg-[#2a2a2d] disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    다음
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="w-full flex-shrink-0 order-1 min-w-[240px]">
                {favoritesPanel}
              </div>
              <div className="w-full order-2">
                {activeTab === "result" && (
                  <div className="space-y-6">
                    {selectedFavoriteId === null ? (
                      <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                        <p className="text-gray-400">보고서를 생성/선택해주세요.</p>
                      </div>
                    ) : (
                      <>
                        <div ref={reportIdentitySectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-5 mb-4">
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                              <h3 className="text-lg font-semibold text-yellow-300">인격/E.G.O 선택</h3>
                              <ReportHelpTrigger sectionId="identity" onOpen={setReportSectionHelpId} />
                            </div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="inline-flex rounded-md border border-[#b8860b]/35 bg-[#1a1a1d] p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setReportIdentityTab("personality")}
                                  className={`px-2.5 py-1 text-xs rounded ${
                                    reportIdentityTab === "personality"
                                      ? "bg-amber-500/25 text-amber-100"
                                      : "text-gray-400 hover:bg-white/5"
                                  }`}
                                >
                                  인격 선택
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReportIdentityTab("ego")}
                                  className={`px-2.5 py-1 text-xs rounded ${
                                    reportIdentityTab === "ego"
                                      ? "bg-amber-500/25 text-amber-100"
                                      : "text-gray-400 hover:bg-white/5"
                                  }`}
                                >
                                  E.G.O 선택
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void captureReportIdentitySectionAsImage()}
                                  className="px-2.5 py-1 text-xs rounded border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/15"
                                >
                                  이미지 다운로드
                                </button>
                                {reportIdentityTab === "personality" ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={resetFormationOrders}
                                      className="px-2.5 py-1 text-xs rounded border border-[#b8860b]/35 text-amber-100 hover:bg-amber-500/20"
                                    >
                                      편성 순서 초기화
                                    </button>
                                    <button
                                      type="button"
                                      onClick={clearAllIdentitySlots}
                                      className="px-2.5 py-1 text-xs rounded border border-red-400/35 text-red-200 hover:bg-red-500/15"
                                    >
                                      인격 전체 선택 해제
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={clearAllIdentitySlots}
                                    className="px-2.5 py-1 text-xs rounded border border-red-400/35 text-red-200 hover:bg-red-500/15"
                                  >
                                    E.G.O 전체 선택 해제
                                  </button>
                                )}
                              </div>
                            </div>
                            {reportIdentityTab === "personality" && (
                              <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                                <div className="rounded border border-emerald-500/30 bg-emerald-900/10 px-2 py-2">
                                  <div className="mb-1 text-[11px] text-emerald-200/90">편성 인격 키워드</div>
                                  {reportPersonalityFormationKeywordCounts.length === 0 ? (
                                    <p className="text-[11px] text-gray-500">아직 편성된 인격이 없습니다.</p>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {reportPersonalityFormationKeywordCounts.map((row) => (
                                        <div
                                          key={`report-formation-kw-count-${row.keyword}`}
                                          className="inline-flex items-center gap-1 rounded border border-emerald-400/25 bg-[#151b18] px-1.5 py-1"
                                        >
                                          <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                          <span className="text-[11px] text-emerald-100">{row.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-2 border-t border-emerald-500/25 pt-2">
                                    <div className="mb-1 text-[11px] text-emerald-200/90">속성별 최대 획득 가능 자원 ( 1 라운드 기준 / 집중 전투 )</div>
                                    {reportFormationRound1AcquirableResources.length === 0 ? (
                                      <p className="text-[11px] text-gray-500">편성 인격이 없거나 조건에 맞는 스킬이 없습니다.</p>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {reportFormationRound1AcquirableResources.map((row) => (
                                          <div
                                            key={`report-round1-res-${row.name}`}
                                            className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-[#151b18] px-1.5 py-1"
                                          >
                                            <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                            <span className="text-[11px] text-emerald-100 tabular-nums">{row.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded border border-[#b8860b]/25 bg-[#0f0f12] px-2 py-2">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-gray-400">전체 인격 키워드</div>
                                    <div />
                                </div>
                                {reportPersonalityKeywordCounts.length === 0 ? (
                                  <p className="text-[11px] text-gray-500">아직 집계할 키워드가 없습니다.</p>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {reportPersonalityKeywordCounts.map((row) => (
                                      <div
                                        key={`report-kw-count-${row.keyword}`}
                                        className="inline-flex items-center gap-1 rounded border border-[#b8860b]/20 bg-[#151518] px-1.5 py-1"
                                      >
                                        <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                        <span className="text-[11px] text-gray-200">{row.count}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              </div>
                            )}
                            {reportIdentityTab === "ego" && (
                              <div className="mb-3 rounded border border-sky-500/30 bg-sky-900/10 px-2 py-2">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="text-[11px] text-sky-200/90">필요 자원</div>
                                  <div />
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {reportEgoResourceCounts.map((row) => (
                                    <div
                                      key={`ego-resource-${row.name}`}
                                      className="inline-flex items-center gap-1 rounded border border-sky-400/25 bg-[#151922] px-1.5 py-1"
                                    >
                                      <img src={row.iconPath} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                                      <span className="text-[11px] text-sky-100">{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
                              {REPORT_PERSONALITY_OPTIONS.map((p, slotIndex) => {
                                if (reportIdentityTab === "ego") {
                                  const picked = reportEgoSlots[slotIndex]?.selectedByGrade ?? {};
                                  const egoBackgroundImage =
                                    REPORT_PERSONALITY_ICON_BACKGROUND_BY_ORDER[p.order] ?? p.image;
                                  return (
                                    <button
                                      key={p.order}
                                      type="button"
                                      onClick={() => void openEgoPicker(slotIndex)}
                                      className="flex min-w-0 w-full flex-col overflow-hidden rounded-lg border border-[#b8860b]/40 bg-[#1a1a1d] text-left hover:border-[#d4af37]/50 transition-colors"
                                    >
                                      <div className="relative flex h-[126px] sm:h-[158px] w-full items-center justify-center bg-[#111] shrink-0 overflow-hidden">
                                        <img
                                          src={egoBackgroundImage}
                                          alt=""
                                          className="block h-auto w-auto max-h-full max-w-full object-contain object-center opacity-55"
                                        />
                                      </div>
                                      <div className="min-h-[5rem] border-t border-[#b8860b]/25 px-1.5 py-2">
                                        <div className="text-[18px] sm:text-[20px] text-gray-100 font-semibold text-center line-clamp-1 mb-1.5">
                                          {p.name}
                                        </div>
                                        <div className="space-y-1">
                                          {REPORT_EGO_GRADE_ORDER.map((grade) => (
                                            <div key={`${p.order}-${grade}`} className="flex items-center gap-1.5 text-[16px] sm:text-[18px] leading-tight">
                                              <span className="w-16 shrink-0 text-amber-300/90 font-semibold">{grade}</span>
                                              <span className="min-w-0 truncate text-gray-200">{picked[grade]?.title ?? "-"}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                }
                                const slot = activeReportIdentitySlots[slotIndex] ?? null;
                                const filled = slot != null && slot.imagePath;
                                const hasBeforeSync = Boolean(slot?.beforeSyncImagePath);
                                const hasAfterSync = Boolean(slot?.afterSyncImagePath);
                                const hasBothSync = hasBeforeSync && hasAfterSync;
                                return (
                                  <div
                                    key={p.order}
                                    className={`flex min-w-0 w-full flex-col overflow-hidden rounded-lg border ${
                                      filled
                                        ? personalityGradeCardToneClass(slot?.grade)
                                        : "border-[#b8860b]/40 bg-[#1a1a1d] hover:border-[#d4af37]/50"
                                    }`}
                                  >
                                    <div className="group flex min-w-0 w-full flex-col text-left transition-colors">
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => void openPersonalityPicker(slotIndex)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            void openPersonalityPicker(slotIndex);
                                          }
                                        }}
                                        className="relative w-full aspect-[2/3] bg-[#111] shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50"
                                      >
                                        {filled ? (
                                          <img
                                            src={`${RESULT_EGOGIFT_BASE_URL}${slot!.imagePath}`}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                          />
                                        ) : (
                                          <div
                                            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45 transition-opacity group-hover:opacity-55"
                                            style={{ backgroundImage: `url(${p.image})`, backgroundPosition: "center 18%" }}
                                            aria-hidden
                                          />
                                        )}
                                        {!filled ? (
                                          <div className="absolute inset-0 flex items-end justify-center pb-1 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                                            <span className="text-[12px] text-yellow-200/90 font-medium px-1">탭하여 선택</span>
                                          </div>
                                        ) : null}
                                        {filled ? (
                                          <div className="absolute inset-0 flex flex-col bg-black/25 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void openPersonalityPicker(slotIndex);
                                              }}
                                              className="h-[30%] border-b border-[#b8860b]/25 bg-black/30 text-[10px] sm:text-xs font-semibold text-gray-300 transition-colors hover:bg-amber-500/35 hover:text-amber-100"
                                            >
                                              인격 변경
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFormationForSlot(slotIndex);
                                              }}
                                              className={`h-[70%] bg-black/20 text-[10px] sm:text-xs font-semibold text-gray-300 transition-colors ${
                                                slot?.formationOrder
                                                  ? "hover:bg-red-500/35 hover:text-red-100"
                                                  : "hover:bg-amber-500/35 hover:text-amber-100"
                                              }`}
                                            >
                                              {slot?.formationOrder ? "편성 해제" : "인격 편성"}
                                            </button>
                                          </div>
                                        ) : null}
                                        {filled && slot?.formationOrder ? (
                                          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/15">
                                            <span className={`text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] ${
                                              slot.formationOrder <= 7 ? "text-yellow-300" : "text-cyan-300"
                                            }`}>
                                              {slot.formationOrder}
                                            </span>
                                          </div>
                                        ) : null}
                                        {filled ? (
                                          <div className="pointer-events-none absolute bottom-0.5 right-0.5 z-[6] flex flex-wrap items-end justify-end gap-px rounded bg-black/35 p-px sm:bottom-1 sm:right-1 sm:gap-0.5 sm:p-0.5">
                                            {getPersonalityKeywordIconPaths(slot?.keywords).map((src, ki) => (
                                              <img
                                                key={`${slot?.personalityId ?? p.order}-slot-kw-overlay-${ki}`}
                                                src={src}
                                                alt=""
                                                width={32}
                                                height={32}
                                                className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6 lg:h-7 lg:w-7 xl:h-8 xl:w-8"
                                              />
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                      <span className="flex flex-col items-center justify-center gap-0.5 border-t border-[#b8860b]/25 px-0.5 py-1.5 text-center leading-snug">
                                        <span className="flex min-h-[2.5rem] sm:min-h-[2.75rem] w-full items-center justify-center">
                                          <span className="line-clamp-2 w-full text-center text-[12px] sm:text-[14px] text-gray-200">
                                            {filled ? slot!.name : p.name}
                                          </span>
                                        </span>
                                      </span>
                                    </div>
                                    {filled && hasBothSync ? (
                                      <div className="flex flex-col gap-1.5 shrink-0 border-t border-[#b8860b]/20 bg-[#0f0f12] px-1 py-1 lg:flex-row lg:items-stretch lg:gap-1">
                                        <div className="relative order-1 w-full shrink-0 lg:order-2 lg:w-5 lg:self-stretch">
                                          <button
                                            type="button"
                                            className="flex w-full shrink-0 items-center justify-center rounded border border-[#b8860b]/25 bg-[#1a1a1d] px-3 py-1.5 text-[15px] leading-none text-gray-300 hover:bg-[#232327] lg:h-full lg:px-0 lg:py-0"
                                            aria-label="옵션 메뉴"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSkillPresetMenuSlotIndex((prev) => (prev === slotIndex ? null : slotIndex));
                                            }}
                                          >
                                            <span className="lg:hidden tracking-[0.65em] text-gray-200" aria-hidden>
                                              ⋯
                                            </span>
                                            <span className="hidden lg:flex lg:h-full lg:w-full lg:items-center lg:justify-center text-gray-200" aria-hidden>
                                              ⋮
                                            </span>
                                          </button>
                                          {skillPresetMenuSlotIndex === slotIndex ? (
                                            <div className="absolute left-1/2 bottom-full z-[40] mb-1.5 w-[88px] -translate-x-1/2 rounded border border-[#b8860b]/35 bg-[#1a1a1d] p-1 shadow-lg lg:left-auto lg:right-0 lg:translate-x-0">
                                              {(["105", "015", "051", "114", "042"] as const).map((preset) => (
                                                <button
                                                  key={`skill-preset-${slotIndex}-${preset}`}
                                                  type="button"
                                                  onClick={() => {
                                                    setReportPersonalitySlots((prev) => {
                                                      const next = [...prev];
                                                      const cur = next[slotIndex];
                                                      if (!cur) return prev;
                                                      next[slotIndex] = {
                                                        ...cur,
                                                        skillInputValues: [preset[0], preset[1], preset[2]],
                                                      };
                                                      return next;
                                                    });
                                                    setSkillPresetMenuSlotIndex(null);
                                                  }}
                                                  className="mb-1 last:mb-0 h-7 w-full rounded border border-[#b8860b]/25 bg-[#131316] text-[10px] font-semibold text-amber-100 hover:bg-amber-500/20"
                                                >
                                                  {preset}
                                                </button>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="order-2 flex min-w-0 flex-1 items-center gap-1 lg:order-1">
                                        {[0, 1, 2].map((idx) => {
                                          const attrColor = getSkillAttributeBorderColor(slot?.skillAttributes, idx);
                                          return (
                                          <div
                                            key={`slot-skill-input-wrap-${slotIndex}-${idx}`}
                                            className="min-w-0 flex-1 flex flex-col items-center gap-0.5 rounded border p-0.5"
                                            style={{
                                              borderColor: attrColor,
                                              backgroundColor: colorWithAlpha(attrColor, 0.1),
                                            }}
                                          >
                                            {(() => {
                                              const iconPath = getSkillAttackTypeIconPath(slot?.skillAttackTypes, idx);
                                              return iconPath ? (
                                                <img
                                                  src={iconPath}
                                                  alt=""
                                                  width={28}
                                                  height={28}
                                                  className="h-7 w-7 object-contain"
                                                />
                                              ) : (
                                                <span className="h-7 w-7" aria-hidden />
                                              );
                                            })()}
                                            <input
                                              type="text"
                                              className="h-7 min-w-0 w-full rounded border border-[#b8860b]/25 bg-[#1a1a1d] px-1 text-[14px] font-semibold text-center text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-400/60"
                                              placeholder={`입력${idx + 1}`}
                                              value={slot?.skillInputValues?.[idx] ?? (filled ? (idx === 0 ? "3" : idx === 1 ? "2" : "1") : "")}
                                              onChange={(e) =>
                                                setReportPersonalitySlots((prev) => {
                                                  const next = [...prev];
                                                  const cur = next[slotIndex];
                                                  if (!cur) return prev;
                                                  const values = [...(cur.skillInputValues ?? ["3", "2", "1"])];
                                                  values[idx] = e.target.value;
                                                  next[slotIndex] = { ...cur, skillInputValues: values.slice(0, 3) };
                                                  return next;
                                                })
                                              }
                                            />
                                          </div>
                                        )})}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        {portalMounted &&
                          egoPickerSlotIndex != null &&
                          createPortal(
                            <div
                              className="fixed inset-0 z-[231] flex items-center justify-center p-4 bg-black/80"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="ego-picker-title"
                              onClick={() => setEgoPickerSlotIndex(null)}
                            >
                              <div
                                className="relative flex max-h-[min(92vh,900px)] w-full max-w-[min(72rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-[#b8860b]/50 bg-[#131316] shadow-xl overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-2 border-b border-[#b8860b]/40 px-4 py-3 shrink-0">
                                  <div>
                                    <h4 id="ego-picker-title" className="text-xl font-semibold text-yellow-300">
                                      {REPORT_PERSONALITY_OPTIONS[egoPickerSlotIndex].name} 에고 목록
                                    </h4>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={applyEgoPickerSelection}
                                      className="px-2 py-1 text-[13px] sm:text-sm text-emerald-200 rounded border border-emerald-400/40 hover:bg-emerald-500/15"
                                    >
                                      등록
                                    </button>
                                    <button
                                      type="button"
                                      onClick={clearAllEgoPickerSelection}
                                      className="px-2 py-1 text-[13px] sm:text-sm text-red-200 rounded border border-red-400/30 hover:bg-red-500/15"
                                    >
                                      전체 선택 해제
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEgoPickerSlotIndex(null)}
                                      className="px-2 py-1 text-gray-400 hover:text-white rounded border border-transparent hover:border-[#b8860b]/40"
                                      aria-label="닫기"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 min-h-0">
                                  {egoPickerLoading ? (
                                    <p className="text-gray-400 text-sm text-center py-8">불러오는 중…</p>
                                  ) : egoPickerError ? (
                                    <p className="text-red-300 text-sm text-center py-8">{egoPickerError}</p>
                                  ) : (
                                    <div className="space-y-4">
                                      {REPORT_EGO_GRADE_ORDER.map((grade) => (
                                        <section key={`ego-grade-${grade}`} className="rounded border border-[#b8860b]/25 bg-[#0f0f12]">
                                          <div className="px-3 py-2 border-b border-[#b8860b]/20">
                                            {EGO_GRADE_LABEL_ICON_MAP[grade] ? (
                                              <img
                                                src={EGO_GRADE_LABEL_ICON_MAP[grade]}
                                                alt={grade}
                                                className="h-5 w-auto object-contain"
                                              />
                                            ) : (
                                              <span className="text-xs font-semibold text-amber-200">{grade}</span>
                                            )}
                                          </div>
                                          <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                                            {(egoPickerGroupedByGrade[grade] ?? []).map((row) => {
                                              const selected = egoPickerSelectedByGrade[grade]?.egoId === row.egoId;
                                              const imagePath = extractPathFromUnknownImage(row.image);
                                              return (
                                                <button
                                                  key={row.egoId}
                                                  type="button"
                                                  onClick={() => toggleEgoPickerSelection(row)}
                                                  className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-colors ${
                                                    selected
                                                      ? "border-yellow-400/70 bg-yellow-500/15"
                                                      : "border-[#b8860b]/30 bg-[#1a1a1d] hover:border-[#d4af37]/50"
                                                  }`}
                                                >
                                                  <div className={`h-40 w-40 overflow-hidden rounded-full border ${selected ? "border-yellow-400/80" : "border-[#b8860b]/40"}`}>
                                                    {imagePath ? (
                                                      <img
                                                        src={`${RESULT_EGOGIFT_BASE_URL}${imagePath}`}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                      />
                                                    ) : (
                                                      <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-600">이미지 없음</div>
                                                    )}
                                                  </div>
                                                  <span className="line-clamp-2 text-center text-[20px] sm:text-[22px] text-gray-100">
                                                    {row.title}
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </section>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>,
                            document.body
                          )}
                        {portalMounted &&
                          personalityPickerSlotIndex != null &&
                          createPortal(
                            <div
                              className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/80"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="personality-picker-title"
                              onClick={() => setPersonalityPickerSlotIndex(null)}
                            >
                              <div
                                className="relative flex max-h-[min(92vh,900px)] w-full max-w-[min(72rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-[#b8860b]/50 bg-[#131316] shadow-xl overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-2 border-b border-[#b8860b]/40 px-4 py-3 shrink-0">
                                  <div>
                                    <h4 id="personality-picker-title" className="text-lg font-semibold text-yellow-300">
                                      {REPORT_PERSONALITY_OPTIONS[personalityPickerSlotIndex].name} 인격 목록
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      카드(세로)를 눌러 인격을 교체합니다. 썸네일 기본은 동기화 후입니다.
                                    </p>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={clearPersonalityFromPicker}
                                      className="px-2 py-1 text-[11px] sm:text-xs text-red-200/90 rounded border border-red-400/30 hover:bg-red-500/15 hover:text-red-100"
                                    >
                                      선택 해제
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPersonalityPickerSlotIndex(null)}
                                      className="px-2 py-1 text-gray-400 hover:text-white rounded border border-transparent hover:border-[#b8860b]/40"
                                      aria-label="닫기"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 min-h-0">
                                  {personalityPickerLoading ? (
                                    <p className="text-gray-400 text-sm text-center py-8">불러오는 중…</p>
                                  ) : personalityPickerError ? (
                                    <p className="text-red-300 text-sm text-center py-8">{personalityPickerError}</p>
                                  ) : personalityPickerList.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-8">등록된 인격이 없습니다.</p>
                                  ) : (
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
                                      {personalityPickerList.map((row) => {
                                        const hasBefore = Boolean(row.beforeSyncImage?.path);
                                        const hasAfter = Boolean(row.afterSyncImage?.path);
                                        const explicit = personalityPickerShowAfter[row.personalityId];
                                        const useAfterThumb =
                                          hasBefore && hasAfter
                                            ? explicit !== false
                                            : hasAfter
                                              ? true
                                              : false;
                                        const thumbPath =
                                          (useAfterThumb ? row.afterSyncImage?.path : row.beforeSyncImage?.path) ??
                                          row.afterSyncImage?.path ??
                                          row.beforeSyncImage?.path ??
                                          "";
                                        return (
                                          <div
                                            key={row.personalityId}
                                            className={`flex min-w-0 flex-col overflow-hidden rounded-lg border ${personalityGradeCardToneClass(row.grade)}`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() =>
                                                applyPersonalityFromPicker(
                                                  personalityPickerSlotIndex,
                                                  row,
                                                  useAfterThumb
                                                )
                                              }
                                              className="group flex min-w-0 w-full flex-1 flex-col text-left outline-none transition-colors hover:bg-[#232328] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400/50"
                                            >
                                              <div className="relative w-full aspect-[2/3] shrink-0 overflow-hidden bg-[#111]">
                                                {thumbPath ? (
                                                  <img
                                                    src={`${RESULT_EGOGIFT_BASE_URL}${thumbPath}`}
                                                    alt=""
                                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                                  />
                                                ) : (
                                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-600 px-1 text-center">
                                                    이미지 없음
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex flex-col items-center justify-center gap-0.5 border-t border-[#b8860b]/25 px-1 py-2 text-center">
                                                <span className="text-[10px] sm:text-xs font-semibold text-amber-200/90 tabular-nums">
                                                  [{row.grade}성]
                                                </span>
                                                <span className="line-clamp-3 w-full text-[10px] sm:text-[11px] leading-snug text-gray-100">
                                                  {row.name}
                                                </span>
                                                <div className="flex min-h-[18px] w-full flex-wrap items-center justify-center gap-0.5">
                                                  {getPersonalityKeywordIconPaths(row.keywords).map((src, ki) => (
                                                    <img
                                                      key={`${row.personalityId}-kw-${ki}`}
                                                      src={src}
                                                      alt=""
                                                      width={18}
                                                      height={18}
                                                      className="h-4 w-4 shrink-0 object-contain sm:h-[18px] sm:w-[18px]"
                                                    />
                                                  ))}
                                                </div>
                                              </div>
                                            </button>
                                            {null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>,
                            document.body
                          )}
                        {selectedReportSchemaVersion === 2 && (
                          <div
                            ref={v2PlannedCardPacksSectionRef}
                            className={`bg-[#131316] border border-[#b8860b]/40 rounded-lg mb-4 overflow-visible ${v2PlannedSectionSimplified ? "p-3 md:p-4 pb-6" : "p-4 md:p-6 pb-10"}`}
                          >
                            <div className="mb-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#b8860b]/40 pb-3">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void captureV2PlannedCardPacksSectionAsImage()}
                                  className="min-w-0 cursor-pointer rounded px-0 py-0 text-left text-lg font-semibold text-yellow-300 hover:text-yellow-100 hover:underline focus:outline-none focus:underline"
                                  title="클릭 시 진행(예정) 카드팩 목록 영역 전체를 이미지로 저장"
                                >
                                  진행(예정) 카드팩 목록
                                </button>
                                <ReportHelpTrigger sectionId="cardpackPlanned" onOpen={setReportSectionHelpId} />
                              </div>
                              <div className="ml-auto flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => setV2PlannedSectionSimplified((v) => !v)}
                                  className={`px-2.5 py-1.5 text-xs sm:text-sm rounded border transition-colors flex items-center gap-1 ${
                                    v2PlannedSectionSimplified
                                      ? "text-cyan-300 border-cyan-400/60 bg-cyan-500/20 hover:bg-cyan-500/30"
                                      : "text-gray-300 border-gray-400/40 hover:bg-white/10"
                                  }`}
                                  title={v2PlannedSectionSimplified ? "슬롯·여백을 기본 크기로" : "슬롯·여백을 줄여 한 화면에 더 많이"}
                                  aria-pressed={v2PlannedSectionSimplified}
                                >
                                  {v2PlannedSectionSimplified ? "간소화 해제" : "간소화"}
                                </button>
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    setV2PlannedSectionExpanded((prev) => {
                                      if (prev) setV2FloorModalFloor(null);
                                      return !prev;
                                    });
                                  }}
                                  className="shrink-0 rounded p-1 text-yellow-200/80 transition-colors hover:bg-white/10 hover:text-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
                                  aria-expanded={v2PlannedSectionExpanded}
                                  title={v2PlannedSectionExpanded ? "접기" : "펼치기"}
                                  aria-label={v2PlannedSectionExpanded ? "접기" : "펼치기"}
                                >
                                  <span
                                    className={`inline-block transition-transform duration-200 ${v2PlannedSectionExpanded ? "rotate-90" : ""}`}
                                    aria-hidden
                                  >
                                    ▶
                                  </span>
                                </button>
                              </div>
                            </div>
                            {v2PlannedSectionExpanded && (
                            <>
                            {plannableCardPacksLoading ? (
                              <p className="text-gray-400 text-sm mb-3">카드팩 목록을 불러오는 중…</p>
                            ) : plannableCardPacks.length === 0 ? (
                              <p className="text-gray-400 text-sm mb-3">카드팩 목록을 불러올 수 없습니다.</p>
                            ) : null}
                            <div
                              className={`min-h-[120px] rounded-lg border border-[#b8860b]/30 bg-[#0d0d0f]/50 overflow-visible ${
                                v2PlannedSectionSimplified ? "p-2 sm:p-2.5" : "p-3 md:p-3 lg:p-4"
                              }`}
                            >
                              {v2PlannedSectionSimplified ? (
                                <div className="w-full space-y-3">
                                  {V2_FLOOR_ROWS.slice(0, v2PlannedFloorRowCount).map((rowFloors, rowIdx) => (
                                    <div key={rowIdx} className="space-y-1.5">
                                      {rowFloors.map((floor) => {
                                        const packId = checkedCardPackByFloor[floor];
                                        const pack = packId
                                          ? plannableCardPacks.find((p) => p.cardpackId === packId)
                                          : undefined;
                                        const slotDiff = pack
                                          ? plannedCardPackDifficultyByFloor[floor]
                                          : undefined;
                                        const borderCls =
                                          pack && slotDiff
                                            ? v2SlotBorderClass(slotDiff)
                                            : "border-[#b8860b]/45 hover:border-[#d4af37]/55";
                                        const slotDisabled = plannableCardPacksLoading || plannableCardPacks.length === 0;
                                        const diffLabel = slotDiff ? v2DifficultySlotLabel(slotDiff) : "";
                                        const diffTextCls = v2DifficultyLineTextClass(slotDiff);
                                        return (
                                          <button
                                            key={floor}
                                            type="button"
                                            disabled={slotDisabled}
                                            onClick={() => {
                                              if (slotDisabled) return;
                                              setV2FloorModalFloor(floor);
                                            }}
                                            className={`w-full rounded-md border bg-[#131316]/90 px-2.5 py-2 text-left text-sm leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-yellow-400/50 ${borderCls} ${
                                              slotDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#1c1c21]"
                                            }`}
                                          >
                                            <span className="tabular-nums text-gray-400">{floor}층 </span>
                                            {pack && slotDiff ? (
                                              <>
                                                <span className={diffTextCls}>({diffLabel})</span>
                                                <span className="text-gray-500"> - </span>
                                                <span className="break-words text-gray-100">{pack.title}</span>
                                              </>
                                            ) : (
                                              <span className="text-gray-500">
                                                {pack && !slotDiff ? (
                                                  <>
                                                    <span className="text-gray-500">— </span>
                                                    <span className="break-words text-gray-200">{pack.title}</span>
                                                  </>
                                                ) : (
                                                  "비어 있음 · 탭하여 선택"
                                                )}
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="w-full space-y-3 sm:space-y-4">
                                  {V2_FLOOR_ROWS.slice(0, v2PlannedFloorRowCount).map((rowFloors, rowIdx) => (
                                    <div
                                      key={rowIdx}
                                      className="grid w-full grid-cols-5 gap-1.5 sm:gap-2 md:gap-2 lg:gap-3"
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
                                            className={`flex min-h-[180px] flex-col items-stretch rounded-lg border bg-[#131316]/80 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-yellow-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0f] sm:min-h-[200px] md:min-h-[220px] lg:min-h-[240px] ${
                                              slotDisabled ? "pointer-events-none cursor-not-allowed opacity-50" : "cursor-pointer"
                                            } ${borderCls}`}
                                          >
                                            <span className="shrink-0 border-b border-[#b8860b]/30 bg-[#131316] px-1 py-1.5 text-center text-xs font-semibold leading-tight text-yellow-200/90 sm:py-2 md:text-base">
                                              {floorTitle}
                                            </span>
                                            <div className="relative flex min-h-[140px] flex-1 flex-col items-center justify-center p-1.5 sm:min-h-[160px] md:min-h-[170px]">
                                              {plannableCardPacksLoading ? (
                                                <span className="text-center text-sm text-gray-500">…</span>
                                              ) : pack ? (
                                                <>
                                                  <div className="mb-1 aspect-[1/2] w-full max-w-[3.5rem] shrink-0 overflow-hidden rounded bg-[#1a1a1a] sm:max-w-[4.25rem] md:max-w-none">
                                                    {pack.thumbnail ? (
                                                      <img
                                                        src={RESULT_EGOGIFT_BASE_URL + pack.thumbnail}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                          (e.target as HTMLImageElement).style.display = "none";
                                                        }}
                                                      />
                                                    ) : (
                                                      <div className="flex h-full w-full items-center justify-center px-0.5 text-center text-[10px] text-gray-500">
                                                        없음
                                                      </div>
                                                    )}
                                                  </div>
                                                  <p className="mt-0.5 w-full line-clamp-2 text-center text-[10px] leading-snug text-gray-200 sm:text-xs md:text-sm">
                                                    {pack.title}
                                                  </p>
                                                  {!slotDisabled && (
                                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center exclude-from-capture">
                                                      <button
                                                        type="button"
                                                        className="pointer-events-auto rounded-full border border-white/25 bg-black/55 p-1.5 text-white shadow-lg transition-all hover:scale-105 hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 active:scale-95 sm:p-2 exclude-from-capture"
                                                        title="카드팩 정보"
                                                        aria-label={`${pack.title} 카드팩 정보 보기`}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          cardPackDetailOpenRef.current?.open(pack.cardpackId);
                                                        }}
                                                      >
                                                        <svg
                                                          xmlns="http://www.w3.org/2000/svg"
                                                          className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]"
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
                                                <span className="px-1 text-center text-xs leading-snug text-gray-500 sm:text-sm">
                                                  비어 있음
                                                  <br />
                                                  <span className="text-[11px] text-gray-600 sm:text-xs">탭하여 선택</span>
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}
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
                                        <h4 id="v2-floor-modal-title" className="text-lg font-semibold text-yellow-300">
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
                              <div className="mb-2 flex w-full min-w-0 flex-wrap items-center gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                  <h4 className="text-lg font-semibold text-yellow-300">놓친 한정 에고기프트 출현 카드팩</h4>
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
                                  className="ml-auto shrink-0 rounded p-1 text-yellow-200/80 transition-colors hover:bg-white/10 hover:text-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
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
                            </>
                            )}
                          </div>
                        )}
                        {selectedFavoriteId !== null && (
                          <div className="mb-4 rounded-lg border border-[#b8860b]/40 bg-[#131316] p-3 md:p-4">
                            <div className="mb-2 flex w-full min-w-0 flex-wrap items-center gap-2 border-b border-[#b8860b]/30 pb-2">
                              <h3 className="min-w-0 flex-1 text-lg font-semibold text-yellow-300">시작·관측 에고기프트</h3>
                              <div className="ml-auto flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => setPinnedEgoSectionsSimplified((v) => !v)}
                                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                                    pinnedEgoSectionsSimplified
                                      ? "text-cyan-300 border-cyan-400/60 bg-cyan-500/20 hover:bg-cyan-500/30"
                                      : "text-gray-300 border-gray-400/40 hover:bg-white/10"
                                  }`}
                                  aria-pressed={pinnedEgoSectionsSimplified}
                                  title={pinnedEgoSectionsSimplified ? "상세 보기로 원복" : "이름·키워드·합성 여부만 표시 (결과 탭 간소화와 동일)"}
                                >
                                  {pinnedEgoSectionsSimplified ? "상세 보기" : "간소화"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPinnedEgoSectionsExpanded((v) => !v)}
                                  className="shrink-0 rounded p-1 text-yellow-200/80 transition-colors hover:bg-white/10 hover:text-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
                                  aria-expanded={pinnedEgoSectionsExpanded}
                                  title={pinnedEgoSectionsExpanded ? "접기" : "펼치기"}
                                  aria-label={pinnedEgoSectionsExpanded ? "접기" : "펼치기"}
                                >
                                  <span
                                    className={`inline-block transition-transform duration-200 ${pinnedEgoSectionsExpanded ? "rotate-90" : ""}`}
                                    aria-hidden
                                  >
                                    ▶
                                  </span>
                                </button>
                              </div>
                            </div>
                            {pinnedEgoSectionsExpanded && (
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-2 lg:gap-3">
                                <ObservedEgoGiftsSection
                                  className="mb-0"
                                  compact={pinnedEgoSectionsSimplified}
                                  catalog={observableEgoGiftCatalog}
                                  catalogLoading={observableEgoGiftCatalogLoading}
                                  selectedIds={startEgoGiftIds}
                                  onChange={setStartEgoGiftIds}
                                  imageBaseUrl={RESULT_EGOGIFT_BASE_URL}
                                  onOpenEgoGiftByName={(name) => egoGiftPreviewOpenRef.current?.(name)}
                                  sectionTitle="시작 에고기프트"
                                  addLabel="시작 에고기프트 추가"
                                  searchInputId="start-egogift-search"
                                  fixedKeywordOptions={[...START_EGOGIFT_KEYWORD_ORDER]}
                                  hideAllKeywordOption
                                  hideSearchInput
                                  allowedIdsByKeyword={{
                                    화상: [7, 12, 15],
                                    출혈: [29, 45, 46],
                                    진동: [75, 76, 77],
                                    파열: [113, 114, 116],
                                    침잠: [148, 151, 152],
                                    호흡: [178, 180, 181],
                                    충전: [208, 209, 211],
                                    참격: [240, 241, 242],
                                    관통: [260, 261, 262],
                                    타격: [273, 275, 276],
                                  }}
                                />
                                <ObservedEgoGiftsSection
                                  className="mb-0"
                                  compact={pinnedEgoSectionsSimplified}
                                  catalog={observableEgoGiftCatalog}
                                  catalogLoading={observableEgoGiftCatalogLoading}
                                  selectedIds={observedEgoGiftIds}
                                  onChange={setObservedEgoGiftIds}
                                  imageBaseUrl={RESULT_EGOGIFT_BASE_URL}
                                  onOpenEgoGiftByName={(name) => egoGiftPreviewOpenRef.current?.(name)}
                                />
                              </div>
                            )}
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
                        <div ref={reportEgoGiftPickSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-5">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <h3 className="text-lg font-semibold text-yellow-300">보고서 내 에고기프트 선택</h3>
                            <ReportHelpTrigger sectionId="egoPick" onOpen={setReportSectionHelpId} />
                          </div>
                          <p className="text-xs text-gray-500 mb-3">
                            별(즐겨찾기)로 이 보고서에 포함할 에고기프트를 고릅니다. 선택 시 보고서에 반영됩니다.
                          </p>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm text-gray-300">
                              선택됨{" "}
                              <span className="text-amber-300 tabular-nums font-medium">{starredEgoGiftIds.length}</span>개
                            </span>
                            <button
                              type="button"
                              onClick={() => setReportEgoGiftSelectModalOpen(true)}
                              className="px-4 py-2 rounded bg-yellow-400/90 text-black text-sm font-semibold hover:bg-yellow-300 transition-colors"
                            >
                              에고기프트 검색·선택
                            </button>
                          </div>
                          <ReportEgoGiftKeywordChainTable />
                        </div>
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6">
                          <p className="text-gray-400">저장된 에고기프트가 없습니다. 위의 에고기프트 검색·선택에서 별을 눌러 추가해보세요.</p>
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
                          <div className="flex min-w-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={captureStarredCardPacksSectionAsImage}
                              className="cursor-pointer text-left text-lg font-semibold text-yellow-300 hover:text-yellow-100 hover:underline focus:outline-none focus:underline"
                              title="클릭 시 선택한 카드팩 목록 영역 전체를 이미지로 저장"
                            >
                              선택한 카드팩 목록
                            </button>
                            <ReportHelpTrigger sectionId="cardpackStarred" onOpen={setReportSectionHelpId} />
                          </div>
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
                            <div className="mb-2 flex w-full min-w-0 flex-wrap items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <h4 className="text-lg font-semibold text-yellow-300">놓친 한정 에고기프트 출현 카드팩</h4>
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
                                className="ml-auto shrink-0 rounded p-1 text-yellow-200/80 transition-colors hover:bg-white/10 hover:text-yellow-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/40"
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
                      <div ref={reportEgoGiftPickSectionRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-5 mb-4">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <h3 className="text-lg font-semibold text-yellow-300">보고서 내 에고기프트 선택</h3>
                          <ReportHelpTrigger sectionId="egoPick" onOpen={setReportSectionHelpId} />
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          별(즐겨찾기)로 이 보고서에 포함할 에고기프트를 고릅니다. 선택 시 보고서에 반영됩니다.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm text-gray-300">
                            선택됨{" "}
                            <span className="text-amber-300 tabular-nums font-medium">{starredEgoGiftIds.length}</span>개
                          </span>
                          <button
                            type="button"
                            onClick={() => setReportEgoGiftSelectModalOpen(true)}
                            className="px-4 py-2 rounded bg-yellow-400/90 text-black text-sm font-semibold hover:bg-yellow-300 transition-colors"
                          >
                            에고기프트 검색·선택
                          </button>
                        </div>
                        <ReportEgoGiftKeywordChainTable />
                      </div>
                      {starredEgoGiftIds.length === 0 && (
                        <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 md:p-6 mb-4">
                          <p className="text-gray-400">저장된 에고기프트가 없습니다. 위의 에고기프트 검색·선택에서 별을 눌러 추가해보세요.</p>
                        </div>
                      )}
                      {starredEgoGiftIds.length > 0 && (
                      <div ref={allResultRef} className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-4 md:p-6">
                        <div className="border-b border-[#b8860b]/40 pb-4 mb-4">
                          <div className="flex flex-wrap items-center gap-2 justify-between mb-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <h2 className="text-lg font-semibold text-yellow-300">에고기프트</h2>
                            <ReportHelpTrigger sectionId="egoList" onOpen={setReportSectionHelpId} />
                          </div>
                          <div className="exclude-from-capture flex flex-wrap items-center gap-1">
                          <label htmlFor="favorites-result-ego-view-mode" className="sr-only">
                            에고기프트 목록 표시 방식
                          </label>
                          <select
                            id="favorites-result-ego-view-mode"
                            value={resultEgoGiftViewMode}
                            onChange={(e) => {
                              const v = e.target.value as ResultEgoGiftViewMode;
                              if (v === "keyword" || v === "flat" || v === "floor") setResultEgoGiftViewMode(v);
                            }}
                            className="min-w-[10.5rem] shrink-0 cursor-pointer rounded border border-gray-400/45 bg-[#1a1a1d] px-2 py-1.5 text-sm text-gray-200 outline-none transition-colors hover:border-amber-400/45 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/35"
                            title="키워드별 · 한 그리드 모아보기 · 층별 한정 요약 중 선택"
                          >
                            <option value="keyword">키워드별 보기</option>
                            <option value="flat">모아보기</option>
                            <option value="floor">층별 보기</option>
                          </select>
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
                            onClick={() => setCheckedEgoGiftIds([])}
                            className="shrink-0 px-2 py-1.5 text-sm rounded border border-cyan-400 bg-cyan-400/25 text-cyan-200 hover:bg-cyan-400/35 hover:text-cyan-100 transition-colors flex items-center gap-1 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                            title="획득 표시한 에고기프트 전체 해제"
                          >
                            전체 획득 해제
                          </button>
                          </div>
                          </div>
                          {resultEgoGiftViewMode === "flat" || resultEgoGiftViewMode === "floor" ? (
                            <div className="exclude-from-capture flex min-h-[2.25rem] w-full flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
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
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {resultEgoGiftViewMode === "floor" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const keys = floorViewSynthesisSectionKeys;
                                      if (floorViewSynthesisAllExpanded) {
                                        setSynthesisExpandedByKeyword((prev) => ({
                                          ...prev,
                                          ...keys.reduce<Record<string, boolean>>((acc, k) => ({ ...acc, [k]: false }), {}),
                                        }));
                                      } else {
                                        setSynthesisExpandedByKeyword((prev) => {
                                          const next = { ...prev };
                                          for (const k of keys) delete next[k];
                                          return next;
                                        });
                                      }
                                    }}
                                    className="shrink-0 px-2 py-1.5 text-sm rounded text-purple-300 border border-purple-400/40 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                                    title={
                                      floorViewSynthesisAllExpanded
                                        ? "층별 조합식·하단 모아보기 조합식 모두 접기"
                                        : "층별 조합식·하단 모아보기 조합식 모두 펼치기"
                                    }
                                  >
                                    {floorViewSynthesisAllExpanded ? (
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
                                )}
                                <button
                                  type="button"
                                  onClick={() => setFlatSortByKeyword((v) => !v)}
                                  className={`shrink-0 px-3 py-1.5 text-sm rounded border transition-colors ${
                                    flatSortByKeyword
                                      ? "text-amber-200 border-amber-400/60 bg-amber-500/15 hover:bg-amber-500/25"
                                      : "text-gray-300 border-gray-400/40 hover:bg-white/10"
                                  }`}
                                  title={
                                    flatSortByKeyword
                                      ? "즐겨찾기에 넣은 순서로 표시합니다."
                                      : "키워드 묶음 순서(화상→…→기타)로 표시합니다."
                                  }
                                >
                                  키워드별 정렬
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFlatTierSort((s) => (s === "off" ? "desc" : s === "desc" ? "asc" : "off"))
                                  }
                                  className={`shrink-0 px-3 py-1.5 text-sm rounded border transition-colors ${
                                    flatTierSort !== "off"
                                      ? "text-violet-200 border-violet-400/55 bg-violet-500/15 hover:bg-violet-500/25"
                                      : "text-gray-300 border-gray-400/40 hover:bg-white/10"
                                  }`}
                                  title={
                                    flatTierSort === "off"
                                      ? "첫 클릭: 등급 높은 순(↓), 두 번째: 낮은 순(↑), 세 번째: 해제"
                                      : flatTierSort === "desc"
                                        ? "등급 내림차순 적용 중. 클릭하면 오름차순."
                                        : "등급 오름차순 적용 중. 클릭하면 해제."
                                  }
                                >
                                  {flatTierSort === "off"
                                    ? "등급별 정렬"
                                    : flatTierSort === "desc"
                                      ? "등급별 (↓)"
                                      : "등급별 (↑)"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="exclude-from-capture flex min-h-[2.25rem] w-full flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
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
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
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
                              </div>
                            </div>
                          )}
                        </div>
                        {resultEgoGiftViewMode === "keyword"
                          ? resultEgoGiftsByKeyword.map(({ keyword, egogifts }, keywordIndex) => (
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
                                sectionRef={(el) => {
                                  keywordSectionRefs.current[keyword] = el;
                                }}
                                synthesisRef={(el) => {
                                  synthesisSectionRefs.current[keyword] = el;
                                }}
                                onCaptureSection={captureSectionAsImage}
                                egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                              />
                            ))
                          : resultEgoGiftsFlatDisplay.length > 0 || showFloorLimitedEgoSection ? (
                              <>
                                {showFloorLimitedEgoSection && (
                                    <>
                                        {floorLimitedRowsLoading ? (
                                          <p className="exclude-from-capture mb-6 text-sm text-gray-400">조회 중…</p>
                                        ) : (
                                          /* 층별 한정 본문은 전체 캡처에 포함(부모에 keyword-capture-hex 시 숨기면 화면이 모아보기만 남은 것처럼 보임) */
                                          <div className="mb-6 space-y-4">
                                            {floorLimitedRowsForDisplay.map((row) =>
                                              row.limitedEgoGifts.length === 0 ? (
                                                <div
                                                  key={`floor-lim-${row.floor}-${row.cardpackId}`}
                                                  ref={(el) => {
                                                    if (row.floor === 1) floorRangeSectionRefs.current["1-5"] = el;
                                                    if (row.floor === 6) floorRangeSectionRefs.current["6-10"] = el;
                                                    if (row.floor === 11) floorRangeSectionRefs.current["11-15"] = el;
                                                  }}
                                                  className="rounded-lg border border-[#b8860b]/40 bg-[#131316]/90 px-3 py-3 md:px-4 md:py-3.5"
                                                >
                                                  <div className="mb-2 text-sm font-bold tabular-nums text-amber-300/95">{row.floor}층</div>
                                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    카드팩 및 에고기프트
                                                  </div>
                                                  <p
                                                    data-floor-empty-notice
                                                    className="text-sm leading-relaxed text-gray-400 break-words [overflow-wrap:anywhere]"
                                                    title={`${row.floor}층 · ${row.title} — 선택한 카드팩으로 획득할 한정 에고기프트가 없습니다.`}
                                                  >
                                                    <span className="text-gray-300">{row.title}</span>
                                                    <span className="text-gray-500"> — </span>
                                                    선택한 카드팩으로 획득할 한정 에고기프트가 없습니다.
                                                  </p>
                                                </div>
                                              ) : (
                                                <div
                                                  key={`floor-lim-${row.floor}-${row.cardpackId}`}
                                                  ref={(el) => {
                                                    if (row.floor === 1) floorRangeSectionRefs.current["1-5"] = el;
                                                    if (row.floor === 6) floorRangeSectionRefs.current["6-10"] = el;
                                                    if (row.floor === 11) floorRangeSectionRefs.current["11-15"] = el;
                                                  }}
                                                  className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#b8860b]/40 bg-[#131316]/90 p-3 md:p-4"
                                                >
                                                  <div className="mb-2 text-sm font-bold tabular-nums text-amber-300/95">{row.floor}층</div>
                                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    카드팩 및 에고기프트
                                                  </div>
                                                  <div className="flex min-h-[11rem] flex-col items-stretch gap-4 sm:flex-row">
                                                    <div className="mx-auto flex w-full max-w-[10rem] shrink-0 flex-col self-stretch sm:mx-0 sm:w-[9.5rem] sm:max-w-none">
                                                      <button
                                                        type="button"
                                                        onClick={() => cardPackDetailOpenRef.current?.open(row.cardpackId)}
                                                        className="flex h-full min-h-0 flex-1 flex-col gap-2 rounded-lg border border-[#b8860b]/35 bg-[#1a1a1d]/90 p-2 text-left transition-colors hover:border-amber-400/50"
                                                        title="카드팩 상세"
                                                      >
                                                        <div className="relative min-h-[9rem] w-full flex-1 basis-0 overflow-hidden rounded bg-[#0d0d10]">
                                                          {row.thumbnail ? (
                                                            <img
                                                              src={RESULT_EGOGIFT_BASE_URL + row.thumbnail}
                                                              alt={row.title}
                                                              className="absolute inset-0 h-full w-full object-cover"
                                                              onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = "none";
                                                              }}
                                                            />
                                                          ) : (
                                                            <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] text-gray-600">
                                                              이미지 없음
                                                            </span>
                                                          )}
                                                        </div>
                                                        <p className="w-full shrink-0 break-words text-center text-xs font-medium leading-snug text-gray-200 sm:text-left">
                                                          {row.title}
                                                        </p>
                                                      </button>
                                                    </div>
                                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch">
                                                      <ResultKeywordSection
                                                        keyword={`__floor_lim_${row.floor}__`}
                                                        variant="flat"
                                                        omitSynthesis
                                                        fillParentHeight
                                                        egogifts={row.limitedEgoGifts}
                                                        keywordIndex={0}
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
                                                        sectionRef={() => {}}
                                                        synthesisRef={() => {}}
                                                        onCaptureSection={captureSectionAsImage}
                                                        egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                      />
                                                    </div>
                                                  </div>
                                                  {filterSynthesisRecipesForEgoIds(
                                                    synthesisRecipes,
                                                    row.limitedEgoGifts.map((e) => e.egogiftId),
                                                  ).length > 0 ? (
                                                    <div className="mt-4 min-w-0 max-w-full border-t border-[#b8860b]/30 pt-3">
                                                      <div className="mb-2 text-xs font-semibold text-purple-300/95">조합식</div>
                                                      <SynthesisRecipesSubsetBlock
                                                        sectionKey={`__floor_lim_syn_${row.floor}__`}
                                                        relevantEgoIds={row.limitedEgoGifts.map((e) => e.egogiftId)}
                                                        synthesisRecipes={synthesisRecipes}
                                                        resultEgoGifts={resultEgoGifts}
                                                        resultSimplified={resultSimplified}
                                                        synthesisExpandedByKeyword={synthesisExpandedByKeyword}
                                                        setSynthesisExpandedByKeyword={setSynthesisExpandedByKeyword}
                                                        onCaptureSection={captureSectionAsImage}
                                                        synthesisRef={(el) => {
                                                          synthesisSectionRefs.current[`__floor_lim_syn_${row.floor}__`] = el;
                                                        }}
                                                        egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                                        showHeaderRow={false}
                                                        layout="floor"
                                                      />
                                                    </div>
                                                  ) : null}
                                                </div>
                                              )
                                            )}
                                          </div>
                                        )}
                                    </>
                                  )}
                                {resultEgoGiftsFlatDisplayExcludingFloorLimited.length > 0 && (
                                <ResultKeywordSection
                                  key={RESULT_EGO_FLAT_SECTION_KEY}
                                  keyword={RESULT_EGO_FLAT_SECTION_KEY}
                                  variant="flat"
                                  egogifts={resultEgoGiftsFlatDisplayExcludingFloorLimited}
                                  keywordIndex={0}
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
                                  sectionRef={(el) => {
                                    keywordSectionRefs.current[RESULT_EGO_FLAT_SECTION_KEY] = el;
                                  }}
                                  synthesisRef={(el) => {
                                    synthesisSectionRefs.current[RESULT_EGO_FLAT_SECTION_KEY] = el;
                                  }}
                                  onCaptureSection={captureSectionAsImage}
                                  egoGiftPreviewOpenRef={egoGiftPreviewOpenRef}
                                />
                                )}
                              </>
                            ) : null}
                      </div>
                      )}
                      </>
                    )}
                      </>
                    )}
                  </div>
                )}
                {selectedFavoriteId !== null && (
                  <div
                    className="pointer-events-none fixed bottom-5 z-[215] w-10"
                    style={
                      floatingNavLeftPx != null
                        ? { left: floatingNavLeftPx }
                        : { right: "1.25rem" }
                    }
                  >
                    <div ref={resultFloatingNavRef} className="pointer-events-auto relative w-10">
                    {resultFloatingNavOpen && (
                      <div className="absolute right-full top-0 z-10 mr-2 w-[min(18rem,calc(100vw-2.5rem))] max-h-[min(60vh,30rem)] overflow-y-auto rounded-xl border border-[#b8860b]/45 bg-[#131316]/88 p-2 shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
                        <div className="space-y-1">
                          {activeTab === "result" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => scrollToSection(reportIdentitySectionRef.current)}
                                className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-yellow-300 hover:bg-amber-500/20"
                              >
                                인격 선택 영역
                              </button>
                              {selectedReportSchemaVersion === 2 ? (
                                <button
                                  type="button"
                                  onClick={() => scrollToSection(v2PlannedCardPacksSectionRef.current)}
                                  className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-yellow-300 hover:bg-amber-500/20"
                                >
                                  진행(예정) 카드팩 영역
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => scrollToSection(starredCardPacksSectionRef.current)}
                                  className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-yellow-300 hover:bg-amber-500/20"
                                >
                                  선택 카드팩 영역
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  scrollToSection(allResultRef.current);
                                  setResultFloatingNavEgoDepthOpen((v) => !v);
                                }}
                                className="flex w-full items-center justify-between rounded-md border border-[#b8860b]/35 bg-[#1a1a1d]/95 px-3 py-2 text-left text-sm font-semibold text-yellow-300 hover:bg-amber-500/20"
                              >
                                <span>에고기프트 영역</span>
                                <span aria-hidden>{resultFloatingNavEgoDepthOpen ? "▲" : "▼"}</span>
                              </button>
                              {resultFloatingNavEgoDepthOpen && (
                                <div className="ml-2 mt-1 space-y-1 border-l border-[#b8860b]/35 pl-2">
                                  {resultEgoGiftViewMode === "keyword" && resultEgoGiftsByKeyword.length > 0 ? (
                                    resultEgoGiftsByKeyword.map(({ keyword }) => (
                                      <button
                                        key={`floating-nav-kw-${keyword}`}
                                        type="button"
                                        onClick={() => scrollToSection(keywordSectionRefs.current[keyword])}
                                        className="w-full rounded-md border border-[#b8860b]/25 bg-[#17171a]/90 px-2.5 py-1.5 text-left text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                                      >
                                        키워드: {keyword}
                                      </button>
                                    ))
                                  ) : resultEgoGiftViewMode === "floor" ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => scrollToSection(floorRangeSectionRefs.current["1-5"])}
                                        className="w-full rounded-md border border-[#b8860b]/25 bg-[#17171a]/90 px-2.5 py-1.5 text-left text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                                      >
                                        1~5층
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => scrollToSection(floorRangeSectionRefs.current["6-10"])}
                                        className="w-full rounded-md border border-[#b8860b]/25 bg-[#17171a]/90 px-2.5 py-1.5 text-left text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                                      >
                                        6~10층
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => scrollToSection(floorRangeSectionRefs.current["11-15"])}
                                        className="w-full rounded-md border border-[#b8860b]/25 bg-[#17171a]/90 px-2.5 py-1.5 text-left text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                                      >
                                        11~15층
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => scrollToSection(keywordSectionRefs.current[RESULT_EGO_FLAT_SECTION_KEY])}
                                      className="w-full rounded-md border border-[#b8860b]/25 bg-[#17171a]/90 px-2.5 py-1.5 text-left text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                                    >
                                      모아보기 영역
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {shareBoardMode === "list" && (
                                <button
                                  type="button"
                                  onClick={() => scrollToSection(shareBoardListSectionRef.current)}
                                  className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                                >
                                  공유게시판 목록
                                </button>
                              )}
                              {shareBoardMode === "new" && (
                                <button
                                  type="button"
                                  onClick={() => scrollToSection(shareBoardNewSectionRef.current)}
                                  className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                                >
                                  공유게시판 등록
                                </button>
                              )}
                              {shareBoardMode === "detail" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSection(shareBoardDetailPostInfoSectionRef.current)}
                                    className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                                  >
                                    게시글 정보
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSection(shareBoardDetailPreviewSectionRef.current)}
                                    className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                                  >
                                    보고서 미리보기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => scrollToSection(shareBoardDetailCommentsSectionRef.current)}
                                    className="w-full rounded-md border border-[#b8860b]/30 bg-[#1a1a1d]/90 px-3 py-2 text-left text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                                  >
                                    댓글
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={scrollToPageTop}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                      aria-label="최상단 이동"
                      title="최상단 이동"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 11 6-6 6 6" />
                      </svg>
                    </button>
                    {activeTab === "result" && (
                      <>
                        <button
                          type="button"
                          onClick={() => scrollToSection(reportIdentitySectionRef.current)}
                          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-sm font-bold text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                          aria-label="인격 선택 영역으로 이동"
                          title="인격"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            scrollToSection(
                              selectedReportSchemaVersion === 2
                                ? v2PlannedCardPacksSectionRef.current
                                : starredCardPacksSectionRef.current
                            )
                          }
                          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-sm font-bold text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                          aria-label="카드팩 영역으로 이동"
                          title="카드팩"
                        >
                          C
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection(reportEgoGiftPickSectionRef.current)}
                          className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-sm font-bold text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                          aria-label="보고서 내 에고기프트 선택으로 이동"
                          title="에고기프트"
                        >
                          E
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setResultFloatingNavOpen((prev) => {
                          const next = !prev;
                          setResultFloatingNavEgoDepthOpen(next && activeTab === "result");
                          return next;
                        })
                      }
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                      aria-label="영역 이동 메뉴 열기"
                      title="영역 이동 메뉴"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" d="M5 7h14" />
                        <path strokeLinecap="round" d="M5 12h14" />
                        <path strokeLinecap="round" d="M5 17h14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={scrollToPageBottom}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8860b]/55 bg-[#131316]/78 text-amber-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-amber-500/20"
                      aria-label="최하단 이동"
                      title="최하단 이동"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m18 13-6 6-6-6" />
                      </svg>
                    </button>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 에고기프트/카드팩 상세 모달 오픈 ref를 항상 유지하기 위해 백그라운드 상시 마운트 (에고기프트 선택 모달이 열린 동안은 모달 쪽 인스턴스만 마운트) */}
          <div className="pointer-events-none absolute -left-[99999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
            {!reportEgoGiftSelectModalOpen && (
            <EgoGiftPageContent
              slotAboveSearch={null}
              embedded
              starredEgoGiftIds={starredEgoGiftIds}
              onStarClick={handleStarToggle}
              openEgoGiftPreviewRef={egoGiftPreviewOpenRef}
              enableSynthesisMaterialsPrefetch
            />
            )}
            <CardPackPageContent
              slotAboveSearch={null}
              embedded
              starredCardPackIds={starredCardPackIds}
              onStarClick={handleCardPackStarToggle}
              openCardPackDetailRef={cardPackDetailOpenRef}
            />
          </div>
          {reportEgoGiftSelectModalOpen && typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-egogift-modal-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-black/70 cursor-default"
                  aria-label="모달 닫기"
                  onClick={() => setReportEgoGiftSelectModalOpen(false)}
                />
                <div className="relative z-10 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#b8860b]/50 bg-[#0d0d0f] shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#b8860b]/35 bg-[#131316] px-4 py-3">
                    <h2 id="report-egogift-modal-title" className="text-lg font-semibold text-yellow-300">
                      보고서 내 에고기프트 선택
                    </h2>
                    <button
                      type="button"
                      onClick={() => setReportEgoGiftSelectModalOpen(false)}
                      className="shrink-0 rounded border border-[#b8860b]/40 px-3 py-1.5 text-sm text-gray-200 hover:bg-[#2a2a2d] hover:text-yellow-200 transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
                    <EgoGiftPageContent
                      embedded
                      embeddedModalLayout
                      starredEgoGiftIds={starredEgoGiftIds}
                      onStarClick={handleStarToggle}
                      openEgoGiftPreviewRef={egoGiftPreviewOpenRef}
                      enableSynthesisMaterialsPrefetch
                    />
                  </div>
                </div>
              </div>,
              document.body
            )}
          <ReportSectionHelpModal sectionId={reportSectionHelpId} onClose={() => setReportSectionHelpId(null)} />
        </div>
      </div>
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <Suspense fallback={null}>
      <FavoritesPageClient />
    </Suspense>
  );
}

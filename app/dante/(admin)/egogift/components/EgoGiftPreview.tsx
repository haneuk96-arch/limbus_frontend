"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Montserrat } from "next/font/google";
import KeywordHighlight from "@/components/KeywordHighlight";
import type { CardPackHighlightEgoGift } from "@/components/CardPackDetailModal";
import { KeywordData } from "@/lib/keywordParser";
import { API_BASE_URL } from "@/lib/api";
import { normalizeCurseBlessCd } from "@/lib/egogiftCurseBless";
import { formatEgoGiftTierDisplay } from "@/lib/egoGiftTierDisplay";

const CardPackDetailModal = dynamic(() => import("@/components/CardPackDetailModal"), { ssr: false });

const montserrat = Montserrat({ 
  subsets: ["latin"], 
  weight: ["700", "900"],
  display: "swap"
});

interface Keyword {
  keywordId: number;
  keywordName: string;
  categoryId?: number;
  categoryName?: string;
}

interface Hashtag {
  tagId: number;
  tagName: string;
  tagCategoryCd?: string;
}

interface FileInfo {
  fileId: number;
  path: string;
  originalName: string;
  storedName: string;
}

interface RecipeItem {
  mapId: number;
  egogiftId: number;
  egogiftName: string;
  sortOrder: number;
  type: string;
  thumbnail?: string;
  grades?: string[]; // 출현난이도: 'N', 'H', 'E'
}

interface Recipe {
  recipeId: number;
  title: string;
  items: RecipeItem[];
}

interface ObtainableEvent {
  eventId: number;
  eventTitle: string;
  nodeId: number;
  nodeTitle: string;
  parentNodeTitle?: string | null;  // 부모노드 제목 (없으면 null)
  eventType: number;  // 0: 일반, 1: 전투
}

interface EgoGiftPreviewProps {
  giftName: string;
  giftTier: string;
  keywordId: string;
  attrKeywordId?: number | null; // 속성 키워드 ID (category_id = 9)
  cost: string;
  enhanceYn: string;
  synthesisYn?: string;  // 합성전용 여부
  /** 저주/축복: CURSE | BLESS | null(미선택) */
  curseBlessCd?: string | null;
  grades?: string[]; // 출현난이도: 'N', 'H', 'E'
  desc1: string;
  desc2: string;
  desc3: string;
  selectedTagIds: number[];
  file: File | null;
  existingFile?: FileInfo | null; // 기존 이미지 파일 정보
  keywords: Keyword[];
  hashtags: Hashtag[];
  allKeywords?: KeywordData[]; // 하이라이팅용 전체 키워드
  /** 카드팩 상세 모달 내 이벤트/스크립트 하이라이트용 (없으면 빈 배열) */
  allEgoGiftsForHighlight?: CardPackHighlightEgoGift[];
  egogiftId?: number; // 수정 버튼을 위한 ID
  recipes?: Recipe[] | null; // 조합식 데이터 (모든 조합식)
  obtainableEvents?: ObtainableEvent[]; // 획득 가능 이벤트 목록
  limitedCategoryName?: string | null; // 한정 카테고리명 (레거시 호환용)
  cardPackAppearances?: Array<{ // 출현하는 모든 카드팩 목록
    cardpackId?: number | null;
    cardpackTitle?: string | null;
    categoryName?: string | null;
    thumbnailPath?: string | null;
  }>;
  onClose: () => void;
  onEdit?: (id: number) => void; // 수정 버튼 클릭 핸들러
  onEgoGiftClick?: (giftName: string) => void; // 조합식의 에고기프트 클릭 핸들러
  /** 카드팩 모달에서 에고 클릭 시 (있으면 API 한 번으로 열기; 없으면 onEgoGiftClick으로 이름 조회 시도) */
  onEgoGiftClickById?: (egogiftId: number) => void;
}

export default function EgoGiftPreview({
  giftName,
  giftTier,
  keywordId,
  attrKeywordId,
  cost,
  enhanceYn,
  synthesisYn,
  curseBlessCd = null,
  grades = [],
  desc1,
  desc2,
  desc3,
  selectedTagIds,
  file,
  existingFile,
  keywords,
  hashtags,
  allKeywords = [],
  allEgoGiftsForHighlight = [],
  egogiftId,
  recipes,
  obtainableEvents = [],
  limitedCategoryName,
  cardPackAppearances = [],
  onClose,
  onEdit,
  onEgoGiftClick,
  onEgoGiftClickById,
}: EgoGiftPreviewProps) {
  const resolvedCurseBless = normalizeCurseBlessCd(curseBlessCd);
  /** 한정 카드팩 영역: 기본 접힘 */
  const [limitedCardPackOpen, setLimitedCardPackOpen] = useState(false);
  const [cardPackModalId, setCardPackModalId] = useState<number | null>(null);
  const cardPackModalOpenRef = useRef(false);
  cardPackModalOpenRef.current = cardPackModalId != null;

  const hasLimitedCardPackInfo =
    Boolean(cardPackAppearances && cardPackAppearances.length > 0) || Boolean(limitedCategoryName);

  /** 에고기프트 제목 아래 한 줄: 출현 카드팩의 카테고리 한정, 없으면 레거시 카드팩 한정 */
  const limitedCategoryUnderTitleLines = useMemo(() => {
    const lines: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const a of cardPackAppearances) {
      const c = a.categoryName?.trim();
      if (c && !seen.has(c)) {
        seen.add(c);
        lines.push({ key: `cp-cat-${c}`, label: `"${c}" 카테고리 한정` });
      }
    }
    if (lines.length === 0 && limitedCategoryName?.trim()) {
      lines.push({
        key: "legacy-limited",
        label: `"${limitedCategoryName.trim()}" 카드팩 한정`,
      });
    }
    return lines;
  }, [cardPackAppearances, limitedCategoryName]);

  const handleEgoGiftFromCardPackModal = (id: number) => {
    setCardPackModalId(null);
    if (onEgoGiftClickById) {
      onEgoGiftClickById(id);
      return;
    }
    if (!onEgoGiftClick) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/egogift/${id}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const name = data?.egogift?.giftName as string | undefined;
        if (name) onEgoGiftClick(name);
      } catch {
        // ignore
      }
    })();
  };

  // ESC 키로 모달 닫기 (한정 카드팩 상세가 열려 있으면 CardPackDetailModal이 먼저 닫힘)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cardPackModalOpenRef.current) return;
      onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // 키워드 아이콘 매핑
  const iconMap: Record<string, string> = {
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

  const selectedKeyword = keywords.find((k) => String(k.keywordId) === keywordId);
  const keywordName = selectedKeyword?.keywordName || "";
  const keywordIcon = keywordName ? iconMap[keywordName] : null;
  const keywordIdTrimmed = keywordId.trim();
  const showKeywordUi = keywordIdTrimmed !== "" && keywordIdTrimmed !== "0";

  // 속성 키워드 찾기 (attrKeywordId로)
  const attrKeyword = allKeywords.find((k) => k.keywordId === attrKeywordId);
  const attrKeywordName = attrKeyword?.keywordName || "";

  // 속성별 배경색 매핑 (채도 높은 원색)
  const attrBgColorMap: Record<string, string> = {
    분노: "bg-red-700/50",
    색욕: "bg-orange-600/50",
    나태: "bg-yellow-500/50",
    탐식: "bg-green-600/50",
    우울: "bg-cyan-500/50",
    오만: "bg-blue-600/50",
    질투: "bg-purple-600/50",
  };

  // 배경색 결정
  const bgColorClass = attrKeywordName && attrBgColorMap[attrKeywordName] 
    ? attrBgColorMap[attrKeywordName] 
    : "bg-[#0f0f0f]"; // 기본 배경색

  const displayGrade = formatEgoGiftTierDisplay(giftTier);
  const isEX = String(giftTier ?? "").trim().toUpperCase() === "EX";

  const filteredHashtagTags = hashtags.filter((tag) => selectedTagIds.includes(tag.tagId));
  const hashtagChipClass =
    "px-2 py-1 text-xs rounded-full bg-[#222]/80 border border-[#b8860b]/40 text-[#f0e68c] whitespace-nowrap";
  const hashtagList = filteredHashtagTags.map((tag) => (
    <span key={tag.tagId} className={hashtagChipClass}>
      #{tag.tagName}
    </span>
  ));
  
  // 조합식 데이터는 각 조합식마다 개별적으로 처리

  const baseUrl = API_BASE_URL.replace("/api", "");

  return (
    <>
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-[9999] overflow-y-auto pt-20 pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-egogift-preview-title"
      onClick={onClose}
    >
      <div className="bg-[#1b1b1b] border border-[#b8860b]/40 rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[calc(100vh-6rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`sticky top-0 ${bgColorClass} border-b border-[#b8860b]/40 rounded-t-lg px-5 py-4 z-50 flex justify-between items-center backdrop-blur-sm`}>
          <div className="flex items-center gap-3 flex-1">
            <span id="admin-egogift-preview-title" className="text-gray-200 text-xl font-semibold">에고기프트 상세보기</span>
          </div>
          <div className="flex items-center gap-2">
            {egogiftId && onEdit && (
              <button
                onClick={() => onEdit(egogiftId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-sm"
              >
                수정
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none font-bold"
              title="닫기"
            >
              ×
            </button>
          </div>
        </div>
        <div className="p-5">

        {/* 상단 정보 영역: table로 영역별 독립 배치 */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              {/* 이미지 영역 */}
              <td className="align-top w-0 whitespace-nowrap pr-4 pb-4 md:pb-0">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <img
                    src="/images/egogift/egogift_frame.webp"
                    alt="frame"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                  />
                  <div
                    className={`absolute top-1 -left-3 z-20 text-[#ffcc33] scale-x-[0.65] text-5xl drop-shadow-[0_0_5px_rgba(0,0,0,0.9)] select-none tracking-tight leading-none ${isEX ? "font-bold" : `font-black ${montserrat.className}`}`}
                    style={{ fontFamily: montserrat.style.fontFamily }}
                  >
                    {displayGrade}
                  </div>
                  {showKeywordUi && keywordIcon && (
                    <div className="absolute bottom-[5px] right-[0px] w-9 h-9 z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
                      <img src={keywordIcon} alt={keywordName} className="w-full h-full object-contain" />
                    </div>
                  )}
                  {file ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={giftName || "미리보기"}
                      className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                    />
                  ) : existingFile ? (
                    <img
                      src={`${API_BASE_URL.replace('/api', '')}${existingFile.path}`}
                      alt={existingFile.originalName || "미리보기"}
                      className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded">
                      <span className="text-gray-500 text-xs">이미지 없음</span>
                    </div>
                  )}
                </div>
              </td>
              {/* 이름 및 정보 영역 */}
              <td className="align-top min-w-0 pr-4 pb-4 md:pb-0">
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[#ffcc33] font-black text-2xl scale-x-[0.65] tracking-tight leading-none ${isEX ? "" : montserrat.className}`}
                      style={{ fontFamily: montserrat.style.fontFamily }}
                    >
                      {displayGrade}
                    </span>
                    <h2 className="text-2xl font-bold text-[#d2b48c] drop-shadow-[0_0_6px_rgba(255,200,50,0.4)]">
                      {giftName || "미입력"}
                    </h2>
                  </div>
                  {limitedCategoryUnderTitleLines.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {limitedCategoryUnderTitleLines.map(({ key, label }) => (
                        <p key={key} className="text-sm text-[#ccff00] leading-snug">
                          {label}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-base">
                    {showKeywordUi && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400 font-medium">{keywordName}</span>
                      </div>
                    )}
                    {cost && (
                      <div className="flex items-center gap-1">
                        <img src="/images/keyword/cost.webp" alt="cost" className="w-4 h-4 object-contain" />
                        <span className="text-yellow-400">{cost}</span>
                      </div>
                    )}
                  </div>
                  {/* 강화 → 오른쪽에 출현 난이도 · 합성전용 · 저주/축복 (한 줄 flex) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400 mt-1">
                    <div className="flex items-center gap-1 shrink-0">
                      <span>강화</span>
                      {enhanceYn === "Y" ? (
                        <span className="text-green-400">가능</span>
                      ) : (
                        <span className="text-red-400">불가</span>
                      )}
                    </div>
                    {grades?.includes("N") && (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-900/40 border border-green-500/60 text-green-200">
                        노말
                      </span>
                    )}
                    {grades?.includes("H") && (
                      <span className="px-2 py-0.5 rounded text-xs bg-pink-900/40 border border-pink-500/60 text-pink-200">
                        하드
                      </span>
                    )}
                    {grades?.includes("E") && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-900/40 border border-red-500/60 text-red-200">
                        익스트림
                      </span>
                    )}
                    {synthesisYn === "Y" && (
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-900/40 border border-purple-500/60 text-purple-200">
                        합성전용
                      </span>
                    )}
                    {resolvedCurseBless === "CURSE" && (
                      <span className="px-2 py-0.5 rounded text-xs bg-rose-950/50 border border-rose-500/70 text-rose-100">
                        저주
                      </span>
                    )}
                    {resolvedCurseBless === "BLESS" && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-900/40 border border-amber-400/70 text-amber-100">
                        축복
                      </span>
                    )}
                  </div>
                </div>
              </td>
              {/* 해시태그 영역 — md 이상에서만 표시 (모바일은 효과 섹션 위로 이동) */}
              <td className="hidden md:table-cell align-top min-w-[320px] w-[320px] pl-4 pb-4 md:pb-0 border-l border-[#b8860b]/30">
                {selectedTagIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-end">{hashtagList}</div>
                ) : (
                  <span className="text-transparent select-none">-</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 상세 정보 */}
        <div className="mt-6 border-t border-[#b8860b]/30 pt-4">
          {selectedTagIds.length > 0 && (
            <div className="md:hidden mb-4 flex flex-wrap gap-2">
              {hashtagList}
            </div>
          )}
          <h3 className="font-semibold text-[#ffcc33] mb-2">효과</h3>

              <div className="space-y-4">
                {desc1 && (
                  <div>
                    <p className="font-semibold text-yellow-300 mb-1">기본 효과</p>
                    <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      <KeywordHighlight text={desc1} keywords={allKeywords} />
                    </div>
                  </div>
                )}
                {enhanceYn === "Y" && desc2 && (
                  <div>
                    <p className="font-semibold text-yellow-300 mb-1">+</p>
                    <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      <KeywordHighlight text={desc2} keywords={allKeywords} />
                    </div>
                  </div>
                )}
                {enhanceYn === "Y" && desc3 && (
                  <div>
                    <p className="font-semibold text-yellow-300 mb-1">++</p>
                    <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      <KeywordHighlight text={desc3} keywords={allKeywords} />
                    </div>
                  </div>
                )}

                {!desc1 && !desc2 && !desc3 && (
                  <span className="text-gray-500 text-sm">효과 설명이 없습니다.</span>
                )}
              </div>
        </div>
        
        {/* 조합식 표시 */}
        {recipes && recipes.length > 0 && (
          <div className="mt-6 border-t border-[#b8860b]/30 pt-4">
            <h3 className="font-semibold text-[#ffcc33] mb-3">조합식</h3>
            {recipes.map((recipe, recipeIndex) => {
              const recipeIngredients = recipe.items?.filter(item => item.type === "재료").sort((a, b) => a.sortOrder - b.sortOrder) || [];
              const recipeResult = recipe.items?.find(item => item.type === "결과");
              
              if (recipeIngredients.length === 0 || !recipeResult) {
                return null;
              }
              
              return (
                <div key={recipe.recipeId || recipeIndex} className={recipeIndex > 0 ? "mt-6 pt-6 border-t border-[#b8860b]/20" : ""}>
                  <div className="flex flex-wrap items-start gap-3">
                    {/* 재료들 */}
                    {recipeIngredients.map((ingredient, index) => {
                      const isCurrentGift = ingredient.egogiftId === egogiftId;
                      return (
                        <React.Fragment key={ingredient.mapId}>
                          <div 
                            className={`flex flex-col items-center gap-1 ${!isCurrentGift && onEgoGiftClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            onClick={!isCurrentGift && onEgoGiftClick ? () => onEgoGiftClick(ingredient.egogiftName) : undefined}
                          >
                          <div className="relative w-16 h-16 flex-shrink-0">
                            {/* 프레임 배경 */}
                            <img
                              src="/images/egogift/egogift_frame.webp"
                              alt="frame"
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                            />
                            {/* 썸네일 */}
                            {ingredient.thumbnail ? (
                              <img
                                src={`${API_BASE_URL.replace('/api', '')}${ingredient.thumbnail}`}
                                alt={ingredient.egogiftName}
                                className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded">
                                <span className="text-gray-500 text-xs">이미지 없음</span>
                              </div>
                            )}
                          </div>
                          {/* 재료 정보 */}
                          <div className="text-center">
                            <div className="text-white text-xs font-medium">{ingredient.egogiftName}</div>
                            {ingredient.grades && ingredient.grades.length > 0 && (
                              <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                                {ingredient.grades.includes("N") && (
                                  <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-500/60 text-green-200 text-[10px]">
                                    노말
                                  </span>
                                )}
                                {ingredient.grades.includes("H") && (
                                  <span className="px-1.5 py-0.5 rounded bg-pink-900/40 border border-pink-500/60 text-pink-200 text-[10px]">
                                    하드
                                  </span>
                                )}
                                {ingredient.grades.includes("E") && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-900/40 border border-red-500/60 text-red-200 text-[10px]">
                                    익스트림
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          </div>
                          {index < recipeIngredients.length - 1 && (
                            <span className="text-yellow-400 text-xl font-bold mt-6">+</span>
                          )}
                        </React.Fragment>
                      );
                    }                    )}
                    
                    {/* recipeId가 55일 때 예외 처리: 조각 2종 추가 */}
                    {recipe.recipeId === 55 && (
                      <>
                        <span className="text-yellow-400 text-xl font-bold mt-6">+</span>
                        <div className="flex flex-col items-center gap-1">
                          <div className="relative w-16 h-16 flex-shrink-0">
                            {/* 프레임 배경 */}
                            <img
                              src="/images/egogift/egogift_frame.webp"
                              alt="frame"
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                            />
                            {/* material.webp 이미지 */}
                            <img
                              src="/images/egogift/material.webp"
                              alt="조각 2종"
                              className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          {/* 조각 2종 정보 */}
                          <div className="text-center">
                            <div className="text-white text-xs font-medium">조각 2종</div>
                            <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-500/60 text-green-200 text-[10px]">
                                노말
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* 등호 */}
                    <span className="text-yellow-400 text-xl font-bold mt-6">=</span>
                    
                    {/* 결과 */}
                    {(() => {
                      const isCurrentGift = recipeResult.egogiftId === egogiftId;
                      return (
                        <div 
                          className={`flex flex-col items-center gap-1 ${!isCurrentGift && onEgoGiftClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                          onClick={!isCurrentGift && onEgoGiftClick ? () => onEgoGiftClick(recipeResult.egogiftName) : undefined}
                        >
                          <div className="relative w-16 h-16 flex-shrink-0">
                            {/* 프레임 배경 */}
                            <img
                              src="/images/egogift/egogift_frame.webp"
                              alt="frame"
                              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                            />
                            {/* 썸네일 */}
                            {recipeResult.thumbnail ? (
                              <img
                                src={`${API_BASE_URL.replace('/api', '')}${recipeResult.thumbnail}`}
                                alt={recipeResult.egogiftName}
                                className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded">
                                <span className="text-gray-500 text-xs">이미지 없음</span>
                              </div>
                            )}
                          </div>
                          {/* 결과 정보 */}
                          <div className="text-center">
                            <div className="text-white text-xs font-medium">{recipeResult.egogiftName}</div>
                            {recipeResult.grades && recipeResult.grades.length > 0 && (
                              <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                                {recipeResult.grades.includes("N") && (
                                  <span className="px-1.5 py-0.5 rounded bg-green-900/40 border border-green-500/60 text-green-200 text-[10px]">
                                    노말
                                  </span>
                                )}
                                {recipeResult.grades.includes("H") && (
                                  <span className="px-1.5 py-0.5 rounded bg-pink-900/40 border border-pink-500/60 text-pink-200 text-[10px]">
                                    하드
                                  </span>
                                )}
                                {recipeResult.grades.includes("E") && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-900/40 border border-red-500/60 text-red-200 text-[10px]">
                                    익스트림
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 획득 가능 이벤트 */}
        {obtainableEvents && obtainableEvents.length > 0 && (
          <div className="mt-6 border-t border-[#b8860b]/30 pt-4">
            <h3 className="font-semibold text-[#ffcc33] mb-3">획득 가능 이벤트</h3>
            <div className="flex flex-wrap gap-2">
              {obtainableEvents.map((event) => {
                const nodeTitleText = event.parentNodeTitle 
                  ? `${event.parentNodeTitle} - ${event.nodeTitle}`
                  : event.nodeTitle;
                
                return (
                  <button
                    key={`${event.eventId}-${event.nodeId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/event?eventId=${event.eventId}&openEvent=true&nodeId=${event.nodeId}`, '_blank');
                    }}
                    className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#b8860b]/40 rounded text-sm text-white hover:text-white transition-colors"
                  >
                    <span className="text-white">
                      <span className="text-[#ffcc33]">{'\''}{event.eventTitle}{'\''}</span>에서 {'\''}
                      {event.parentNodeTitle ? (
                        <span className="text-[#ffcc33]">{event.parentNodeTitle} - {event.nodeTitle}</span>
                      ) : (
                        <span className="text-[#ffcc33]">{event.nodeTitle}</span>
                      )}
                      {'\''} 진행 시 {event.eventType === 1 ? '전투승리 후 획득가능' : '획득 가능'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 한정 카드팩 (획득 가능 이벤트 아래, ▶ 아이콘 토글 — 기본 접힘) */}
        {hasLimitedCardPackInfo && (
          <div className="mt-6 border-t border-[#b8860b]/30 pt-4">
            <button
              type="button"
              id="egogift-preview-limited-cardpack-toggle"
              aria-expanded={limitedCardPackOpen}
              aria-controls="egogift-preview-limited-cardpack-panel"
              aria-label={limitedCardPackOpen ? "한정 카드팩 접기" : "한정 카드팩 펼치기"}
              title={limitedCardPackOpen ? "한정 카드팩 접기" : "한정 카드팩 펼치기"}
              onClick={() => setLimitedCardPackOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left rounded-md px-1 py-2 -mx-1 hover:bg-[#2a2a2a]/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8860b]/60"
            >
              <span className="font-semibold text-[#ffcc33]">한정 카드팩</span>
              <span
                className={`inline-block shrink-0 text-yellow-200/80 transition-transform duration-200 ${limitedCardPackOpen ? "rotate-90" : ""}`}
                aria-hidden
              >
                ▶
              </span>
            </button>
            {limitedCardPackOpen && (
              <div
                id="egogift-preview-limited-cardpack-panel"
                role="region"
                aria-labelledby="egogift-preview-limited-cardpack-toggle"
                className="mt-2 pl-1"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
                  {cardPackAppearances.map((appearance, idx) => {
                    const canOpen =
                      appearance.cardpackId != null && appearance.cardpackId !== undefined;
                    const title = appearance.cardpackTitle?.trim() || "카드팩";
                    return (
                      <button
                        key={
                          canOpen
                            ? `cp-${appearance.cardpackId}-${idx}`
                            : `cp-idx-${idx}`
                        }
                        type="button"
                        disabled={!canOpen}
                        onClick={() => {
                          if (canOpen) setCardPackModalId(appearance.cardpackId!);
                        }}
                        className={`flex flex-col items-stretch gap-1 rounded-md border border-[#b8860b]/30 bg-[#141414]/90 p-2 text-left transition-colors ${
                          canOpen
                            ? "hover:bg-[#1c1c1c] hover:border-[#b8860b]/55 cursor-pointer"
                            : "opacity-55 cursor-not-allowed"
                        }`}
                      >
                        <div className="w-full flex justify-center items-end min-h-[88px] md:min-h-[104px]">
                          {appearance.thumbnailPath ? (
                            <img
                              src={`${baseUrl}${appearance.thumbnailPath}`}
                              alt={title}
                              className="max-h-[100px] md:max-h-[120px] w-auto object-contain border border-[#b8860b]/45 rounded"
                              onLoad={(e) => {
                                const img = e.target as HTMLImageElement;
                                const maxH = window.innerWidth >= 768 ? 120 : 100;
                                const nw = img.naturalWidth;
                                const nh = img.naturalHeight;
                                if (nw && nh) {
                                  const ar = nw / nh;
                                  img.style.height = `${maxH}px`;
                                  img.style.width = `${maxH * ar}px`;
                                }
                              }}
                              onError={(ev) => {
                                (ev.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-[88px] w-full max-w-[72px] mx-auto flex items-center justify-center border border-dashed border-[#b8860b]/35 rounded text-[10px] text-gray-500">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="min-h-0 px-0.5">
                          <div className="text-[10px] md:text-xs text-center text-[#e8d4a8] font-medium line-clamp-2 leading-tight">
                            {title}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>

    <CardPackDetailModal
      open={cardPackModalId != null}
      cardpackId={cardPackModalId}
      onClose={() => setCardPackModalId(null)}
      baseUrl={baseUrl}
      allKeywords={allKeywords}
      allEgoGifts={allEgoGiftsForHighlight}
      onEgoGiftClick={handleEgoGiftFromCardPackModal}
      stackZBase={10020}
    />
    </>
  );
}


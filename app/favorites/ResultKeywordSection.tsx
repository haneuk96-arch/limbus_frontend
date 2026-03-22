"use client";

import { API_BASE_URL } from "@/lib/api";

const RESULT_EGOGIFT_BASE_URL = API_BASE_URL.replace("/api", "");

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

export type ResultEgoGiftItem = {
  egogiftId: number;
  giftName: string;
  keywordName?: string;
  keywordId?: number;
  thumbnail?: string;
  giftTier?: string;
  grades?: string[];
  synthesisYn?: string;
  limitedCategoryNames?: string[];
};

export type SynthesisRecipeItem = {
  resultEgogiftId: number;
  resultGiftName: string;
  resultThumbnail?: string;
  resultGrades?: string[];
  materials: { egogiftId: number; giftName: string; thumbnail?: string; grades?: string[] }[];
};

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
  /** 상세 모드에서만 카드 우측 하단 X로 보고서 즐겨찾기 목록에서 제거 */
  onRemoveStarredEgoGift: (egogiftId: number) => void;
  sectionRef: (el: HTMLDivElement | null) => void;
  synthesisRef: (el: HTMLDivElement | null) => void;
  onCaptureSection: (keyword: string, isSynthesis: boolean) => void;
  egoGiftPreviewOpenRef: React.MutableRefObject<((giftName: string) => void) | null>;
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
}: Props) {
  const isGiftGridExpanded = keywordGiftExpandedByKeyword[keyword] !== false;

  return (
    <div className={keywordIndex > 0 ? "mt-8" : undefined}>
      <div ref={sectionRef}>
        {/* 헤더: 키워드명(캡처 버튼) + 에고기프트 그리드 접기 토글(우측 끝) */}
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => onCaptureSection(keyword, false)}
            className="text-lg font-semibold text-yellow-200/90 flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer hover:text-yellow-100 hover:underline focus:outline-none focus:underline rounded px-0 py-0"
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

        {/* 에고기프트 그리드 (접기 시 숨김, 합성 조합식과 별도) */}
        {isGiftGridExpanded && (
          <div className={resultSimplified ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"}>
            {egogifts.map((eg) => {
              if (resultSimplified) {
                const gradesList = eg.grades ?? [];
                const hasExtreme = gradesList.includes("E");
                const hasHard = gradesList.includes("H");
                const difficultyClass = hasExtreme ? "result-egogift-card--extreme" : hasHard ? "result-egogift-card--hard" : "result-egogift-card--normal";
                return (
                  <div
                    key={eg.egogiftId}
                    role="button"
                    tabIndex={0}
                    onClick={() => egoGiftPreviewOpenRef.current?.(eg.giftName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        egoGiftPreviewOpenRef.current?.(eg.giftName);
                      }
                    }}
                    className={`rounded-lg p-3 min-w-0 flex flex-col gap-1 text-left transition-colors shadow-sm cursor-pointer hover:ring-2 hover:ring-yellow-400/50 relative ${difficultyClass}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleEgoGiftCheck(eg.egogiftId); }}
                      className={`absolute top-2 right-2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded flex items-center justify-center transition-colors shadow-md border-2 border-blue-400 exclude-from-capture shrink-0 ${checkedEgoGiftIds.includes(eg.egogiftId) ? "bg-blue-500 hover:bg-blue-600" : "bg-black/70 hover:bg-black/90"}`}
                      title={checkedEgoGiftIds.includes(eg.egogiftId) ? "체크 해제" : "체크"}
                      aria-label={checkedEgoGiftIds.includes(eg.egogiftId) ? "체크 해제" : "체크"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 sm:w-5 sm:h-5 ${checkedEgoGiftIds.includes(eg.egogiftId) ? "text-white" : "text-gray-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    {/* 간소화: 우측 상단 고정 체크와 겹치지 않도록 텍스트만 패딩 (제목·한정 카드팩 문구) */}
                    <div className="min-w-0 pr-10 sm:pr-11 flex flex-col gap-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="result-egogift-tier text-amber-400/90 font-bold text-sm shrink-0">{tierDisplay(eg.giftTier)}</span>
                        <span className="result-egogift-name text-gray-200 font-medium text-sm break-words leading-tight">{eg.giftName}</span>
                      </div>
                      {eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0 && (
                        <div className="text-gray-400 text-xs break-words leading-tight">
                          {eg.limitedCategoryNames.map((n) => `"${n}"`).join(", ")}
                        </div>
                      )}
                      {eg.synthesisYn === "Y" && <div className="text-purple-300 text-xs">합성전용</div>}
                    </div>
                  </div>
                );
              }
              const keywordIcon = eg.keywordName ? RESULT_KEYWORD_ICON_MAP[eg.keywordName] : null;
              const gradesList = eg.grades ?? [];
              const hasExtreme = gradesList.includes("E");
              const hasHard = gradesList.includes("H");
              const difficultyClass = hasExtreme ? "result-egogift-card--extreme" : hasHard ? "result-egogift-card--hard" : "result-egogift-card--normal";
              return (
                <div
                  key={eg.egogiftId}
                  role="button"
                  tabIndex={0}
                  onClick={() => egoGiftPreviewOpenRef.current?.(eg.giftName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      egoGiftPreviewOpenRef.current?.(eg.giftName);
                    }
                  }}
                  className={`rounded p-3 min-w-0 flex flex-col cursor-pointer hover:ring-2 hover:ring-yellow-400/50 transition-all relative ${difficultyClass}`}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleEgoGiftCheck(eg.egogiftId); }}
                    className={`absolute top-2 right-2 z-20 w-9 h-9 rounded flex items-center justify-center transition-colors shadow-md border-2 border-blue-400 exclude-from-capture ${checkedEgoGiftIds.includes(eg.egogiftId) ? "bg-blue-500 hover:bg-blue-600" : "bg-black/70 hover:bg-black/90"}`}
                    title={checkedEgoGiftIds.includes(eg.egogiftId) ? "체크 해제" : "체크"}
                    aria-label={checkedEgoGiftIds.includes(eg.egogiftId) ? "체크 해제" : "체크"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${checkedEgoGiftIds.includes(eg.egogiftId) ? "text-white" : "text-gray-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <div className="relative aspect-square mb-2 flex-shrink-0">
                    <img
                      src="/images/egogift/egogift_frame.webp"
                      alt="frame"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                    />
                    <div className="result-egogift-tier absolute top-1 -left-3 z-20 text-5xl scale-x-[0.65] select-none tracking-tight leading-none font-black">
                      {tierDisplay(eg.giftTier)}
                    </div>
                    {keywordIcon && eg.keywordName && (
                      <div className="absolute bottom-[5px] right-[0px] w-9 h-9 z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
                        <img src={keywordIcon} alt={eg.keywordName} className="w-full h-full object-contain" />
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
                  <div className="result-egogift-card-text text-base text-center text-gray-300 font-medium flex-1">
                    <div className="result-egogift-name break-words leading-tight">{eg.giftName}</div>
                    {eg.synthesisYn === "Y" && <div className="result-egogift-label text-purple-300 text-xs break-words">합성전용</div>}
                    {eg.limitedCategoryNames && eg.limitedCategoryNames.length > 0 && (
                      <div className="result-egogift-label text-yellow-200/90 text-xs break-words leading-tight">
                        {eg.limitedCategoryNames.map((n) => `"${n}"`).join(", ")} 카드팩 한정
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveStarredEgoGift(eg.egogiftId);
                    }}
                    className="absolute bottom-2 right-2 z-30 w-8 h-8 rounded-md flex items-center justify-center transition-colors shadow-md border border-red-500/70 bg-red-950/90 hover:bg-red-900 hover:border-red-400 text-red-400 hover:text-red-300 exclude-from-capture"
                    title="이 에고기프트를 보고서 즐겨찾기에서 제거"
                    aria-label="이 에고기프트를 보고서 즐겨찾기에서 제거"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 합성 조합식 영역 (에고기프트 접기와 별도로 자체 접기/펼치기) */}
        {(() => {
          const resultIdsInSection = new Set(egogifts.map((eg) => eg.egogiftId));
          const recipesInSection = synthesisRecipes.filter((r) => resultIdsInSection.has(r.resultEgogiftId));
          if (recipesInSection.length === 0) return null;
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
            <div className={`rounded p-2 flex flex-col items-center min-w-0 bg-[#131316] ${getMiniCardBorderClass(grades)}`}>
              <div className="relative aspect-square w-20 flex-shrink-0">
                <img src="/images/egogift/egogift_frame.webp" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0" />
                {thumbnail ? (
                  <img
                    src={baseUrl + thumbnail}
                    alt=""
                    className="absolute inset-0 w-[70%] h-[70%] object-contain m-auto z-10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 w-[70%] h-[70%] m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded">
                    <span className="text-gray-500 text-xs">?</span>
                  </div>
                )}
              </div>
              <div className="text-center text-gray-300 text-xs font-medium mt-1 w-full break-words leading-tight">{giftName}</div>
            </div>
          );
          return (
            <div
              className="result-synthesis-block mt-3 pt-3 border-t border-[#b8860b]/30"
              ref={synthesisRef}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => onCaptureSection(keyword, true)}
                  className="text-xs font-semibold text-purple-300 text-left cursor-pointer hover:text-purple-200 hover:underline focus:outline-none focus:underline"
                  title="클릭 시 합성 조합식 영역만 이미지로 저장"
                >
                  합성 조합식
                </button>
                <button
                  type="button"
                  onClick={() => setSynthesisExpandedByKeyword((prev) => ({ ...prev, [keyword]: prev[keyword] === false }))}
                  className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-300 hover:bg-white/10 focus:outline-none transition-colors"
                  title={synthesisExpandedByKeyword[keyword] === false ? "펼치기" : "접기"}
                  aria-label={synthesisExpandedByKeyword[keyword] === false ? "펼치기" : "접기"}
                >
                  {synthesisExpandedByKeyword[keyword] === false ? (
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
              {synthesisExpandedByKeyword[keyword] !== false && (
                <ul className={resultSimplified ? "space-y-1" : "space-y-3"}>
                  {recipesInSection.map((recipe, recipeIdx) => (
                    <li key={`${recipe.resultEgogiftId}-${recipeIdx}`} className={resultSimplified ? "py-1 px-2 rounded bg-[#1a1a1a]/60 border border-[#b8860b]/20 text-xs text-gray-300" : "flex flex-wrap items-center gap-2 text-xs"}>
                      {resultSimplified ? (
                        <>
                          {recipe.materials.map((mat, i) => (
                            <span key={`${recipe.resultEgogiftId}-mat-${i}`}>
                              {i > 0 && <span className="text-amber-400/80 font-bold mx-1">+</span>}
                              <span className={`result-egogift-name ${getDifficultyTextClass(mat.grades ?? getGradesFromResult(mat.egogiftId))}`}>{mat.giftName}</span>
                            </span>
                          ))}
                          <span className="text-amber-400/80 font-bold mx-1">=</span>
                          <span className={`result-egogift-name font-medium ${getDifficultyTextClass(recipe.resultGrades ?? getGradesFromResult(recipe.resultEgogiftId))}`}>{recipe.resultGiftName}</span>
                        </>
                      ) : (
                        <>
                          {recipe.materials.map((mat, i) => (
                            <span key={`${recipe.resultEgogiftId}-mat-${i}`} className="inline-flex items-center gap-2">
                              {i > 0 && <span className="text-amber-400/80 font-bold flex-shrink-0 text-xl">+</span>}
                              <EgogiftMiniCard
                                thumbnail={mat.thumbnail}
                                giftName={mat.giftName}
                                baseUrl={RESULT_EGOGIFT_BASE_URL}
                                grades={mat.grades ?? getGradesFromResult(mat.egogiftId)}
                              />
                            </span>
                          ))}
                          <span className="text-amber-400/80 font-bold flex-shrink-0 text-xl">=</span>
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
        })()}
      </div>
    </div>
  );
}

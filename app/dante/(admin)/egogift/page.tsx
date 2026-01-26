"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import EgoGiftPreview from "./components/EgoGiftPreview";
import { Montserrat } from "next/font/google";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

const montserrat = Montserrat({ 
  subsets: ["latin"], 
  weight: ["700", "900"],
  display: "swap"
});

interface EgoGift {
  egogiftId: number;
  giftName: string;
  thumbnail?: string;
  keywordName?: string;
  keywordId?: number;
  giftTier: string;
  cost: number;
  enhanceYn: string;
}

interface EgoGiftDetail {
  egogift: {
    egogiftId: number;
    keywordId: number | null;
    attrKeywordId?: number | null;  // 속성 키워드 (category_id = 9)
    giftName: string;
    giftTier: string;
    cost: number;
    enhanceYn: string;
    synthesisYn?: string;  // 합성전용 여부
    grades?: string[];
    desc1: string;
    desc2: string;
    desc3: string;
    tagIds: number[];
  };
  keyword?: {
    keywordId: number;
    keywordName: string;
    categoryName?: string;
    keywordDesc?: string;
    files?: Array<{ path: string }>;
  };
  tags?: Array<{
    tagId: number;
    tagName: string;
    tagCategoryCd?: string;
  }>;
  thumbnail?: {
    fileId: number;
    path: string;
    originalName: string;
    storedName: string;
  };
  limitedCategoryName?: string | null; // 한정 카테고리명 (레거시 호환용)
  obtainableEvents?: Array<{
    eventId: number;
    eventTitle: string;
    nodeId: number;
    nodeTitle: string;
    parentNodeTitle?: string | null;
    eventType: number;
  }>;
  cardPackAppearances?: Array<{
    cardpackId: number;
    cardpackTitle: string;
    categoryName: string | null;
  }>;
}

interface Keyword {
  keywordId: number;
  keywordName: string;
  categoryId?: number;
  categoryName?: string;
}

interface Category {
  categoryId: number;
  categoryName: string;
}

function EgoGiftPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [egogifts, setEgoGifts] = useState<EgoGift[]>([]);
  const [allEgoGifts, setAllEgoGifts] = useState<EgoGift[]>([]); // 전체 목록 (필터링 전)
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null); // null = 전체, "0" = 범용
  const [searchName, setSearchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<EgoGiftDetail | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]); // 하이라이팅용

  useEffect(() => {
    fetchCategories();
    fetchEgoGifts();
    fetchAllKeywords(); // 하이라이팅용 전체 키워드
    
    // URL 쿼리 파라미터에서 keywordId 읽기
    const keywordIdFromUrl = searchParams.get("keywordId");
    if (keywordIdFromUrl) {
      setSelectedKeywordId(keywordIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (categories.length > 0) {
      fetchKeywords();
    }
  }, [categories]);

  useEffect(() => {
    filterEgoGifts();
  }, [selectedKeywordId, searchName, allEgoGifts]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/list?page=1&size=100`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.items || []);
      }
    } catch (err) {
      console.error("카테고리 목록 조회 실패:", err);
    }
  };

  const fetchKeywords = async () => {
    try {
      // 대표, 공격유형 카테고리 찾기
      const targetCategoryNames = ["대표", "공격유형"];
      const targetCategories = categories.filter((cat) =>
        targetCategoryNames.includes(cat.categoryName)
      );
      const targetCategoryIds = targetCategories.map((cat) => cat.categoryId);

      if (targetCategoryIds.length === 0) {
        console.warn("대표, 공격유형 카테고리를 찾을 수 없습니다.");
        return;
      }

      // 각 카테고리별로 키워드 조회
      const allKeywords: Keyword[] = [];
      for (const categoryId of targetCategoryIds) {
        const res = await fetch(
          `${API_BASE_URL}/admin/keyword?page=0&size=1000&categoryId=${categoryId}`,
          {
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          allKeywords.push(...(data.content || []));
        }
      }
      setKeywords(allKeywords);
    } catch (err) {
      console.error("키워드 목록 조회 실패:", err);
    }
  };

  const fetchEgoGifts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/egogift?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAllEgoGifts(data.content || []);
      }
    } catch (err) {
      console.error("에고기프트 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const filterEgoGifts = () => {
    let filtered = [...allEgoGifts];

    // 키워드 필터링
    if (selectedKeywordId !== null) {
      if (selectedKeywordId === "0") {
        // 범용: keywordId가 0인 경우
        filtered = filtered.filter((eg) => eg.keywordId === 0 || eg.keywordId === null || !eg.keywordId);
      } else {
        // 특정 키워드: keywordId로 매칭
        const keywordIdNum = Number(selectedKeywordId);
        filtered = filtered.filter((eg) => eg.keywordId === keywordIdNum);
      }
    }

    // 제목 검색
    if (searchName.trim()) {
      filtered = filtered.filter((eg) =>
        eg.giftName.toLowerCase().includes(searchName.toLowerCase().trim())
      );
    }

    setEgoGifts(filtered);
  };

  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywordsWithData: Keyword[] = data.content || [];
        const enrichedKeywords = keywordsWithData.map((k) => enrichKeywordData(k));
        setAllKeywords(enrichedKeywords);
      }
    } catch (err) {
      console.error("전체 키워드 목록 조회 실패:", err);
    }
  };

  const fetchEgoGiftDetail = async (id: number): Promise<EgoGiftDetail | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.error("에고기프트 상세 조회 실패:", err);
    }
    return null;
  };

  const handleCardClick = async (egogift: EgoGift) => {
    // 클릭 시 모달 표시
    const detail = await fetchEgoGiftDetail(egogift.egogiftId);
    if (detail) {
      setPreviewData(detail);
      setShowPreview(true);
    }
  };

  const handleEditClick = (egogiftId: number) => {
    setShowPreview(false);
    router.push(`/dante/egogift/edit/${egogiftId}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchEgoGifts();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  // 필터 버튼 목록 생성
  const filterButtons = [
    { id: null, name: "전체", type: "all" },
    ...keywords
      .filter((k) => k.categoryName === "대표")
      .map((k) => ({ id: String(k.keywordId), name: k.keywordName, type: "keyword" })),
    ...keywords
      .filter((k) => k.categoryName === "공격유형")
      .map((k) => ({ id: String(k.keywordId), name: k.keywordName, type: "keyword" })),
    { id: "0", name: "범용", type: "general" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">에고기프트 관리</h1>
        <Link
          href="/dante/egogift/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
      </div>

      {/* 필터 영역 */}
      <div className="mb-6 space-y-4">
        {/* 제목 검색 */}
        <div>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="에고기프트 이름으로 검색..."
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
          />
        </div>

        {/* 키워드 필터 버튼 */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((button) => (
            <button
              key={button.id || "all"}
              onClick={() => setSelectedKeywordId(button.id)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded border font-medium text-sm sm:text-base ${
                selectedKeywordId === button.id
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
              }`}
            >
              {button.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : egogifts.length === 0 ? (
        <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
          등록된 에고기프트가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5">
          {egogifts.map((egogift) => {
            const baseUrl = API_BASE_URL.replace('/api', '');
            const imageUrl = egogift.thumbnail ? `${baseUrl}${egogift.thumbnail}` : null;
            const romanMap: Record<string, string> = { "1": "Ⅰ", "2": "Ⅱ", "3": "Ⅲ", "4": "Ⅳ", "5": "Ⅴ" };
            const displayGrade = egogift.giftTier === "EX" ? "EX" : romanMap[egogift.giftTier] || "-";
            const isEX = egogift.giftTier === "EX";
            
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
            const keywordIcon = egogift.keywordName ? iconMap[egogift.keywordName] : null;

            return (
              <div
                key={egogift.egogiftId}
                onClick={() => handleCardClick(egogift)}
                className="bg-[#131316] border border-red-700 rounded p-0.5 cursor-pointer hover:border-yellow-400 transition-colors"
                style={{ maxWidth: '140px' }}
              >
                {/* 이미지 영역 */}
                <div className="relative w-full mb-0.5" style={{ height: '120px' }}>
                  {/* 프레임 배경 이미지 */}
                  <img
                    src="/images/egogift/egogift_frame.webp"
                    alt="frame"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                  />

                  {/* 등급 표시 - 2배 크기로 조정 */}
                  <div 
                    className={`absolute top-1 left-0 z-20 text-[#ffcc33] scale-x-[0.65] drop-shadow-[0_0_5px_rgba(0,0,0,0.9)] select-none tracking-tight leading-none ${isEX ? "font-bold" : `font-black ${montserrat.className}`}`}
                    style={{ fontSize: '40px', lineHeight: '1', fontFamily: montserrat.style.fontFamily }}
                  >
                    {displayGrade}
                  </div>

                  {/* 키워드 아이콘 (범용이 아닐 때) - 2배 크기로 조정 */}
                  {egogift.keywordName && keywordIcon && (
                    <div 
                      className="absolute bottom-2 right-1 z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]"
                      style={{ width: '36px', height: '36px' }}
                    >
                      <img
                        src={keywordIcon}
                        alt={egogift.keywordName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* 실제 이미지 */}
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={egogift.giftName}
                      className="absolute inset-0 object-contain m-auto z-10"
                      style={{ width: '70%', height: '70%' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 m-auto z-10 bg-[#1a1a1a] flex items-center justify-center rounded" style={{ width: '70%', height: '70%' }}>
                      <span className="text-gray-500 text-[7px]">이미지 없음</span>
                    </div>
                  )}
                </div>

                {/* 정보 영역 */}
                <div className="space-y-0.5">
                  {/* 이름 */}
                  <div className="text-[13px] font-bold text-[#d2b48c] truncate leading-tight">
                    {egogift.giftName}
                  </div>

                  {/* 키워드, 비용 */}
                  <div className="flex items-center gap-0.5 text-[11px]">
                    {egogift.keywordName && (
                      <span className="text-red-400 font-medium">
                        {egogift.keywordName}
                      </span>
                    )}
                    {egogift.cost !== undefined && egogift.cost !== null && (
                      <span className="text-[#ffcc33]">{egogift.cost}</span>
                    )}
                  </div>

                  {/* 티어, 강화여부 */}
                  <div className="flex items-center gap-0.5 text-[11px] text-gray-400">
                    <span>티어: {egogift.giftTier}</span>
                    <span>•</span>
                    <span>
                      강화: {egogift.enhanceYn === "Y" ? (
                        <span className="text-green-400">가능</span>
                      ) : (
                        <span className="text-red-400">불가</span>
                      )}
                    </span>
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => handleDelete(e, egogift.egogiftId)}
                    className="w-full mt-0.5 px-0.5 py-0.5 bg-red-700 hover:bg-red-800 text-white text-[11px] rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreview && previewData && (
        <EgoGiftPreview
          giftName={previewData.egogift.giftName}
          giftTier={previewData.egogift.giftTier}
          keywordId={
            previewData.egogift.keywordId !== null && previewData.egogift.keywordId !== undefined
              ? String(previewData.egogift.keywordId) 
              : previewData.keyword 
                ? String(previewData.keyword.keywordId) 
                : "0"
          }
          attrKeywordId={previewData.egogift.attrKeywordId}
          cost={String(previewData.egogift.cost)}
          enhanceYn={previewData.egogift.enhanceYn}
          synthesisYn={previewData.egogift.synthesisYn}
          grades={previewData.egogift.grades || []}
          desc1={previewData.egogift.desc1 || ""}
          desc2={previewData.egogift.desc2 || ""}
          desc3={previewData.egogift.desc3 || ""}
          selectedTagIds={previewData.egogift.tagIds || []}
          file={null}
          existingFile={previewData.thumbnail || undefined}
          keywords={
            previewData.keyword
              ? [
                  ...keywords,
                  {
                    keywordId: previewData.keyword.keywordId,
                    keywordName: previewData.keyword.keywordName,
                    categoryName: previewData.keyword.categoryName,
                  },
                ]
              : keywords
          }
          hashtags={previewData.tags || []}
          allKeywords={allKeywords}
          egogiftId={previewData.egogift.egogiftId}
          obtainableEvents={previewData.obtainableEvents || []}
          limitedCategoryName={previewData.limitedCategoryName || null}
          cardPackAppearances={previewData.cardPackAppearances || []}
          onClose={() => setShowPreview(false)}
          onEdit={handleEditClick}
        />
      )}
    </div>
  );
}

export default function EgoGiftPage() {
  return (
    <Suspense fallback={<div className="text-gray-300">로딩 중...</div>}>
      <EgoGiftPageContent />
    </Suspense>
  );
}


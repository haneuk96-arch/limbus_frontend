 "use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import EgoGiftPreview from "@/app/dante/(admin)/egogift/components/EgoGiftPreview";
import { HASHTAG_CATEGORIES } from "@/lib/hashtagCategories";
import { keywordIconMap } from "@/lib/keywordParser";
import { getOrCreateUUID, getUUID } from "@/lib/uuid";
import { normalizeCurseBlessCd } from "@/lib/egogiftCurseBless";
import { formatEgoGiftTierDisplay, normalizeGiftTierFromApi } from "@/lib/egoGiftTierDisplay";

interface EgoGift {
  egogiftId: number;
  giftName: string;
  thumbnail?: string;
  keywordName?: string;
  keywordId?: number;
  attrKeywordId?: number;  // 속성 키워드 (category_id = 9)
  giftTier: string;
  cost: number;
  enhanceYn: string;
  grades?: string[];
  tagIds?: number[];
  synthesisYn?: string;
  curseBlessCd?: string | null;
  limitedCategoryNames?: string[];
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
    curseBlessCd?: string | null;
    desc1: string;
    desc2: string;
    desc3: string;
    grades?: string[];
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
  obtainableEvents?: Array<{
    eventId: number;
    eventTitle: string;
    nodeId: number;
    nodeTitle: string;
    parentNodeTitle?: string | null;  // 부모노드 제목 (없으면 null)
    eventType: number;  // 0: 일반, 1: 전투
  }>;
  limitedCategoryName?: string | null; // 한정 카테고리명 (레거시 호환용)
  cardPackAppearances?: Array<{
    cardpackId?: number | null;
    cardpackTitle?: string | null;
    categoryName?: string | null;
    thumbnailPath?: string | null;
  }>;
}

export interface EgoGiftPageContentProps {
  /** 즐겨찾기 페이지 등에서 검색 조건 위에 붙일 노드 (예: 즐겨찾기 등록 영역) */
  slotAboveSearch?: React.ReactNode;
  /** true면 container/relative z-10 없이 flex+모달만 렌더 (다른 페이지에 삽입 시) */
  embedded?: boolean;
  /** 즐겨찾기용: 선택된 에고기프트 ID 목록 (별 채움 표시) */
  starredEgoGiftIds?: number[];
  /** 즐겨찾기용: 별 클릭 시 호출 (egogiftId) */
  onStarClick?: (egogiftId: number) => void;
  /** 즐겨찾기 결과 탭에서 에고기프트 클릭 시 상세 모달 열기용 (giftName 전달) */
  openEgoGiftPreviewRef?: React.MutableRefObject<((giftName: string) => void) | null>;
}

/** 해시태그 드롭다운 패널 내용 (인라인/포탈 공용) */
function HashtagDropdownPanel({
  contentRef,
  groupedHashtags,
  selectedHashtagIds,
  setSelectedHashtagIds,
  tagOperator,
  setTagOperator,
  egogiftFilters,
  egogiftSearchText,
  setEgoGiftFilters,
  getCategoryDisplayName,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  groupedHashtags: Record<string, Array<{ tagId: number; tagName: string; tagCategoryCd?: string }>>;
  selectedHashtagIds: number[];
  setSelectedHashtagIds: React.Dispatch<React.SetStateAction<number[]>>;
  tagOperator: "OR" | "AND";
  setTagOperator: React.Dispatch<React.SetStateAction<"OR" | "AND">>;
  egogiftFilters: { giftName: string; keywordName: string };
  egogiftSearchText: string;
  setEgoGiftFilters: React.Dispatch<React.SetStateAction<{ giftName: string; keywordName: string }>>;
  getCategoryDisplayName: (code: string) => string;
}) {
  return (
    <div
      ref={contentRef}
      className="p-3 bg-[#2a2a2d] border border-[#b8860b]/40 rounded overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shadow-lg max-h-[500px] md:max-h-[700px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-end gap-2 mb-3 text-xs">
        <span className="text-gray-400">태그 조건</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            className="w-3 h-3"
            checked={tagOperator === "OR"}
            onChange={() => setTagOperator("OR")}
          />
          <span className="text-gray-300">OR</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            className="w-3 h-3"
            checked={tagOperator === "AND"}
            onChange={() => setTagOperator("AND")}
          />
          <span className="text-gray-300">AND</span>
        </label>
      </div>

      <div className="space-y-3">
        {HASHTAG_CATEGORIES.map((category) => {
          const categoryCode = category.code;
          const tags = groupedHashtags[categoryCode] || [];
          if (!tags || tags.length === 0) return null;
          const displayName = getCategoryDisplayName(categoryCode);
          const allSelected = tags.every((tag) => selectedHashtagIds.includes(tag.tagId));

          return (
            <div key={categoryCode}>
              <button
                onClick={() => {
                  const tagIds = tags.map((t) => t.tagId);
                  if (allSelected) {
                    setSelectedHashtagIds((prev) => prev.filter((id) => !tagIds.includes(id)));
                  } else {
                    setSelectedHashtagIds((prev) => {
                      const newIds = [...prev];
                      tagIds.forEach((tagId) => {
                        if (!newIds.includes(tagId)) newIds.push(tagId);
                      });
                      return newIds;
                    });
                  }
                  setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                }}
                className="text-xs text-yellow-400 mb-1.5 font-semibold hover:text-yellow-300 cursor-pointer transition-colors"
              >
                {displayName}
              </button>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.tagId}
                    onClick={() => {
                      const newIds = selectedHashtagIds.includes(tag.tagId)
                        ? selectedHashtagIds.filter((id) => id !== tag.tagId)
                        : [...selectedHashtagIds, tag.tagId];
                      setSelectedHashtagIds(newIds);
                      setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedHashtagIds.includes(tag.tagId)
                        ? "bg-yellow-400 text-black font-semibold"
                        : "bg-[#242427] text-gray-300 hover:bg-[#2a2a2d]"
                    }`}
                  >
                    {tag.tagName}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {groupedHashtags["기타"] && groupedHashtags["기타"].length > 0 && (() => {
          const tags = groupedHashtags["기타"];
          const allSelected = tags.every((t) => selectedHashtagIds.includes(t.tagId));
          return (
            <div>
              <button
                onClick={() => {
                  const tagIds = tags.map((t) => t.tagId);
                  if (allSelected) {
                    setSelectedHashtagIds((prev) => prev.filter((id) => !tagIds.includes(id)));
                  } else {
                    setSelectedHashtagIds((prev) => {
                      const newIds = [...prev];
                      tagIds.forEach((tagId) => {
                        if (!newIds.includes(tagId)) newIds.push(tagId);
                      });
                      return newIds;
                    });
                  }
                  setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                }}
                className="text-xs text-yellow-400 mb-1.5 font-semibold hover:text-yellow-300 cursor-pointer transition-colors"
              >
                기타
              </button>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.tagId}
                    onClick={() => {
                      const newIds = selectedHashtagIds.includes(tag.tagId)
                        ? selectedHashtagIds.filter((id) => id !== tag.tagId)
                        : [...selectedHashtagIds, tag.tagId];
                      setSelectedHashtagIds(newIds);
                      setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedHashtagIds.includes(tag.tagId)
                        ? "bg-yellow-400 text-black font-semibold"
                        : "bg-[#242427] text-gray-300 hover:bg-[#2a2a2d]"
                    }`}
                  >
                    {tag.tagName}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export function EgoGiftPageContent({ slotAboveSearch, embedded, starredEgoGiftIds = [], onStarClick, openEgoGiftPreviewRef }: EgoGiftPageContentProps) {
  // 에고기프트 관련 상태
  const [allEgoGiftsFull, setAllEgoGiftsFull] = useState<EgoGift[]>([]);  // 전체 목록 (필터링 전)
  const [egogifts, setEgoGifts] = useState<EgoGift[]>([]);  // 필터링된 목록
  const [egogiftLoading, setEgoGiftLoading] = useState(false);
  const [egogiftFilters, setEgoGiftFilters] = useState({
    giftName: "",
    keywordName: "",
  });
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);  // 출현난이도: 'N', 'H', 'E'
  const [egogiftSearchText, setEgoGiftSearchText] = useState("");
  const [egogiftPreviewData, setEgoGiftPreviewData] = useState<EgoGiftDetail | null>(null);
  const [egogiftPreviewOpen, setEgoGiftPreviewOpen] = useState(false);
  const [egogiftRecipe, setEgoGiftRecipe] = useState<any>(null);
  const [allEgoGifts, setAllEgoGifts] = useState<Array<{ egogiftId: number; giftName: string; giftTier: string; thumbnailPath?: string; desc1?: string; desc2?: string; desc3?: string }>>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [previewHashtags, setPreviewHashtags] = useState<any[]>([]);
  const [allKeywords, setAllKeywords] = useState<any[]>([]);
  const [allHashtags, setAllHashtags] = useState<Array<{ tagId: number; tagName: string; tagCategoryCd?: string }>>([]);
  const [hashtagsOpen, setHashtagsOpen] = useState(false);
  const [hashtagDropdownPosition, setHashtagDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const hashtagDropdownRef = useRef<HTMLDivElement>(null);
  const hashtagDropdownContentRef = useRef<HTMLDivElement>(null);
  const searchConditionsRef = useRef<HTMLDivElement>(null);
  const [selectedHashtagIds, setSelectedHashtagIds] = useState<number[]>([]);
  const [tagOperator, setTagOperator] = useState<"OR" | "AND">("OR");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<number[]>([]);
  const [includeUniversalKeyword, setIncludeUniversalKeyword] = useState(false);
  const [selectedAttrKeywordIds, setSelectedAttrKeywordIds] = useState<number[]>([]);  // 속성 키워드 (category_id = 9)
  const [attrKeywords, setAttrKeywords] = useState<Array<{ keywordId: number; keywordName: string }>>([]);  // 속성 키워드 목록
  const [selectedGiftTiers, setSelectedGiftTiers] = useState<string[]>([]);
  const [keywordCategories, setKeywordCategories] = useState<Array<{ categoryId: number | null; categoryName: string; keywordId: number; keywordName: string }>>([]);
  const [searchConditionsCollapsed, setSearchConditionsCollapsed] = useState(false); // 모바일에서 검색 조건 접기/펼치기
  
  // 즐겨찾기 관련 상태
  const [favorites, setFavorites] = useState<Array<{ favoriteId: number; searchJson: string; createdAt: string }>>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [editingFavoriteId, setEditingFavoriteId] = useState<number | null>(null);
  const [editingFavoriteName, setEditingFavoriteName] = useState<string>("");

  // 해시태그를 카테고리별로 그룹화
  const groupedHashtags = useMemo(() => {
    const grouped: Record<string, typeof allHashtags> = {};
    grouped["기타"] = [];

    // 카테고리 코드를 키로 사용하여 그룹화
    HASHTAG_CATEGORIES.forEach((cat) => {
      grouped[cat.code] = [];
    });

    const categoryMap: Record<string, { name: string; code: string }> = {};
    HASHTAG_CATEGORIES.forEach((cat) => {
      categoryMap[cat.code] = { name: cat.name, code: cat.code };
    });

    allHashtags.forEach((tag) => {
      const categoryCd = tag.tagCategoryCd;
      if (categoryCd && categoryMap[categoryCd]) {
        grouped[categoryCd].push(tag);
      } else {
        grouped["기타"].push(tag);
      }
    });

    // 각 카테고리 내 태그들을 이름순으로 정렬
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => a.tagName.localeCompare(b.tagName, 'ko'));
    });

    return grouped;
  }, [allHashtags]);

  // 카테고리 코드를 표시 이름으로 변환하는 함수
  const getCategoryDisplayName = (code: string): string => {
    const category = HASHTAG_CATEGORIES.find((cat) => cat.code === code);
    if (!category) return code;
    
    if (code.endsWith("-U")) {
      return `${category.name} (인격)`;
    } else if (code.endsWith("-E")) {
      return `${category.name} (적)`;
    }
    return category.name;
  };

  // 초기 데이터 로드 (에고기프트 / 키워드 / 해시태그)
  useEffect(() => {
    Promise.all([
      fetchAllEgoGiftsFull(),
      fetchAllKeywords(),
      fetchAllHashtags(),
      fetchKeywordCategories(),
      fetchAttrKeywords(),
    ]).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 해시태그 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!hashtagsOpen) return;
      
      const target = event.target as Node;
      const dropdownRef = hashtagDropdownRef.current;
      const dropdownContentRef = hashtagDropdownContentRef.current;
      
      // 드롭다운 컨테이너나 컨텐츠 내부 클릭이 아니면 닫기
      if (
        dropdownRef &&
        dropdownContentRef &&
        !dropdownRef.contains(target) &&
        !dropdownContentRef.contains(target)
      ) {
        setHashtagsOpen(false);
      }
    };

    if (hashtagsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [hashtagsOpen]);

  // 해시태그 드롭다운 위치 조정
  // embedded일 때: body에 포탈해 위치 state로 배치. 아닐 때: in-place에서 fixed + style로 배치
  useEffect(() => {
    if (!hashtagsOpen || !hashtagDropdownRef.current) {
      if (!hashtagsOpen) setHashtagDropdownPosition(null);
      return;
    }
    const updateLayout = () => {
      if (!hashtagDropdownRef.current) return;
      const buttonRect = hashtagDropdownRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      const width = isMobile ? Math.min(400, window.innerWidth - buttonRect.left - 16) : 400;
      let left: number;
      let top: number;
      if (isMobile) {
        left = buttonRect.left;
        top = buttonRect.bottom + 4;
      } else {
        const gap = 8;
        left = buttonRect.right + gap;
        if (left + width > window.innerWidth) left = window.innerWidth - width - 8;
        if (left < 8) left = 8;
        top = buttonRect.top;
      }
      if (embedded) {
        // 검색조건과 같은 높이에서 패널 시작: 검색조건 컨테이너 상단에 맞춤
        const searchRect = searchConditionsRef.current?.getBoundingClientRect();
        const panelTop = searchRect ? searchRect.top : top;
        setHashtagDropdownPosition({ top: panelTop, left, width });
      } else {
        const dropdownContainer = hashtagDropdownRef.current.querySelector('[data-dropdown-container]') as HTMLElement;
        if (dropdownContainer) {
          dropdownContainer.style.position = 'fixed';
          dropdownContainer.style.zIndex = '10001';
          dropdownContainer.style.left = `${left}px`;
          dropdownContainer.style.top = `${top}px`;
          dropdownContainer.style.width = `${width}px`;
        }
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [hashtagsOpen, embedded]);

  // 전체 에고기프트 목록 한 번에 불러오기 (초기 로드 시)
  const fetchAllEgoGiftsFull = async () => {
    try {
      setEgoGiftLoading(true);
      const params = new URLSearchParams({
        page: "0",
        size: "10000",  // 전체 목록을 한 번에 불러오기
      });

      const res = await fetch(`${API_BASE_URL}/user/egogift?${params}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((item: any) => ({
          egogiftId: item.egogiftId,
          giftName: item.giftName,
          thumbnail: item.thumbnail,
          keywordName: item.keywordName,
          keywordId: item.keywordId,
          attrKeywordId: item.attrKeywordId,
          giftTier: normalizeGiftTierFromApi(item.giftTier ?? item.gift_tier),
          cost: item.cost || 0,
          enhanceYn: item.enhanceYn || "",
          grades: item.grades || [],
          tagIds: item.tagIds || [],
          synthesisYn: item.synthesisYn ?? item.synthesis_yn,
          curseBlessCd: normalizeCurseBlessCd(item.curseBlessCd ?? item.curse_bless_cd),
          limitedCategoryNames: Array.isArray(item.limitedCategoryNames) ? item.limitedCategoryNames : [],
        }));
        setAllEgoGiftsFull(items);
      }
    } catch (err) {
      // 에러 처리
    } finally {
      setEgoGiftLoading(false);
    }
  };

  // 클라이언트 측 필터링 로직
  const filteredEgoGifts = useMemo(() => {
    let filtered = [...allEgoGiftsFull];

    // 제목 검색
    if (egogiftFilters.giftName) {
      filtered = filtered.filter((egogift) =>
        egogift.giftName.toLowerCase().includes(egogiftFilters.giftName.toLowerCase())
      );
    }

    // 키워드 필터
    if (selectedKeywordIds.length > 0 || includeUniversalKeyword) {
      filtered = filtered.filter((egogift) => {
        const hasSelectedKeyword = selectedKeywordIds.length > 0
          ? selectedKeywordIds.includes(egogift.keywordId || 0)
          : false;
        const hasUniversal = includeUniversalKeyword && (egogift.keywordId === 0 || egogift.keywordId === null || !egogift.keywordId);
        return hasSelectedKeyword || hasUniversal;
      });
    }

    // 속성 키워드 필터
    if (selectedAttrKeywordIds.length > 0) {
      filtered = filtered.filter((egogift) => {
        return egogift.attrKeywordId && selectedAttrKeywordIds.includes(egogift.attrKeywordId);
      });
    }

    // 등급 필터
    if (selectedGiftTiers.length > 0) {
      filtered = filtered.filter((egogift) =>
        selectedGiftTiers.includes(egogift.giftTier)
      );
    }

    // 출현난이도 필터
    if (selectedGrades.length > 0) {
      filtered = filtered.filter((egogift) => {
        const egogiftGrades = egogift.grades || [];
        return selectedGrades.some((grade) => egogiftGrades.includes(grade));
      });
    }

    // 해시태그 필터
    if (selectedHashtagIds.length > 0) {
      filtered = filtered.filter((egogift) => {
        const egogiftTagIds = egogift.tagIds || [];
        if (tagOperator === "AND") {
          // 모든 선택된 태그가 포함되어야 함
          return selectedHashtagIds.every((tagId) => egogiftTagIds.includes(tagId));
        } else {
          // OR: 하나라도 포함되면 됨
          return selectedHashtagIds.some((tagId) => egogiftTagIds.includes(tagId));
        }
      });
    }

    // 정렬: 키워드별 순서 → 등급(높은 등급 우선) → 출현난이도(노말→하드→익스트림)
    const KEYWORD_ORDER = [
      "화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "참격", "관통", "타격", "범용", "기타",
    ];
    const keywordOrder = (name: string | undefined) => {
      if (!name) return KEYWORD_ORDER.length;
      const i = KEYWORD_ORDER.indexOf(name.trim());
      return i >= 0 ? i : KEYWORD_ORDER.length;
    };
    const tierOrder = (tier: string | undefined) => {
      if (!tier) return 99;
      const t = String(tier).trim().toUpperCase();
      if (t === "1") return 1;
      if (t === "2") return 2;
      if (t === "3") return 3;
      if (t === "4") return 4;
      if (t === "5") return 5;
      if (t === "EX") return 6;
      return 99;
    };
    const gradeOrder = (grades: string[] | undefined) => {
      if (!grades || grades.length === 0) return 99;
      let min = 99;
      for (const g of grades) {
        if (g === "N") min = Math.min(min, 1);
        else if (g === "H") min = Math.min(min, 2);
        else if (g === "E") min = Math.min(min, 3);
      }
      return min;
    };
    return [...filtered].sort((a, b) => {
      const kw = keywordOrder(a.keywordName) - keywordOrder(b.keywordName);
      if (kw !== 0) return kw;
      const d = tierOrder(b.giftTier) - tierOrder(a.giftTier);
      if (d !== 0) return d;
      return gradeOrder(a.grades) - gradeOrder(b.grades);
    });
  }, [
    allEgoGiftsFull,
    egogiftFilters.giftName,
    selectedKeywordIds,
    includeUniversalKeyword,
    selectedAttrKeywordIds,
    selectedGiftTiers,
    selectedGrades,
    selectedHashtagIds,
    tagOperator,
  ]);

  // 필터링된 결과를 상태에 반영
  useEffect(() => {
    setEgoGifts(filteredEgoGifts);
  }, [filteredEgoGifts]);

  // 합성전용 에고기프트의 합성재료 목록 배치 조회
  const [synthesisMaterialsMap, setSynthesisMaterialsMap] = useState<Record<number, string[]>>({});
  useEffect(() => {
    const synthesisIds = filteredEgoGifts.filter((eg) => eg.synthesisYn === "Y").map((eg) => eg.egogiftId);
    if (synthesisIds.length === 0) {
      setSynthesisMaterialsMap({});
      return;
    }
    const q = synthesisIds.map((id) => "egogiftIds=" + id).join("&");
    fetch(`${API_BASE_URL}/user/egogift/synthesis-materials?${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string[]>) => {
        const next: Record<number, string[]> = {};
        Object.keys(data).forEach((k) => {
          const id = Number(k);
          if (Array.isArray(data[k])) next[id] = data[k];
        });
        setSynthesisMaterialsMap(next);
      })
      .catch(() => setSynthesisMaterialsMap({}));
  }, [filteredEgoGifts]);

  // 초기 로드 시 전체 목록 불러오기
  useEffect(() => {
    fetchAllEgoGiftsFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllHashtags = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/keyword/tag?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAllHashtags((data.content || []).map((tag: any) => ({
          tagId: tag.tagId,
          tagName: tag.tagName,
          tagCategoryCd: tag.tagCategoryCd,
        })));
      }
    } catch (err) {
      // 에러 처리
    }
  };

  const fetchKeywordCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/keyword/all-cached`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();

      const all = (data.content || []) as Array<{
        keywordId: number;
        keywordName: string;
        categoryId?: number | null;
        categoryName?: string | null;
      }>;

      // 대표 / 공격유형만 사용 (범용은 별도 버튼으로 처리, keywordId가 0인 범용 제외)
      const filtered = all.filter((kw) => {
        // keywordId가 0인 범용 키워드는 제외 (별도 버튼으로 처리)
        if (kw.keywordId === 0) return false;
        return kw.categoryName === "대표" || kw.categoryName === "공격유형";
      });

      const mapped = filtered.map((kw) => ({
        categoryId: kw.categoryId ?? null,
        categoryName: kw.categoryName ?? "범용",
        keywordId: kw.keywordId,
        keywordName: kw.keywordName,
      }));

      // keywordId 기준 중복 제거
      const uniqueKeywords = Array.from(
        new Map(mapped.map((kw) => [kw.keywordId, kw])).values()
      );

      // 정렬 기준:
      // 1) 키워드 카테고리 idx (categoryId 오름차순, null/없음은 가장 뒤)
      // 2) 키워드 idx (keywordId 오름차순)
      const sortedKeywords = [...uniqueKeywords].sort((a, b) => {
        const ca = a.categoryId ?? Number.MAX_SAFE_INTEGER;
        const cb = b.categoryId ?? Number.MAX_SAFE_INTEGER;
        if (ca !== cb) return ca - cb;
        return a.keywordId - b.keywordId;
      });

      setKeywordCategories(sortedKeywords);
    } catch (err) {
      // 에러 처리
    }
  };

  const fetchAttrKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/keyword/all-cached`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();

      const all = (data.content || []) as Array<{
        keywordId: number;
        keywordName: string;
        categoryId?: number | null;
        categoryName?: string | null;
      }>;

      // category_id가 9인 키워드만 필터링
      const attrKeywords = all
        .filter((kw) => kw.categoryId === 9)
        .map((kw) => ({
          keywordId: kw.keywordId,
          keywordName: kw.keywordName,
        }))
        .sort((a, b) => a.keywordId - b.keywordId);

      setAttrKeywords(attrKeywords);
    } catch (err) {
      // 에러 처리
    }
  };

  const fetchAllEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/egogift?page=0&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const egogifts = (data.items || []).map((e: any) => ({
          egogiftId: e.egogiftId,
          giftName: e.giftName,
          giftTier: e.giftTier,
          thumbnailPath: e.thumbnailPath,
          desc1: "",
          desc2: "",
          desc3: "",
        }));
        setAllEgoGifts(egogifts);
      }
    } catch (err) {
      // 에러 처리
    }
  };

  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/keyword/all-cached`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywordsData = (data.content || []).map((k: any) => ({
          keywordId: k.keywordId,
          keywordName: k.keywordName,
          keywordDesc: k.keywordDesc,
          iconPath: k.files && k.files.length > 0 ? k.files[0].path : null,
        }));
        setAllKeywords(keywordsData);
      }
    } catch (err) {
      // 에러 처리
    }
  };

  const applyEgoGiftDetailToPreview = async (data: EgoGiftDetail) => {
    setEgoGiftPreviewData(data);
    setEgoGiftPreviewOpen(true);
    if (data.keyword) {
      setKeywords([
        {
          keywordId: data.keyword.keywordId,
          keywordName: data.keyword.keywordName,
          categoryName: data.keyword.categoryName || "",
        },
      ]);
    }
    setPreviewHashtags(data.tags ?? []);
    if (data.egogift?.egogiftId) {
      try {
        const recipeRes = await fetch(`${API_BASE_URL}/user/egogift/${data.egogift.egogiftId}/recipe`, {
          credentials: "include",
        });
        if (recipeRes.ok) {
          const recipeData = await recipeRes.json();
          setEgoGiftRecipe(recipeData.recipes || []);
        } else {
          setEgoGiftRecipe(null);
        }
      } catch {
        setEgoGiftRecipe(null);
      }
    } else {
      setEgoGiftRecipe(null);
    }
  };

  const handleEgoGiftClick = async (giftName: string) => {
    try {
      const encodedName = encodeURIComponent(giftName);
      const res = await fetch(`${API_BASE_URL}/user/egogift/by-name/${encodedName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        await applyEgoGiftDetailToPreview(data);
      }
    } catch (err) {
      // 에러 처리
    }
  };

  const handleEgoGiftClickById = async (egogiftId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/egogift/${egogiftId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        await applyEgoGiftDetailToPreview(data);
      }
    } catch (err) {
      // 에러 처리
    }
  };
  

  const handleEgoGiftSearch = () => {
    setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
  };

  // 즐겨찾기 관련 함수들
  const getNextFavoriteName = (): string => {
    const existingNames = favorites.map(fav => {
      try {
        const json = JSON.parse(fav.searchJson);
        return json.name || "";
      } catch {
        return "";
      }
    });
    
    let num = 1;
    while (existingNames.includes(`즐겨찾기${num}`)) {
      num++;
    }
    
    return `즐겨찾기${num}`;
  };

  const saveFavorite = async () => {
    try {
      const uuid = getOrCreateUUID();
      if (!uuid) {
        alert("UUID를 생성할 수 없습니다.");
        return;
      }

      const favoriteName = getNextFavoriteName();

      const searchConditions = {
        name: favoriteName,
        giftName: egogiftSearchText,
        keywordIds: selectedKeywordIds,
        includeUniversal: includeUniversalKeyword,
        attrKeywordIds: selectedAttrKeywordIds,
        giftTiers: selectedGiftTiers,
        grades: selectedGrades,
        tagIds: selectedHashtagIds,
        tagOperator: tagOperator,
      };

      const response = await fetch(`${API_BASE_URL}/user/favorite-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-UUID": uuid,
        },
        credentials: "include",
        body: JSON.stringify({
          pageType: "EGOGIFT",
          searchJson: JSON.stringify(searchConditions),
        }),
      });

      if (response.ok) {
        alert("즐겨찾기에 저장되었습니다.");
        fetchFavorites();
      } else {
        alert("즐겨찾기 저장에 실패했습니다.");
      }
    } catch (error) {
      alert("즐겨찾기 저장 중 오류가 발생했습니다.");
    }
  };

  const fetchFavorites = async () => {
    try {
      const uuid = getUUID();
      if (!uuid) {
        setFavorites([]);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/user/favorite-search/EGOGIFT`, {
        method: "GET",
        headers: {
          "X-User-UUID": uuid,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setFavorites(data.items || []);
      }
    } catch (error) {
      // 에러 처리
    }
  };

  const applyFavorite = (searchJson: string) => {
    try {
      const conditions = JSON.parse(searchJson);
      
      // name 필드는 제외하고 검색 조건만 적용
      setEgoGiftSearchText(conditions.giftName || "");
      setSelectedKeywordIds(conditions.keywordIds || []);
      setIncludeUniversalKeyword(conditions.includeUniversal || false);
      setSelectedAttrKeywordIds(conditions.attrKeywordIds || []);
      setSelectedGiftTiers(conditions.giftTiers || []);
      setSelectedGrades(conditions.grades || []);
      setSelectedHashtagIds(conditions.tagIds || []);
      setTagOperator(conditions.tagOperator || "OR");
      
      setEgoGiftFilters({ ...egogiftFilters, giftName: conditions.giftName || "" });
      setFavoritesOpen(false);
    } catch (error) {
      alert("즐겨찾기 적용 중 오류가 발생했습니다.");
    }
  };

  const startEditFavorite = (favoriteId: number, searchJson: string) => {
    try {
      const conditions = JSON.parse(searchJson);
      setEditingFavoriteId(favoriteId);
      setEditingFavoriteName(conditions.name || "");
    } catch (error) {
      // 에러 처리
    }
  };

  const cancelEditFavorite = () => {
    setEditingFavoriteId(null);
    setEditingFavoriteName("");
  };

  const updateFavorite = async (favoriteId: number, newName: string) => {
    try {
      const uuid = getUUID();
      if (!uuid) {
        alert("UUID를 찾을 수 없습니다.");
        return;
      }

      if (!newName || newName.trim() === "") {
        alert("즐겨찾기 이름을 입력해주세요.");
        return;
      }

      // 해당 즐겨찾기 찾기
      const favorite = favorites.find(f => f.favoriteId === favoriteId);
      if (!favorite) {
        alert("즐겨찾기를 찾을 수 없습니다.");
        return;
      }

      // JSON 파싱 후 name 업데이트
      const conditions = JSON.parse(favorite.searchJson);
      conditions.name = newName.trim();

      // 백엔드에 PUT 요청으로 업데이트
      const response = await fetch(`${API_BASE_URL}/user/favorite-search/${favoriteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-UUID": uuid,
        },
        credentials: "include",
        body: JSON.stringify({
          searchJson: JSON.stringify(conditions),
        }),
      });

      if (response.ok) {
        fetchFavorites();
        cancelEditFavorite();
      } else {
        alert("즐겨찾기 수정에 실패했습니다.");
      }
    } catch (error) {
      alert("즐겨찾기 수정 중 오류가 발생했습니다.");
    }
  };

  const deleteFavorite = async (favoriteId: number) => {
    try {
      const uuid = getUUID();
      if (!uuid) {
        alert("UUID를 찾을 수 없습니다.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/user/favorite-search/${favoriteId}`, {
        method: "DELETE",
        headers: {
          "X-User-UUID": uuid,
        },
        credentials: "include",
      });

      if (response.ok) {
        fetchFavorites();
      } else {
        alert("즐겨찾기 삭제에 실패했습니다.");
      }
    } catch (error) {
      alert("즐겨찾기 삭제 중 오류가 발생했습니다.");
    }
  };

  // 초기 로드 시 즐겨찾기 불러오기
  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // 모달을 직접 닫을 때
  const closeEgoGiftModal = () => {
    setEgoGiftPreviewOpen(false);
    setEgoGiftRecipe(null);
  };

  // 즐겨찾기 결과 탭에서 에고기프트 클릭 시 이 함수로 상세 모달 열기
  useEffect(() => {
    if (openEgoGiftPreviewRef) {
      openEgoGiftPreviewRef.current = handleEgoGiftClick;
      return () => {
        openEgoGiftPreviewRef.current = null;
      };
    }
  }, [openEgoGiftPreviewRef, handleEgoGiftClick]);

  const baseUrl = API_BASE_URL.replace("/api", "");


  const flexRow = (
    <div className="flex flex-col md:flex-row gap-6">
            {/* 검색 조건 (slotAboveSearch 있으면 그 위에 표시) - embedded일 때 왼쪽 전체 sticky */}
            <div className={"w-full md:w-[285px] flex-shrink-0 order-1 md:order-1 space-y-4 " + (embedded ? "md:sticky md:top-[120px] md:self-start" : "")}>
              {slotAboveSearch}
              <div ref={searchConditionsRef} className={`relative bg-[#131316] border border-[#b8860b]/40 rounded p-4 overflow-visible ${embedded ? "" : "md:sticky md:top-20"} ${hashtagsOpen ? "z-[200]" : "z-[100]"}`} id="search-conditions-container">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-yellow-300">검색 조건</h2>
                  {/* 모바일 또는 embedded일 때 접기/펼치기 버튼 표시 */}
                  <button
                    onClick={() => setSearchConditionsCollapsed(!searchConditionsCollapsed)}
                    className={(embedded ? "" : "md:hidden") + " text-yellow-300 hover:text-yellow-200 transition-colors"}
                    aria-label={searchConditionsCollapsed ? "검색 조건 펼치기" : "검색 조건 접기"}
                  >
                    <span className={`transition-transform duration-200 ${searchConditionsCollapsed ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </button>
                </div>
                
                {/* 접혀있을 때 선택된 조건 요약 (모바일 또는 embedded일 때 표시) - 부드럽게 접기/펼치기 */}
                <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: searchConditionsCollapsed ? "1fr" : "0fr" }}>
                  <div className="min-h-0 overflow-hidden">
                    <div className={(embedded ? "" : "md:hidden") + " space-y-2 text-sm"}>
                    {egogiftSearchText && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">제목:</span>
                        <span className="text-yellow-300 truncate">{egogiftSearchText}</span>
                      </div>
                    )}
                    {selectedKeywordIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">키워드:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedKeywordIds.map((id) => {
                            const keyword = keywordCategories.find((kw) => kw.keywordId === id);
                            return keyword ? (
                              <span key={id} className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">
                                {keyword.keywordName}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    {includeUniversalKeyword && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">범용</span>
                      </div>
                    )}
                    {selectedAttrKeywordIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">속성:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedAttrKeywordIds.map((id) => {
                            const keyword = attrKeywords.find((kw) => kw.keywordId === id);
                            return keyword ? (
                              <span key={id} className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">
                                {keyword.keywordName}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                    {selectedGiftTiers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">등급:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedGiftTiers.map((tier) => {
                            const tierName = tier === "EX" ? "EX" : 
                                           tier === "1" ? "Ⅰ" :
                                           tier === "2" ? "Ⅱ" :
                                           tier === "3" ? "Ⅲ" :
                                           tier === "4" ? "Ⅳ" :
                                           tier === "5" ? "Ⅴ" : tier;
                            return (
                              <span key={tier} className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">
                                {tierName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedGrades.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">출현난이도:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedGrades.map((grade) => {
                            const gradeLabel = grade === "N" ? "노말" : grade === "H" ? "하드" : "익스트림";
                            return (
                              <span key={grade} className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">
                                {gradeLabel}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedHashtagIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400">해시태그 ({tagOperator}):</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedHashtagIds.slice(0, 5).map((tagId) => {
                            const tag = allHashtags.find((t) => t.tagId === tagId);
                            return tag ? (
                              <span key={tagId} className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs truncate max-w-[100px]">
                                {tag.tagName}
                              </span>
                            ) : null;
                          })}
                          {selectedHashtagIds.length > 5 && (
                            <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded text-xs">
                              +{selectedHashtagIds.length - 5}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {!egogiftSearchText && selectedKeywordIds.length === 0 && !includeUniversalKeyword && 
                     selectedAttrKeywordIds.length === 0 && selectedGiftTiers.length === 0 && selectedGrades.length === 0 && selectedHashtagIds.length === 0 && (
                      <div className="text-gray-500 text-xs">선택된 조건이 없습니다.</div>
                    )}
                    </div>
                  </div>
                </div>
                
                {/* 검색 조건 폼 - 부드럽게 접기/펼치기 */}
                <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: searchConditionsCollapsed ? "0fr" : "1fr" }}>
                  <div className="min-h-0 overflow-hidden">
                <div className={embedded ? "block" : "md:block"}>
                
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      setEgoGiftFilters({ giftName: "", keywordName: "" });
                      setEgoGiftSearchText("");
                      setSelectedKeywordIds([]);
                      setIncludeUniversalKeyword(false);
                      setSelectedAttrKeywordIds([]);
                      setSelectedHashtagIds([]);
                      setSelectedGiftTiers([]);
                      setSelectedGrades([]);
                      setTagOperator("OR");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    필터 초기화
                  </button>
                  <button
                    onClick={saveFavorite}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm"
                  >
                    즐겨찾기 저장
                  </button>
                </div>
                
                {/* 즐겨찾기 목록 */}
                <div className="mb-4">
                  <button
                    onClick={() => setFavoritesOpen(!favoritesOpen)}
                    className="w-full px-4 py-2 bg-[#2a2a2d] hover:bg-[#3a3a3d] rounded text-sm flex items-center justify-between"
                  >
                    <span>즐겨찾기 ({favorites.length})</span>
                    <span className={"transition-transform duration-200 " + (favoritesOpen ? "rotate-90" : "")}>▶</span>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: favoritesOpen ? "1fr" : "0fr" }}>
                    <div className="min-h-0 overflow-hidden">
                    <div className="mt-2 space-y-2">
                      {favorites.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-4">
                          저장된 즐겨찾기가 없습니다.
                        </div>
                      ) : (
                        favorites.map((favorite) => {
                          const favoriteName = (() => {
                            try {
                              const conditions = JSON.parse(favorite.searchJson);
                              return conditions.name || "즐겨찾기 (" + new Date(favorite.createdAt).toLocaleDateString() + ")";
                            } catch {
                              return "즐겨찾기 (" + new Date(favorite.createdAt).toLocaleDateString() + ")";
                            }
                          })();

                          return (
                            <div
                              key={favorite.favoriteId}
                              className="flex items-center gap-2 p-2 bg-[#2a2a2d] rounded text-sm"
                            >
                              {editingFavoriteId === favorite.favoriteId ? (
                                <>
                                  <input
                                    type="text"
                                    value={editingFavoriteName}
                                    onChange={(e) => setEditingFavoriteName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        updateFavorite(favorite.favoriteId, editingFavoriteName);
                                      } else if (e.key === "Escape") {
                                        cancelEditFavorite();
                                      }
                                    }}
                                    className="flex-1 px-2 py-1 bg-[#1a1a1d] text-white rounded text-sm mr-2 min-w-0"
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => updateFavorite(favorite.favoriteId, editingFavoriteName)}
                                      className="bg-green-600 hover:bg-green-500 rounded text-xs whitespace-nowrap min-w-[48px] flex items-center justify-center"
                                      style={{ 
                                        height: '28px', 
                                        lineHeight: '28px', 
                                        padding: '0 0.75rem',
                                        margin: 0,
                                        border: 'none',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      저장
                                    </button>
                                    <button
                                      onClick={cancelEditFavorite}
                                      className="bg-gray-600 hover:bg-gray-500 rounded text-xs whitespace-nowrap min-w-[48px] flex items-center justify-center"
                                      style={{ 
                                        height: '28px', 
                                        lineHeight: '28px', 
                                        padding: '0 0.75rem',
                                        margin: 0,
                                        border: 'none',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      취소
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => applyFavorite(favorite.searchJson)}
                                    className="flex-1 text-left text-yellow-300 hover:text-yellow-200 truncate"
                                    title={favoriteName}
                                  >
                                    {favoriteName}
                                  </button>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => startEditFavorite(favorite.favoriteId, favorite.searchJson)}
                                      className="p-1.5 rounded text-gray-400 hover:bg-white/10 hover:text-gray-300 transition-colors"
                                      title="제목 수정"
                                      aria-label="제목 수정"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteFavorite(favorite.favoriteId)}
                                      className="p-1.5 rounded text-red-400 hover:bg-red-400/20 hover:text-red-300 transition-colors"
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
                            </div>
                          );
                        })
                      )}
                    </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">제목</label>
                    <input
                      type="text"
                      placeholder="제목 검색"
                      value={egogiftSearchText}
                      onChange={(e) => setEgoGiftSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleEgoGiftSearch();
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-2"
                    />
                    <button
                      onClick={handleEgoGiftSearch}
                      className="w-full px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-500 transition-colors"
                    >
                      검색
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">키워드</label>
                    <div className="flex flex-wrap gap-2">
                      {keywordCategories.length > 0 ? (
                        <>
                          {keywordCategories.map((kw) => (
                            <button
                              key={kw.keywordId}
                              onClick={() => {
                                const exists = selectedKeywordIds.includes(kw.keywordId);
                                const newIds = exists
                                  ? selectedKeywordIds.filter((id) => id !== kw.keywordId)
                                  : [...selectedKeywordIds, kw.keywordId];
                                setSelectedKeywordIds(newIds);
                                setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                              }}
                              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                                selectedKeywordIds.includes(kw.keywordId)
                                  ? "bg-yellow-400 text-black font-semibold"
                                  : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                              }`}
                            >
                              {keywordIconMap[kw.keywordName] && (
                                <img
                                  src={keywordIconMap[kw.keywordName]}
                                  alt={kw.keywordName}
                                  className="w-3 h-3 object-contain"
                                />
                              )}
                              {kw.keywordName}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setIncludeUniversalKeyword(!includeUniversalKeyword);
                              setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                            }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              includeUniversalKeyword
                                ? "bg-yellow-400 text-black font-semibold"
                                : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                            }`}
                          >
                            범용
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">로딩 중...</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">속성</label>
                    <div className="flex flex-wrap gap-2">
                      {attrKeywords.length > 0 ? (
                        attrKeywords.map((kw) => (
                          <button
                            key={kw.keywordId}
                            onClick={() => {
                              const exists = selectedAttrKeywordIds.includes(kw.keywordId);
                              const newIds = exists
                                ? selectedAttrKeywordIds.filter((id) => id !== kw.keywordId)
                                : [...selectedAttrKeywordIds, kw.keywordId];
                              setSelectedAttrKeywordIds(newIds);
                              setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                            }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              selectedAttrKeywordIds.includes(kw.keywordId)
                                ? "bg-yellow-400 text-black font-semibold"
                                : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                            }`}
                          >
                            {kw.keywordName}
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">로딩 중...</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">등급</label>
                    <div className="flex gap-1.5 flex-nowrap">
                      {[
                        { name: "전체", value: "" },
                        { name: "Ⅰ", value: "1" },
                        { name: "Ⅱ", value: "2" },
                        { name: "Ⅲ", value: "3" },
                        { name: "Ⅳ", value: "4" },
                        { name: "Ⅴ", value: "5" },
                        { name: "EX", value: "EX" },
                      ].map((tier) => (
                        <button
                          key={tier.value}
                          onClick={() => {
                            if (!tier.value) {
                              setSelectedGiftTiers([]);
                            } else {
                              const exists = selectedGiftTiers.includes(tier.value);
                              const newTiers = exists
                                ? selectedGiftTiers.filter((v) => v !== tier.value)
                                : [...selectedGiftTiers, tier.value];
                              setSelectedGiftTiers(newTiers);
                            }
                            setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                          }}
                          className={`flex-1 px-1.5 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
                            tier.value && selectedGiftTiers.includes(tier.value)
                              ? "bg-yellow-400 text-black font-semibold"
                              : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                          }`}
                        >
                          {tier.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">출현난이도</label>
                    <div className="flex gap-2">
                      {[
                        { value: "N", label: "노말", color: "text-green-200" },
                        { value: "H", label: "하드", color: "text-pink-200" },
                        { value: "E", label: "익스트림", color: "text-red-400" },
                      ].map((grade) => (
                        <button
                          key={grade.value}
                          onClick={() => {
                            const newGrades = selectedGrades.includes(grade.value)
                              ? selectedGrades.filter((g) => g !== grade.value)
                              : [...selectedGrades, grade.value];
                            setSelectedGrades(newGrades);
                            setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                          }}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            selectedGrades.includes(grade.value)
                              ? "bg-yellow-400 text-black"
                              : `bg-[#2a2a2d] ${grade.color} hover:bg-[#3a3a3d]`
                          }`}
                        >
                          {grade.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative" ref={hashtagDropdownRef}>
                    <button
                      onClick={() => setHashtagsOpen(!hashtagsOpen)}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-gray-300 rounded hover:bg-[#3a3a3d] text-sm flex items-center justify-between relative z-10"
                    >
                      <span>해시태그</span>
                      <span className={`transition-transform duration-200 ${hashtagsOpen ? "rotate-90" : ""}`}>▶</span>
                    </button>
                    {/* embedded일 때는 포탈로만 렌더, 아닐 때는 인라인 */}
                    {!(embedded && hashtagsOpen) && (
                    <div
                      data-dropdown-container
                      className={`absolute transition-all duration-300 ease-in-out ${
                        hashtagsOpen
                          ? "opacity-100 visible md:mt-0 md:ml-2 md:left-full"
                          : "opacity-0 invisible max-h-0 pointer-events-none"
                      } left-0 w-full md:w-[400px]`}
                      style={{ zIndex: 10001 }}
                    >
                      <HashtagDropdownPanel
                        contentRef={hashtagDropdownContentRef}
                        groupedHashtags={groupedHashtags}
                        selectedHashtagIds={selectedHashtagIds}
                        setSelectedHashtagIds={setSelectedHashtagIds}
                        tagOperator={tagOperator}
                        setTagOperator={setTagOperator}
                        egogiftFilters={egogiftFilters}
                        egogiftSearchText={egogiftSearchText}
                        setEgoGiftFilters={setEgoGiftFilters}
                        getCategoryDisplayName={getCategoryDisplayName}
                      />
                    </div>
                    )}
                    
                    {/* 선택된 해시태그 표시 */}
                    {selectedHashtagIds.length > 0 && (
                      <div className="mt-2 relative" style={{ zIndex: 1, position: 'relative' }}>
                        <div className="text-xs text-gray-400 mb-1.5 font-semibold">선택된 해시태그</div>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedHashtagIds.map((tagId) => {
                            const tag = allHashtags.find((t) => t.tagId === tagId);
                            if (!tag) return null;
                            return (
                              <button
                                key={tagId}
                                onClick={() => {
                                  const newIds = selectedHashtagIds.filter((id) => id !== tagId);
                                  setSelectedHashtagIds(newIds);
                                  setEgoGiftFilters({ ...egogiftFilters, giftName: egogiftSearchText });
                                }}
                                className="px-2 py-1 text-xs rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition-colors text-left truncate"
                                title={tag.tagName}
                              >
                                {tag.tagName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 결과 */}
            <div className="flex-1 order-2 md:order-2 relative z-0">
              {/* 부드러운 페이드인 결과 영역 */}
              {egogifts.length === 0 && !egogiftLoading ? (
                <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-8 text-center text-gray-400 fade-in-soft">
                  등록된 에고기프트가 없습니다.
                </div>
              ) : (
                <div className={`fade-in-soft ${egogiftLoading ? "opacity-60" : "opacity-100"} transition-opacity`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-6">
                    {egogifts.map((egogift) => (
                      <div
                        key={egogift.egogiftId}
                        onClick={async () => {
                          const res = await fetch(`${API_BASE_URL}/user/egogift/${egogift.egogiftId}`, {
                            credentials: "include",
                          });
                          if (res.ok) {
                            const data = await res.json();
                            handleEgoGiftClick(data.egogift.giftName);
                            setPreviewHashtags(data.tags || []);
                          }
                        }}
                        className="rounded p-3 cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-yellow-400 transition-all duration-200 bg-[#131316] border border-[#b8860b]/40"
                      >
                        <div className="relative aspect-square mb-2">
                          <img
                            src="/images/egogift/egogift_frame.webp"
                            alt="frame"
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                          />

                          {/* 즐겨찾기 별 (onStarClick 있을 때만 표시) */}
                          {onStarClick && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStarClick(egogift.egogiftId);
                              }}
                              className="absolute top-1 right-1 z-30 w-16 h-16 md:w-[51px] md:h-[51px] flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                              title={starredEgoGiftIds.includes(egogift.egogiftId) ? "즐겨찾기 해제" : "즐겨찾기"}
                            >
                              <svg
                                className={`w-10 h-10 md:w-8 md:h-8 ${starredEgoGiftIds.includes(egogift.egogiftId) ? "text-yellow-400 fill-yellow-400" : "text-gray-400 fill-none"}`}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            </button>
                          )}

                          <div className="absolute top-1 -left-3 z-20 text-[#ffcc33] scale-x-[0.65] text-5xl drop-shadow-[0_0_5px_rgba(0,0,0,0.9)] select-none tracking-tight leading-none font-black">
                            {formatEgoGiftTierDisplay(egogift.giftTier)}
                          </div>

                          {egogift.keywordId != null &&
                            egogift.keywordId !== 0 &&
                            egogift.keywordName &&
                            (() => {
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
                            const keywordIcon = iconMap[egogift.keywordName];
                            return keywordIcon ? (
                              <div className="absolute bottom-[5px] right-[0px] w-9 h-9 z-20 drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]">
                                <img
                                  src={keywordIcon}
                                  alt={egogift.keywordName}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : null;
                          })()}

                          {egogift.thumbnail ? (
                            <img
                              src={`${baseUrl}${egogift.thumbnail}`}
                              alt={egogift.giftName}
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
                        <div className="text-base text-center text-gray-300 font-medium space-y-0.5">
                          <div className="truncate">{egogift.giftName}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* 로딩 오버레이 (기존 내용 위에서 부드럽게 표시) */}
              {egogiftLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-4 py-2 rounded bg-black/70 border border-[#b8860b]/40 text-gray-300 text-sm fade-in-soft">
                    로딩 중...
                  </div>
                </div>
              )}
            </div>
          </div>
  );
  return (
    <>
      {embedded ? flexRow : (
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-8">
            {flexRow}
          </div>
        </div>
      )}

      {/* 에고기프트 미리보기 모달 */}
      {egogiftPreviewOpen && egogiftPreviewData && typeof window !== "undefined" && createPortal(
        <EgoGiftPreview
          giftName={egogiftPreviewData.egogift.giftName}
          giftTier={egogiftPreviewData.egogift.giftTier}
          keywordId={
            egogiftPreviewData.egogift.keywordId !== null && egogiftPreviewData.egogift.keywordId !== undefined
              ? String(egogiftPreviewData.egogift.keywordId) 
              : egogiftPreviewData.keyword 
                ? String(egogiftPreviewData.keyword.keywordId) 
                : "0"
          }
          attrKeywordId={egogiftPreviewData.egogift.attrKeywordId}
          cost={String(egogiftPreviewData.egogift.cost)}
          enhanceYn={egogiftPreviewData.egogift.enhanceYn}
          synthesisYn={egogiftPreviewData.egogift.synthesisYn}
          curseBlessCd={normalizeCurseBlessCd(
            egogiftPreviewData.egogift.curseBlessCd ??
              (egogiftPreviewData.egogift as { curse_bless_cd?: unknown }).curse_bless_cd
          )}
          grades={egogiftPreviewData.egogift.grades || []}
          desc1={egogiftPreviewData.egogift.desc1 || ""}
          desc2={egogiftPreviewData.egogift.desc2 || ""}
          desc3={egogiftPreviewData.egogift.desc3 || ""}
          selectedTagIds={egogiftPreviewData.egogift.tagIds || []}
          file={null}
          existingFile={egogiftPreviewData.thumbnail || undefined}
          keywords={keywords}
          hashtags={previewHashtags}
          allKeywords={allKeywords}
          allEgoGiftsForHighlight={allEgoGifts}
          egogiftId={egogiftPreviewData.egogift.egogiftId}
          recipes={egogiftRecipe}
          obtainableEvents={egogiftPreviewData?.obtainableEvents || []}
          limitedCategoryName={egogiftPreviewData?.limitedCategoryName || null}
          cardPackAppearances={egogiftPreviewData?.cardPackAppearances || []}
          onEgoGiftClick={(giftName) => handleEgoGiftClick(giftName)}
          onEgoGiftClickById={handleEgoGiftClickById}
          onClose={closeEgoGiftModal}
        />,
        document.body
      )}

      {/* embedded일 때 해시태그 드롭다운을 body에 포탈 */}
      {embedded && hashtagsOpen && hashtagDropdownPosition && typeof window !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: hashtagDropdownPosition.top,
            left: hashtagDropdownPosition.left,
            width: hashtagDropdownPosition.width,
            zIndex: 10001,
          }}
        >
          <HashtagDropdownPanel
            contentRef={hashtagDropdownContentRef}
            groupedHashtags={groupedHashtags}
            selectedHashtagIds={selectedHashtagIds}
            setSelectedHashtagIds={setSelectedHashtagIds}
            tagOperator={tagOperator}
            setTagOperator={setTagOperator}
            egogiftFilters={egogiftFilters}
            egogiftSearchText={egogiftSearchText}
            setEgoGiftFilters={setEgoGiftFilters}
            getCategoryDisplayName={getCategoryDisplayName}
          />
        </div>,
        document.body
      )}
    </>
  );
}

export default function EgoGiftPage() {
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
      <div className="absolute inset-0 bg-black/60 z-0" />
      <EgoGiftPageContent />
    </div>
  );
}




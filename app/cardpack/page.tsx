"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api";
import EgoGiftPreview from "@/app/dante/(admin)/egogift/components/EgoGiftPreview";
import KeywordHighlight from "@/components/KeywordHighlight";
import EnemyPreview from "@/components/EnemyPreview";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

interface CardPack {
  cardpackId: number;
  title: string;
  floors: number[];
  difficulties: string[]; // 여러 난이도 지원
  themeType?: number; // 테마 타입 (1~7)
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

interface DifficultyFloor {
  difficulty: string;
  floors: number[];
}

interface FileInfo {
  fileId: number;
  path: string;
  originalName: string;
  storedName: string;
}

interface CardPackDetail {
  cardpackId: number;
  title: string;
  difficultyFloors: DifficultyFloor[];
  thumbnail?: FileInfo;
  createdAt: string;
  updatedAt: string;
}

interface UniqueEgoGift {
  egogiftId: number;
  giftName: string;
  thumbnailPath?: string;
  grades?: string[]; // 출현난이도
}

interface UniqueChoice {
  eventId: number;
  title: string;
  thumbnailPath?: string;
}

interface UniqueEnemy {
  enemyId: number;
  name: string;
  imagePath?: string;
}

interface EgoGiftCategory {
  categoryId: number;
  categoryName: string;
  egogifts: Array<{
    egogiftId: number;
    giftName: string;
    thumbnailPath?: string;
    grades?: string[];
  }>;
}

export interface CardPackPageContentProps {
  /** 즐겨찾기 페이지 등에서 검색 조건 위에 붙일 노드 */
  slotAboveSearch?: React.ReactNode;
  /** true면 다른 페이지에 삽입 시 레이아웃 조정 */
  embedded?: boolean;
  /** 즐겨찾기용: 선택된 카드팩 ID 목록 (별 채움 표시) */
  starredCardPackIds?: number[];
  /** 즐겨찾기용: 별 클릭 시 호출 (cardpackId) */
  onStarClick?: (cardpackId: number) => void;
  /** 즐겨찾기 결과 탭에서 카드팩 클릭 시 상세 모달 열기용 (cardpackId 전달) */
  openCardPackDetailRef?: React.MutableRefObject<{ open: (cardpackId: number) => void } | null>;
}

export function CardPackPageContent({
  slotAboveSearch,
  embedded,
  starredCardPackIds = [],
  onStarClick,
  openCardPackDetailRef,
}: CardPackPageContentProps) {
  const [allCardPacks, setAllCardPacks] = useState<CardPack[]>([]); // 전체 목록 (필터링 전)
  const [loading, setLoading] = useState(false);
  
  // 검색 필터
  const [titleSearch, setTitleSearch] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [selectedThemeType, setSelectedThemeType] = useState<number | null>(null);
  const [selectedEgoGiftIds, setSelectedEgoGiftIds] = useState<number[]>([]);
  const [egogiftsOpen, setEgoGiftsOpen] = useState(false);
  const [egogiftSearchText, setEgoGiftSearchText] = useState("");
  const [egogiftFilterLoading, setEgoGiftFilterLoading] = useState(false);
  // 에고기프트 필터용: 키워드별 그룹
  const [egogiftKeywordGroupsForFilter, setEgoGiftKeywordGroupsForFilter] = useState<
    Array<{
      keywordKey: string; // 키워드명 (없으면 '기타')
      egogifts: Array<{ egogiftId: number; giftName: string }>;
    }>
  >([]);
  const [cardpackToEgoGiftIds, setCardpackToEgoGiftIds] = useState<Map<number, Set<number>>>(new Map());
  const [egogiftIndexBuilt, setEgoGiftIndexBuilt] = useState(false); // 인덱스 구축 완료 여부
  const egogiftIndexBuildingRef = useRef(false); // 인덱스 구축 중 여부 (중복 실행 방지)
  const initialDataLoadedRef = useRef(false); // 초기 데이터 로딩 완료 여부 (중복 호출 방지)
  const egogiftDropdownRef = useRef<HTMLDivElement>(null);
  const egogiftDropdownContentRef = useRef<HTMLDivElement>(null);
  const searchConditionsRef = useRef<HTMLDivElement>(null);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardPackId, setSelectedCardPackId] = useState<number | null>(null);
  const [cardPackDetail, setCardPackDetail] = useState<CardPackDetail | null>(null);
  const [uniqueEgoGifts, setUniqueEgoGifts] = useState<UniqueEgoGift[]>([]);
  const [uniqueChoices, setUniqueChoices] = useState<UniqueChoice[]>([]);
  const [uniqueEnemies, setUniqueEnemies] = useState<UniqueEnemy[]>([]);
  const [egoGiftCategories, setEgoGiftCategories] = useState<EgoGiftCategory[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEgoGiftListExpanded, setIsEgoGiftListExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // 에고기프트 모달 상태
  const [egogiftPreviewData, setEgoGiftPreviewData] = useState<any>(null);
  const [egogiftPreviewOpen, setEgoGiftPreviewOpen] = useState(false);
  const [egogiftRecipe, setEgoGiftRecipe] = useState<any>(null);
  const [previewKeywords, setPreviewKeywords] = useState<any[]>([]);
  const [previewHashtags, setPreviewHashtags] = useState<any[]>([]);
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]);
  
  // 적 미리보기 모달 상태
  const [enemyPreviewData, setEnemyPreviewData] = useState<any>(null);
  const [enemyPreviewOpen, setEnemyPreviewOpen] = useState(false);
  const [allEgoGifts, setAllEgoGifts] = useState<
    Array<{
      egogiftId: number;
      giftName: string;
      giftTier?: string;
      thumbnailPath?: string;
      keywordId?: number | null;
      keywordName?: string | null;
      desc1?: string;
      desc2?: string;
      desc3?: string;
    }>
  >([]);

  // 던전 이벤트 모달 상태
  const [previewEvent, setPreviewEvent] = useState<any>(null);
  const [previewEventOpen, setPreviewEventOpen] = useState(false);
  const [openedNodes, setOpenedNodes] = useState<Set<number>>(new Set());
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const modalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 중복 호출 방지: 이미 로딩이 시작되었거나 완료되었으면 스킵
    if (initialDataLoadedRef.current) {
      return;
    }
    
    initialDataLoadedRef.current = true;
    setIsMounted(true);
    fetchAllCardPacks();
    fetchAllKeywords();
    fetchAllEgoGifts();
  }, []);

  // 에고기프트 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!egogiftsOpen) return;
      const target = event.target as Node;
      const dropdownRef = egogiftDropdownRef.current;
      const dropdownContentRef = egogiftDropdownContentRef.current;

      if (
        dropdownRef &&
        dropdownContentRef &&
        !dropdownRef.contains(target) &&
        !dropdownContentRef.contains(target)
      ) {
        setEgoGiftsOpen(false);
      }
    };

    if (egogiftsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [egogiftsOpen]);

  // 에고기프트 드롭다운 위치 조정 (PC: 검색조건 상단에 맞추기 / 모바일: 버튼 아래)
  useEffect(() => {
    if (egogiftsOpen && searchConditionsRef.current && egogiftDropdownRef.current) {
      const updateLayout = () => {
        if (!searchConditionsRef.current || !egogiftDropdownRef.current) return;

        const isMobile = window.innerWidth < 768; // md breakpoint
        const searchConditionsRect = searchConditionsRef.current.getBoundingClientRect();
        const dropdownButtonRect = egogiftDropdownRef.current.getBoundingClientRect();

        const dropdownContainer = egogiftDropdownRef.current.querySelector(
          "[data-dropdown-container]"
        ) as HTMLElement | null;
        if (!dropdownContainer) return;

        if (isMobile) {
          // 모바일: 버튼 바로 아래로
          const button = egogiftDropdownRef.current.querySelector("button") as HTMLElement | null;
          if (button) {
            const buttonHeight = button.offsetHeight;
            dropdownContainer.style.top = `${buttonHeight}px`;
            dropdownContainer.style.marginTop = "0";
          }
        } else {
          // PC: 검색조건 박스 상단부터 보이도록 위로 끌어올림
          const offsetFromTop = dropdownButtonRect.top - searchConditionsRect.top;
          dropdownContainer.style.top = `-${offsetFromTop}px`;
          dropdownContainer.style.marginTop = "0";
        }
      };

      updateLayout();
      window.addEventListener("resize", updateLayout);
      window.addEventListener("scroll", updateLayout, true);

      return () => {
        window.removeEventListener("resize", updateLayout);
        window.removeEventListener("scroll", updateLayout, true);
      };
    }
  }, [egogiftsOpen]);

  // 전체 키워드 조회 (하이라이팅용)
  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/keyword/all-cached`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywords = data.content || [];
        const enrichedKeywords = keywords.map((k: any) => enrichKeywordData(k));
        setAllKeywords(enrichedKeywords);
      }
    } catch (err) {
      console.error("전체 키워드 목록 조회 실패:", err);
    }
  };

  // 전체 에고기프트 조회 (하이라이팅용)
  const fetchAllEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/egogift?page=0&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const egogiftsData = (data.items || []).map((e: any) => ({
          egogiftId: e.egogiftId,
          giftName: e.giftName,
          giftTier: e.giftTier,
          desc1: e.desc1,
          desc2: e.desc2,
          desc3: e.desc3,
          keywordId: e.keywordId ?? null,
          keywordName: e.keywordName ?? null,
          thumbnailPath: e.thumbnail?.path || undefined,
        }));
        setAllEgoGifts(egogiftsData);
      }
    } catch (err) {
      console.error("전체 에고기프트 목록 조회 실패:", err);
    }
  };

  // 에고기프트 클릭 핸들러
  const handleEgoGiftClick = async (egogiftId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/egogift/${egogiftId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        
        setEgoGiftPreviewData(data);
        setEgoGiftPreviewOpen(true);
        
        if (data.keyword) {
          setPreviewKeywords([{
            keywordId: data.keyword.keywordId,
            keywordName: data.keyword.keywordName,
            categoryName: data.keyword.categoryName || "",
          }]);
        }
        
        if (data.tags) {
          setPreviewHashtags(data.tags);
        }
        
        // 조합식 정보 가져오기
        if (data.egogift?.egogiftId) {
          try {
            const recipeRes = await fetch(`${API_BASE_URL}/user/egogift/${data.egogift.egogiftId}/recipe`, {
              credentials: "include",
            });
            if (recipeRes.ok) {
              const recipeData = await recipeRes.json();
              setEgoGiftRecipe(recipeData.recipes || []);
            }
          } catch (err) {
            setEgoGiftRecipe(null);
          }
        }
      }
    } catch (err) {
      console.error("에고기프트 상세 조회 실패:", err);
    }
  };

  const closeEgoGiftModal = () => {
    setEgoGiftPreviewOpen(false);
    setEgoGiftRecipe(null);
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isModalOpen]);

  const fetchAllCardPacks = async () => {
    try {
      setLoading(true);
      // 카드팩은 최대 50~100개 수준이라 1000이면 충분
      const res = await fetch(`${API_BASE_URL}/user/cardpack?page=1&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAllCardPacks(data.items || []);
      }
    } catch (err) {
      console.error("카드팩 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildEgoGiftFilterIndex = async (cardpacks: CardPack[]) => {
    // 이미 구축되었거나 구축 중이면 스킵
    if (egogiftIndexBuilt || egogiftIndexBuildingRef.current) {
      return;
    }

    if (!cardpacks || cardpacks.length === 0) {
      setEgoGiftKeywordGroupsForFilter([]);
      setCardpackToEgoGiftIds(new Map());
      setEgoGiftIndexBuilt(true);
      return;
    }

    try {
      egogiftIndexBuildingRef.current = true;
      setEgoGiftFilterLoading(true);

      // 배치 API로 한 번에 모든 데이터 가져오기
      const [egogiftsRes, mappingsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/cardpack/egogifts-for-filter`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/user/cardpack/egogift-mappings`, {
          credentials: "include",
        }),
      ]);

      if (!egogiftsRes.ok || !mappingsRes.ok) {
        console.error("에고기프트 필터 데이터 조회 실패");
        return;
      }

      const egogiftsData = await egogiftsRes.json();
      const mappingsData = await mappingsRes.json();

      const egogiftItems = egogiftsData.items || [];
      const mappings = mappingsData.items || [];

      // 키워드별로 그룹화
      const keywordMap = new Map<string, Map<number, string>>();
      for (const item of egogiftItems) {
        const egogiftId = Number(item.egogiftId);
        const giftName = String(item.giftName || "");
        const keywordName = String(item.keywordName || "기타").trim() || "기타";

        if (!egogiftId || !giftName) continue;

        if (!keywordMap.has(keywordName)) {
          keywordMap.set(keywordName, new Map<number, string>());
        }
        keywordMap.get(keywordName)!.set(egogiftId, giftName);
      }

      // 카드팩별 에고기프트 ID 매핑 구성
      const cardpackMap = new Map<number, Set<number>>();
      for (const mapping of mappings) {
        const cardpackId = Number(mapping.cardpackId);
        const egogiftIds = (mapping.egogiftIds || []).map((id: any) => Number(id));
        if (cardpackId && egogiftIds.length > 0) {
          cardpackMap.set(cardpackId, new Set(egogiftIds));
        }
      }

      // 키워드/에고기프트 정렬
      const groups = Array.from(keywordMap.entries())
        .map(([keywordKey, gifts]) => ({
          keywordKey,
          egogifts: Array.from(gifts.entries())
            .map(([egogiftId, giftName]) => ({ egogiftId, giftName }))
            .sort((a, b) => a.giftName.localeCompare(b.giftName, "ko")),
        }))
        // 키워드 그룹 순서 고정: 화상~범용, 그 외는 뒤, '기타'는 맨 아래
        .sort((a, b) => {
          const order = [
            "화상",
            "색욕",
            "진동",
            "파열",
            "침잠",
            "호흡",
            "충전",
            "참격",
            "관통",
            "타격",
            "범용",
          ];

          const aKey = a.keywordKey;
          const bKey = b.keywordKey;

          if (aKey === "기타") return 1;
          if (bKey === "기타") return -1;

          const aIdx = order.indexOf(aKey);
          const bIdx = order.indexOf(bKey);

          // 둘 다 지정 순서에 있으면 그 순서대로
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          // 하나만 있으면 지정 순서가 먼저
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;

          // 둘 다 없으면 이름순
          return aKey.localeCompare(bKey, "ko");
        });

      setEgoGiftKeywordGroupsForFilter(groups);
      setCardpackToEgoGiftIds(cardpackMap);
      setEgoGiftIndexBuilt(true);
    } catch (err) {
      console.error("에고기프트 필터 인덱스 구축 실패:", err);
    } finally {
      setEgoGiftFilterLoading(false);
      egogiftIndexBuildingRef.current = false;
    }
  };

  // 에고기프트 필터 드롭다운이 열릴 때만 인덱스 구축 (lazy loading)
  useEffect(() => {
    if (egogiftsOpen && !egogiftIndexBuilt && !egogiftIndexBuildingRef.current) {
      // 카드팩 목록이 로드된 후에만 인덱스 구축
      if (allCardPacks.length > 0) {
        buildEgoGiftFilterIndex(allCardPacks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egogiftsOpen, allCardPacks]);

  // 프론트에서 필터링 처리 (제목, 난이도, 층수, 테마 타입)
  const filteredCardPacks = useMemo(() => {
    let filtered = [...allCardPacks];

    // 제목 검색
    if (titleSearch && titleSearch.trim()) {
      const searchLower = titleSearch.trim().toLowerCase();
      filtered = filtered.filter((cp) =>
        cp.title.toLowerCase().includes(searchLower)
      );
    }

    // 난이도 필터
    if (selectedDifficulty) {
      filtered = filtered.filter((cp) => {
        const diffs = cp.difficulties || [];
        // 레거시 데이터 호환: '평행중첩'을 '익스트림'으로 취급
        if (selectedDifficulty === "익스트림") {
          return diffs.includes("익스트림") || diffs.includes("평행중첩");
        }
        return diffs.includes(selectedDifficulty);
      });
    }

    // 층수 필터 (선택한 층 중 하나라도 해당하면 포함)
    if (selectedFloors.length > 0) {
      filtered = filtered.filter((cp) =>
        cp.floors && cp.floors.some((floor) => selectedFloors.includes(floor))
      );
    }

    // 테마 타입 필터
    if (selectedThemeType !== null) {
      filtered = filtered.filter((cp) => cp.themeType === selectedThemeType);
    }

    // 에고기프트 필터 (선택된 에고기프트 중 하나라도 포함된 카드팩만)
    if (selectedEgoGiftIds.length > 0) {
      filtered = filtered.filter((cp) => {
        const set = cardpackToEgoGiftIds.get(cp.cardpackId) || new Set<number>();
        return selectedEgoGiftIds.some((id) => set.has(id));
      });
    }

    return filtered;
  }, [allCardPacks, titleSearch, selectedDifficulty, selectedFloors, selectedThemeType, selectedEgoGiftIds, cardpackToEgoGiftIds]);

  const handleSearch = () => {
    setTitleSearch(titleInput);
  };

  const handleReset = () => {
    setTitleSearch("");
    setTitleInput("");
    setSelectedDifficulty(null);
    setSelectedFloors([]);
    setSelectedThemeType(null);
    setSelectedEgoGiftIds([]);
    setEgoGiftsOpen(false);
    setEgoGiftSearchText("");
  };

  const handleFloorToggle = (floor: number) => {
    setSelectedFloors((prev) =>
      prev.includes(floor)
        ? prev.filter((f) => f !== floor)
        : [...prev, floor]
    );
  };

  const difficultyOptions = [
    { value: "노말", label: "노말", color: "text-green-200" },
    { value: "하드", label: "하드", color: "text-pink-200" },
    { value: "익스트림", label: "익스트림", color: "text-red-400" },
  ];

  const floorOptions = Array.from({ length: 15 }, (_, i) => i + 1);

  const baseUrl = API_BASE_URL.replace("/api", "");

  const handleCardPackClick = async (cardpackId: number) => {
    setSelectedCardPackId(cardpackId);
    setIsModalOpen(true);
    setIsEgoGiftListExpanded(false);
    // 기존 데이터 초기화
    setCardPackDetail(null);
    setUniqueEgoGifts([]);
    setUniqueChoices([]);
    setUniqueEnemies([]);
    setEgoGiftCategories([]);
    await fetchCardPackDetail(cardpackId);
  };

  const fetchCardPackDetail = async (cardpackId: number) => {
    try {
      setDetailLoading(true);
      
      // 기본 정보 조회
      const res = await fetch(`${API_BASE_URL}/user/cardpack/${cardpackId}`, {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setCardPackDetail(data);
      } else {
        console.error("카드팩 기본 정보 조회 실패:", res.status, res.statusText);
        // 기본 정보 조회 실패해도 모달은 열어둠
      }
        
      // 고유 선택지 조회 (한 번의 API 호출로 모든 정보 가져오기)
      try {
        const eventsRes = await fetch(`${API_BASE_URL}/user/cardpack/${cardpackId}/events`, {
          credentials: "include",
        });
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const events = eventsData.items || [];
          setUniqueChoices(events.map((e: any) => ({
            eventId: e.eventId,
            title: e.title,
            thumbnailPath: e.thumbnailPath,
          })));
        }
      } catch (err) {
        console.error("고유 선택지 조회 실패:", err);
      }

      // 고유 에고기프트 및 출현 에고기프트 카테고리 조회
      try {
        const egogiftsRes = await fetch(`${API_BASE_URL}/user/cardpack/${cardpackId}/egogifts`, {
          credentials: "include",
        });
        
        if (egogiftsRes.ok) {
          const egogiftsData = await egogiftsRes.json();
          const egogifts = egogiftsData.items || [];
          
          // 백엔드에서 이미 grades 정보를 포함해서 반환하므로 바로 사용
          // limited_yn = 'Y'인 것과 그렇지 않은 것으로 분리
          const uniqueEgoGifts = egogifts
            .filter((egogift: any) => egogift.limitedYn === "Y")
            .map((egogift: any) => ({
              egogiftId: egogift.egogiftId,
              giftName: egogift.giftName,
              thumbnailPath: egogift.thumbnailPath,
              grades: egogift.grades || [],
            }));
          
          // 일반 에고기프트는 카테고리별로 그룹화
          // 출현 에고기프트 목록은 카테고리 구분 없이 flatMap으로 펼쳐서 표시하므로
          // 같은 에고기프트가 여러 카테고리에 속해있으면 중복이 발생할 수 있음
          // 따라서 전체 출현 에고기프트에서 egogiftId 기준으로 중복 제거 후 카테고리별로 그룹화
          const regularEgoGifts = egogifts.filter((egogift: any) => egogift.limitedYn !== "Y");
          
          // 출현 에고기프트 전체에서 egogiftId 기준으로 중복 제거
          const seenEgoGiftIds = new Set<number>();
          const deduplicatedRegularEgoGifts = regularEgoGifts.filter((egogift: any) => {
            if (seenEgoGiftIds.has(egogift.egogiftId)) {
              return false;
            }
            seenEgoGiftIds.add(egogift.egogiftId);
            return true;
          });
          
          // 중복 제거된 에고기프트를 카테고리별로 그룹화
          const categoryMap: Record<number, EgoGiftCategory> = {};
          deduplicatedRegularEgoGifts.forEach((egogift: any) => {
            const categoryId = egogift.egogiftCategoryId;
            if (!categoryMap[categoryId]) {
              categoryMap[categoryId] = {
                categoryId,
                categoryName: egogift.categoryName,
                egogifts: [],
              };
            }
            categoryMap[categoryId].egogifts.push({
              egogiftId: egogift.egogiftId,
              giftName: egogift.giftName,
              thumbnailPath: egogift.thumbnailPath,
              grades: egogift.grades,
            });
          });
          
          setUniqueEgoGifts(uniqueEgoGifts);
          setEgoGiftCategories(Object.values(categoryMap));
        }
      } catch (err) {
        console.error("에고기프트 목록 조회 실패:", err);
      }

      // 출현 적 조회 (이미지 + 이름)
      try {
        const enemiesRes = await fetch(`${API_BASE_URL}/user/cardpack/${cardpackId}/enemies`, {
          credentials: "include",
        });
        if (enemiesRes.ok) {
          const enemiesData = await enemiesRes.json();
          const enemies = enemiesData.items || [];
          setUniqueEnemies(enemies.map((e: any) => ({
            enemyId: e.enemyId,
            name: e.name,
            imagePath: e.imagePath,
          })));
        }
      } catch (err) {
        console.error("출현 적 조회 실패:", err);
      }
    } catch (err) {
      console.error("카드팩 상세 조회 실패:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCardPackId(null);
    setCardPackDetail(null);
    setUniqueEgoGifts([]);
    setUniqueChoices([]);
    setUniqueEnemies([]);
    setEgoGiftCategories([]);
    setIsEgoGiftListExpanded(false);
  }, []);

  // 즐겨찾기 결과 탭에서 카드팩 클릭 시 상세 모달 열기
  useEffect(() => {
    if (openCardPackDetailRef) {
      openCardPackDetailRef.current = { open: handleCardPackClick };
      return () => {
        openCardPackDetailRef.current = null;
      };
    }
  }, [openCardPackDetailRef, handleCardPackClick]);

  const handleEnemyClick = async (enemyId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/dungeon/enemy/${enemyId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEnemyPreviewData(data);
        setEnemyPreviewOpen(true);
      }
    } catch (err) {
      console.error("적 정보 조회 실패:", err);
    }
  };

  const closeEnemyPreview = () => {
    setEnemyPreviewOpen(false);
    setEnemyPreviewData(null);
  };

  const fetchEventDetail = async (eventId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/dungeon/event/${eventId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewEvent(data);
        setPreviewEventOpen(true);
        setOpenedNodes(new Set());
      }
    } catch (err) {
      console.error("이벤트 상세 조회 실패:", err);
    }
  };

  const handleEventClick = (eventId: number) => {
    fetchEventDetail(eventId);
  };

  const closeEventModal = () => {
    setPreviewEventOpen(false);
    setPreviewEvent(null);
    setOpenedNodes(new Set());
  };

  const renderNodeTree = (parentClientKey: string | null, depth: number = 0): React.ReactNode[] => {
    if (!previewEvent || !previewEvent.nodes) return [];

    const nodeChildren = previewEvent.nodes.filter(
      (n: any) => n.parentClientKey === parentClientKey
    );

    return nodeChildren.map((node: any) => {
      const nodeId = node.nodeId;
      const isOpened = openedNodes.has(nodeId);
      const hasDescription = node.description && node.description.trim() !== "";
      const nodeChildren = previewEvent.nodes.filter(
        (n: any) => n.parentClientKey === node.clientKey
      );

      return (
        <div 
          key={node.clientKey} 
          className="mb-2"
          ref={(el) => {
            if (el) {
              nodeRefs.current.set(nodeId, el);
            } else {
              nodeRefs.current.delete(nodeId);
            }
          }}
        >
          <div
            className={`p-3 rounded cursor-pointer transition-all duration-200 ${
              isOpened 
                ? 'bg-[#1a1a1f] border-2 border-[#ffcc33]/60 shadow-lg shadow-[#ffcc33]/20' 
                : 'bg-[#131316] border border-[#b8860b]/40 hover:bg-[#1b1b1f]'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              const newOpened = new Set(openedNodes);
              if (newOpened.has(nodeId)) {
                newOpened.delete(nodeId);
              } else {
                newOpened.add(nodeId);
                setTimeout(() => {
                  const nodeElement = nodeRefs.current.get(nodeId);
                  if (nodeElement && modalScrollRef.current) {
                    const modalScroll = modalScrollRef.current;
                    const nodeRect = nodeElement.getBoundingClientRect();
                    const modalRect = modalScroll.getBoundingClientRect();
                    const scrollTop = modalScroll.scrollTop;
                    const nodeTop = nodeRect.top - modalRect.top + scrollTop;
                    modalScroll.scrollTo({
                      top: nodeTop - 20,
                      behavior: 'smooth'
                    });
                  }
                }, 100);
              }
              setOpenedNodes(newOpened);
            }}
          >
            <div className="flex items-center gap-2">
              <div className={`text-sm font-semibold ${
                isOpened ? 'text-[#ffcc33]' : 'text-gray-200'
              }`}>
                <KeywordHighlight
                  text={node.title || ""}
                  keywords={allKeywords}
                  egogifts={allEgoGifts}
                  onEgoGiftClick={(giftName) => {
                    const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                    if (egogift) {
                      handleEgoGiftClick(egogift.egogiftId);
                    }
                  }}
                />
              </div>
              {node.subtitle && (
                <div className="text-xs text-gray-400">
                  <KeywordHighlight
                    text={node.subtitle || ""}
                    keywords={allKeywords}
                    egogifts={allEgoGifts}
                    onEgoGiftClick={(giftName) => {
                      const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                      if (egogift) {
                        handleEgoGiftClick(egogift.egogiftId);
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div 
              className={`ml-4 mt-2 space-y-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isOpened ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {hasDescription && (
                <div>
                  <div className="bg-black/30 border border-[#b8860b]/40 rounded p-3 text-xs text-gray-200 whitespace-pre-line">
                    <KeywordHighlight
                      text={node.description || ""}
                      keywords={allKeywords}
                      egogifts={allEgoGifts}
                      onEgoGiftClick={(giftName) => {
                        const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                        if (egogift) {
                          handleEgoGiftClick(egogift.egogiftId);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {nodeChildren.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    {renderNodeTree(node.clientKey, depth + 1)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div 
      className="min-h-screen text-white relative"
      style={{
        backgroundImage: "url('/Yihongyuan_Yard_BG.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed"
      }}
    >
      <div className="absolute inset-0 bg-black/60 z-0"></div>
      
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 검색 조건 (slotAboveSearch 있으면 그 위에 표시) */}
            <div className={"w-full lg:w-72 lg:flex-shrink-0 lg:flex-grow-0 order-1 lg:order-1 space-y-4 " + (embedded ? "lg:sticky lg:top-[120px] lg:self-start" : "")}>
              {slotAboveSearch}
              <div ref={searchConditionsRef} className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 lg:sticky lg:top-20 z-[100] overflow-visible">
                <h2 className="text-lg font-semibold text-yellow-300 mb-4">검색 조건</h2>
                
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm mb-4"
                >
                  필터 초기화
                </button>

                <div className="space-y-4">
                  {/* 제목 검색 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">제목 검색</label>
                    <input
                      type="text"
                      placeholder="카드팩 제목으로 검색..."
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-2"
                    />
                    <button
                      onClick={handleSearch}
                      className="w-full px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-500 transition-colors"
                    >
                      검색
                    </button>
                  </div>

                  {/* 카드팩 테마 필터 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">카드팩 테마</label>
                    <div className="space-y-2">
                      {/* 전체: 한 줄 전체 차지 */}
                      <button
                        onClick={() => setSelectedThemeType(null)}
                        className={`w-full px-3 py-1.5 rounded text-sm transition-colors ${
                          selectedThemeType === null
                            ? "bg-yellow-400 text-black font-semibold"
                            : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                        }`}
                      >
                        전체
                      </button>
                      {/* 개별 테마: 1줄에 2개 (여유 공간 확보) */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 1, label: "주요 이야기" },
                          { value: 2, label: "그 밖의 이야기" },
                          { value: 3, label: "공격 유형" },
                          { value: 4, label: "죄악 속성" },
                          { value: 5, label: "키워드 속성" },
                          { value: 6, label: "익스트림" },
                          { value: 7, label: "기간한정" },
                        ].map((item) => (
                          <button
                            key={item.value}
                            onClick={() =>
                              setSelectedThemeType((prev) =>
                                prev === item.value ? null : item.value
                              )
                            }
                            className={`px-2.5 py-1.5 rounded text-xs whitespace-nowrap text-center transition-colors ${
                              selectedThemeType === item.value
                                ? "bg-yellow-400 text-black font-semibold"
                                : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 에고기프트 필터 (펼치기 가능 + 검색 가능) */}
                  <div className="relative" ref={egogiftDropdownRef}>
                    <button
                      onClick={() => {
                        const willOpen = !egogiftsOpen;
                        setEgoGiftsOpen(willOpen);
                        if (!willOpen) {
                          setEgoGiftSearchText("");
                        }
                        // 드롭다운이 열릴 때 인덱스가 없으면 구축 시작 (useEffect에서 처리되지만 명시적으로 트리거)
                        if (willOpen && !egogiftIndexBuilt && !egogiftIndexBuildingRef.current && allCardPacks.length > 0) {
                          buildEgoGiftFilterIndex(allCardPacks);
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-gray-300 rounded hover:bg-[#3a3a3d] text-sm flex items-center justify-between relative z-10"
                    >
                      <span className="flex items-center gap-2">
                        <span>에고기프트</span>
                        {selectedEgoGiftIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-yellow-400 text-black text-xs font-semibold">
                            {selectedEgoGiftIds.length}
                          </span>
                        )}
                      </span>
                      <span className={`transition-transform duration-200 ${egogiftsOpen ? "rotate-90" : ""}`}>▶</span>
                    </button>
                    <div
                      data-dropdown-container
                      className={`absolute transition-all duration-300 ease-in-out ${
                        egogiftsOpen
                          ? "opacity-100 visible md:ml-2 md:left-full"
                          : "opacity-0 invisible max-h-0 pointer-events-none"
                      } left-0 w-full top-full mt-2 md:top-0 md:mt-0 md:w-[420px]`}
                      style={{ zIndex: 10001 }}
                    >
                      <div
                        ref={egogiftDropdownContentRef}
                        className="p-0 bg-[#2a2a2d] border border-[#b8860b]/40 rounded overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shadow-lg max-h-[500px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 검색영역: 펼치기 영역 최상단에 딱 붙도록 (패딩/틈 제거) */}
                        <div className="sticky top-0 z-20 w-full bg-[#2a2a2d] rounded-t border-b border-[#b8860b]/30 p-3">
                          <input
                            type="text"
                            placeholder="에고기프트 검색..."
                            value={egogiftSearchText}
                            onChange={(e) => setEgoGiftSearchText(e.target.value)}
                            className="w-full px-3 py-2 bg-[#1a1a1d] text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="p-3">

                        {egogiftFilterLoading ? (
                          <div className="text-center text-gray-400 text-sm py-4">
                            로딩 중...
                          </div>
                        ) : egogiftKeywordGroupsForFilter.length === 0 ? (
                          <div className="text-center text-gray-500 text-sm py-4">
                            선택 가능한 에고기프트가 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {egogiftKeywordGroupsForFilter
                              .map((group) => {
                                const filteredGifts = group.egogifts.filter((g) => {
                                  if (!egogiftSearchText.trim()) return true;
                                  return g.giftName
                                    .toLowerCase()
                                    .includes(egogiftSearchText.toLowerCase().trim());
                                });

                                if (filteredGifts.length === 0) return null;

                                return (
                                  <div key={group.keywordKey}>
                                    <div className="text-xs font-semibold text-yellow-300 mb-2">
                                      {group.keywordKey}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {filteredGifts.map((g) => {
                                        const selected = selectedEgoGiftIds.includes(g.egogiftId);
                                        return (
                                          <button
                                            key={g.egogiftId}
                                            onClick={() => {
                                              setSelectedEgoGiftIds((prev) => {
                                                const exists = prev.includes(g.egogiftId);
                                                return exists
                                                  ? prev.filter((id) => id !== g.egogiftId)
                                                  : [...prev, g.egogiftId];
                                              });
                                            }}
                                            className={`px-3 py-1.5 text-sm rounded transition-colors text-center break-keep ${
                                              selected
                                                ? "bg-yellow-400 text-black font-semibold"
                                                : "bg-[#1a1a1d] text-gray-300 hover:bg-[#2a2a2d]"
                                            }`}
                                            title={g.giftName}
                                          >
                                            {g.giftName}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                              .filter(Boolean)}

                            {egogiftSearchText.trim() &&
                              egogiftKeywordGroupsForFilter.every((group) =>
                                group.egogifts.every(
                                  (g) =>
                                    !g.giftName
                                      .toLowerCase()
                                      .includes(egogiftSearchText.toLowerCase().trim())
                                )
                              ) && (
                                <div className="text-center text-gray-500 text-sm py-4">
                                  검색 결과가 없습니다.
                                </div>
                              )}
                          </div>
                        )}

                        {selectedEgoGiftIds.length > 0 && (
                          <button
                            onClick={() => setSelectedEgoGiftIds([])}
                            className="mt-3 w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                          >
                            에고기프트 선택 초기화
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 난이도 필터 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">난이도</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedDifficulty(null)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          selectedDifficulty === null
                            ? "bg-yellow-400 text-black font-semibold"
                            : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                        }`}
                      >
                        전체
                      </button>
                      {difficultyOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() =>
                            setSelectedDifficulty((prev) =>
                              prev === option.value ? null : option.value
                            )
                          }
                          className={`px-3 py-1.5 rounded text-sm transition-colors ${
                            selectedDifficulty === option.value
                              ? "bg-yellow-400 text-black font-semibold"
                              : `bg-[#2a2a2d] ${option.color} hover:bg-[#3a3a3d]`
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 층수 필터 */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">층수 (다중 선택 가능)</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setSelectedFloors([])}
                        className={`w-full px-3 py-1.5 rounded text-sm transition-colors ${
                          selectedFloors.length === 0
                            ? "bg-yellow-400 text-black font-semibold"
                            : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                        }`}
                      >
                        전체
                      </button>
                      <div className="grid grid-cols-5 gap-2">
                        {floorOptions.map((floor) => (
                          <button
                            key={floor}
                            onClick={() => handleFloorToggle(floor)}
                            className={`px-2.5 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
                              selectedFloors.includes(floor)
                                ? "bg-yellow-400 text-black font-semibold"
                                : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                            }`}
                          >
                            {floor}층
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 결과 */}
            <div className="flex-1 order-2 lg:order-2 relative">
              {/* 카드팩 목록 */}
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-4 py-2 rounded bg-black/70 border border-[#b8860b]/40 text-gray-300 text-sm">
                    로딩 중...
                  </div>
                </div>
              ) : filteredCardPacks.length === 0 ? (
                <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-8 text-center text-gray-400">
                  검색된 카드팩이 없습니다.
                </div>
              ) : (
                <div className={`${loading ? "opacity-60" : "opacity-100"} transition-opacity`}>
                  <div className="grid grid-cols-2 min-[500px]:grid-cols-2 min-[770px]:grid-cols-3 lg:flex lg:flex-wrap gap-4">
                    {filteredCardPacks.map((cardPack) => (
                      cardPack.thumbnail && (
                        <div
                          key={cardPack.cardpackId}
                          className="cursor-pointer hover:opacity-80 transition-opacity flex justify-center relative"
                          onClick={() => handleCardPackClick(cardPack.cardpackId)}
                        >
                          {/* 즐겨찾기 별 (onStarClick 있을 때만 표시) */}
                          {onStarClick && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStarClick(cardPack.cardpackId);
                              }}
                              className="absolute top-1 right-1 z-30 w-16 h-16 md:w-[51px] md:h-[51px] flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                              title={starredCardPackIds.includes(cardPack.cardpackId) ? "즐겨찾기 해제" : "즐겨찾기"}
                            >
                              <svg
                                className={`w-10 h-10 md:w-8 md:h-8 ${starredCardPackIds.includes(cardPack.cardpackId) ? "text-yellow-400 fill-yellow-400" : "text-gray-400 fill-none"}`}
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
                          <img
                            src={`${baseUrl}${cardPack.thumbnail}`}
                            alt={cardPack.title}
                            className="border border-[#b8860b]/50 rounded"
                            style={{
                              maxHeight: '400px',
                              height: 'auto',
                              width: 'auto',
                              display: 'block',
                              objectFit: 'contain'
                            }}
                            onLoad={(e) => {
                              const img = e.target as HTMLImageElement;
                              const maxHeight = window.innerWidth >= 1024 ? 345.6 : (window.innerWidth >= 768 ? 450 : 400);
                              const naturalWidth = img.naturalWidth;
                              const naturalHeight = img.naturalHeight;
                              if (naturalWidth && naturalHeight) {
                                const aspectRatio = naturalWidth / naturalHeight;
                                const calculatedWidth = maxHeight * aspectRatio;
                                img.style.width = `${calculatedWidth}px`;
                                img.style.height = `${maxHeight}px`;
                              }
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 카드팩 상세 모달 */}
      {isMounted && isModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cardpack-page-detail-title"
          onClick={closeModal}
        >
          <div 
            className="bg-[#131316] border border-[#b8860b]/60 rounded-lg max-w-4xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-300">로딩 중...</div>
              </div>
            ) : cardPackDetail ? (
              <>
                <div className="flex-1 overflow-y-auto relative">
                  <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 px-4 sm:px-6 py-4 z-50 flex justify-between items-center backdrop-blur-sm">
                    <h2 id="cardpack-page-detail-title" className="text-lg sm:text-xl font-bold text-yellow-300">{cardPackDetail.title}</h2>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-white text-3xl leading-none font-bold"
                      title="닫기"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4 sm:p-6 space-y-6">
                    {/* 카드팩 이미지 및 기본 정보 */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-start justify-center">
                        {cardPackDetail.thumbnail ? (
                          <img
                            src={`${baseUrl}${cardPackDetail.thumbnail.path}`}
                            alt={cardPackDetail.title}
                            className="h-[400px] md:h-[450px] lg:h-[345.6px] w-auto object-contain border border-[#b8860b]/50 rounded"
                          />
                        ) : (
                          <div className="w-[220px] h-[400px] md:w-[247px] md:h-[450px] lg:w-[190.3px] lg:h-[345.6px] flex items-center justify-center border border-dashed border-[#b8860b]/50 rounded text-xs text-gray-500">
                            이미지 없음
                          </div>
                        )}
                      </div>
                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold text-yellow-300 mb-2">출현 난이도</h3>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              // 난이도별 색상 매핑
                              const difficultyColors: Record<string, string> = {
                                "노말": "text-green-200",
                                "하드": "text-pink-200",
                                "익스트림": "text-red-400",
                              };
                              
                              // 난이도 순서 정의 (노말, 하드, 익스트림)
                              const difficultyOrder: Record<string, number> = {
                                "노말": 0,
                                "하드": 1,
                                "익스트림": 2,
                              };
                              
                              // 중복 제거 및 정렬
                              const uniqueDifficulties = Array.from(
                                new Set(cardPackDetail.difficultyFloors.map((df) => df.difficulty))
                              ).sort((a, b) => {
                                const orderA = difficultyOrder[a] ?? 999;
                                const orderB = difficultyOrder[b] ?? 999;
                                return orderA - orderB;
                              });
                              
                              return uniqueDifficulties.map((difficulty) => (
                                <span
                                  key={difficulty}
                                  className={`px-3 py-1 bg-[#2a2a2d] ${difficultyColors[difficulty] || "text-gray-300"} rounded text-sm`}
                                >
                                  {difficulty}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-yellow-300 mb-2">층수</h3>
                          <div className="space-y-2">
                            {(() => {
                              // 난이도별 색상 매핑
                              const difficultyColors: Record<string, string> = {
                                "노말": "text-green-200",
                                "하드": "text-pink-200",
                                "익스트림": "text-red-400",
                              };
                              
                              // 난이도 순서 정의
                              const difficultyOrder: Record<string, number> = {
                                "노말": 0,
                                "하드": 1,
                                "익스트림": 2,
                              };
                              
                              // 난이도별로 정렬
                              const sortedDifficultyFloors = [...cardPackDetail.difficultyFloors].sort((a, b) => {
                                const orderA = difficultyOrder[a.difficulty] ?? 999;
                                const orderB = difficultyOrder[b.difficulty] ?? 999;
                                return orderA - orderB;
                              });
                              
                              return sortedDifficultyFloors.map((df) => (
                                <div key={df.difficulty} className="space-y-1">
                                  <div className="text-xs text-gray-400">
                                    {df.difficulty}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {df.floors.sort((a, b) => a - b).map((floor) => (
                                      <span
                                        key={`${df.difficulty}-${floor}`}
                                        className={`px-3 py-1 bg-[#2a2a2d] ${difficultyColors[df.difficulty] || "text-gray-300"} rounded text-sm`}
                                      >
                                        {floor}층
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 출현 고유 에고기프트 */}
                    {uniqueEgoGifts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 고유 에고기프트
                        </h3>
                        <div className="grid grid-cols-5 md:grid-cols-[repeat(10,minmax(0,1fr))] gap-2 md:gap-3">
                          {uniqueEgoGifts.map((egogift) => {
                            // 난이도에 따른 색상 결정 (우선순위: 익스트림 > 하드 > 노말)
                            const getGradeColor = () => {
                              if (egogift.grades?.includes("E")) {
                                return "border-red-600/50 shadow-[0_0_6px_rgba(252,165,165,0.3)]";
                              } else if (egogift.grades?.includes("H")) {
                                return "border-pink-600/50 shadow-[0_0_6px_rgba(249,168,212,0.3)]";
                              } else if (egogift.grades?.includes("N")) {
                                return "border-green-600/50 shadow-[0_0_6px_rgba(134,239,172,0.3)]";
                              }
                              return "border-transparent";
                            };
                            
                            return (
                            <div 
                              key={egogift.egogiftId} 
                              className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-200 p-1 rounded border-2 ${getGradeColor()}`}
                              onClick={() => handleEgoGiftClick(egogift.egogiftId)}
                            >
                              {/* 이미지 영역 - 프레임 배경 포함 */}
                              <div className="relative w-16 h-16 flex-shrink-0">
                                {/* 프레임 배경 이미지 */}
                                <img
                                  src="/images/egogift/egogift_frame.webp"
                                  alt="frame"
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                                />
                                {/* 에고기프트 이미지 */}
                                {egogift.thumbnailPath ? (
                                  <img
                                    src={`${baseUrl}${egogift.thumbnailPath}`}
                                    alt={egogift.giftName}
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
                              {/* 에고기프트 정보 */}
                              <div className="text-center w-full">
                                <div className="text-white text-xs font-medium break-keep w-full" title={egogift.giftName}>{egogift.giftName}</div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 출현 고유 선택지 */}
                    {uniqueChoices.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 고유 선택지
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {uniqueChoices.map((choice) => (
                            <div
                              key={choice.eventId}
                              className="bg-[#1a1a1a] border border-[#b8860b]/40 rounded p-3 cursor-pointer hover:bg-[#242428] hover:border-[#b8860b]/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                              onClick={() => handleEventClick(choice.eventId)}
                            >
                              {choice.thumbnailPath && (
                                <div className="mb-2 flex items-center justify-center">
                                  <img
                                    src={`${baseUrl}${choice.thumbnailPath}`}
                                    alt={choice.title}
                                    className="max-w-full h-auto max-h-32 object-contain rounded"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="text-sm font-semibold text-gray-200 text-center">
                                {choice.title}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 출현 적 (이미지 + 이름) */}
                    {uniqueEnemies.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 가능 보스
                        </h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-[repeat(8,minmax(0,1fr))] gap-3">
                          {uniqueEnemies.map((enemy) => (
                            <div
                              key={enemy.enemyId}
                              className="flex flex-col items-center gap-2 p-2 bg-[#1a1a1a] border border-[#b8860b]/40 rounded hover:bg-[#242428] hover:border-[#b8860b]/60 transition-all duration-200 cursor-pointer"
                              onClick={() => handleEnemyClick(enemy.enemyId)}
                            >
                              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center overflow-hidden rounded">
                                {enemy.imagePath ? (
                                  <img
                                    src={`${baseUrl}${enemy.imagePath}`}
                                    alt={enemy.name}
                                    className="max-w-full max-h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-[#0f0f0f] flex items-center justify-center text-gray-500 text-xs">
                                    이미지 없음
                                  </div>
                                )}
                              </div>
                              <div className="text-white text-xs font-medium text-center break-keep w-full" title={enemy.name}>
                                {enemy.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 출현 에고기프트 목록 (펼치기 가능) */}
                    {egoGiftCategories.length > 0 && (
                      <div>
                        <button
                          onClick={() => setIsEgoGiftListExpanded(!isEgoGiftListExpanded)}
                          className="w-full flex justify-between items-center text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2 hover:text-yellow-400 transition-colors"
                        >
                          <span>출현 에고기프트 목록</span>
                          <span className="text-xl">
                            {isEgoGiftListExpanded ? "−" : "+"}
                          </span>
                        </button>
                        {isEgoGiftListExpanded && (
                          <div className="grid grid-cols-5 md:grid-cols-[repeat(10,minmax(0,1fr))] gap-2 md:gap-3">
                            {egoGiftCategories.flatMap((category) =>
                              category.egogifts.map((egogift) => {
                                // 난이도에 따른 색상 결정 (우선순위: 익스트림 > 하드 > 노말)
                                const getGradeColor = () => {
                                  if (egogift.grades?.includes("E")) {
                                    return "border-red-600/50 shadow-[0_0_6px_rgba(252,165,165,0.3)]";
                                  } else if (egogift.grades?.includes("H")) {
                                    return "border-pink-600/50 shadow-[0_0_6px_rgba(249,168,212,0.3)]";
                                  } else if (egogift.grades?.includes("N")) {
                                    return "border-green-600/50 shadow-[0_0_6px_rgba(134,239,172,0.3)]";
                                  }
                                  return "border-transparent";
                                };
                                
                                return (
                                <div 
                                  key={egogift.egogiftId} 
                                  className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-200 p-1 rounded border-2 ${getGradeColor()}`}
                                  onClick={() => handleEgoGiftClick(egogift.egogiftId)}
                                >
                                  {/* 이미지 영역 - 프레임 배경 포함 */}
                                  <div className="relative w-16 h-16 flex-shrink-0">
                                    {/* 프레임 배경 이미지 */}
                                    <img
                                      src="/images/egogift/egogift_frame.webp"
                                      alt="frame"
                                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                                    />
                                    {/* 에고기프트 이미지 */}
                                    {egogift.thumbnailPath ? (
                                      <img
                                        src={`${baseUrl}${egogift.thumbnailPath}`}
                                        alt={egogift.giftName}
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
                                  {/* 에고기프트 정보 */}
                                  <div className="text-center w-full">
                                    <div className="text-white text-xs font-medium break-keep w-full" title={egogift.giftName}>{egogift.giftName}</div>
                                  </div>
                                </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 데이터가 없는 경우 안내 */}
                    {uniqueEgoGifts.length === 0 && uniqueChoices.length === 0 && uniqueEnemies.length === 0 && egoGiftCategories.length === 0 && (
                      <div className="text-center text-gray-400 text-sm py-8">
                        추가 정보가 등록되지 않았습니다.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-400">카드팩 정보를 불러올 수 없습니다.</div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 에고기프트 상세 모달 */}
      {isMounted && egogiftPreviewOpen && egogiftPreviewData && createPortal(
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
          grades={egogiftPreviewData.egogift.grades || []}
          desc1={egogiftPreviewData.egogift.desc1 || ""}
          desc2={egogiftPreviewData.egogift.desc2 || ""}
          desc3={egogiftPreviewData.egogift.desc3 || ""}
          selectedTagIds={egogiftPreviewData.egogift.tagIds || []}
          file={null}
          existingFile={egogiftPreviewData.thumbnail || undefined}
          keywords={previewKeywords}
          hashtags={previewHashtags}
          allKeywords={allKeywords}
          allEgoGiftsForHighlight={allEgoGifts}
          egogiftId={egogiftPreviewData.egogift.egogiftId}
          recipes={egogiftRecipe}
          obtainableEvents={egogiftPreviewData?.obtainableEvents || []}
          limitedCategoryName={egogiftPreviewData?.limitedCategoryName || null}
          cardPackAppearances={egogiftPreviewData?.cardPackAppearances || []}
          onEgoGiftClickById={handleEgoGiftClick}
          onEgoGiftClick={async (giftName: string) => {
            // 조합식 내 에고기프트 클릭 시 이름으로 조회
            try {
              const encodedName = encodeURIComponent(giftName);
              const res = await fetch(`${API_BASE_URL}/user/egogift/by-name/${encodedName}`, {
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json();
                if (data.egogift?.egogiftId) {
                  handleEgoGiftClick(data.egogift.egogiftId);
                }
              }
            } catch (err) {
              console.error("에고기프트 조회 실패:", err);
            }
          }}
          onClose={closeEgoGiftModal}
        />,
        document.body
      )}

      {/* 던전 이벤트 모달 */}
      {isMounted && previewEventOpen && previewEvent && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cardpack-page-event-preview-title"
          onClick={closeEventModal}
        >
          <div 
            className="bg-[#131316] border border-[#b8860b]/60 rounded-lg max-w-4xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              ref={modalScrollRef}
              className="flex-1 overflow-y-auto relative"
            >
              <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 px-4 sm:px-6 py-4 z-50 flex justify-between items-center backdrop-blur-sm">
                <div>
                  <h2 id="cardpack-page-event-preview-title" className="text-lg sm:text-xl font-bold text-yellow-300">{previewEvent.title}</h2>
                </div>
                <button
                  onClick={closeEventModal}
                  className="text-gray-400 hover:text-white text-3xl leading-none font-bold"
                  title="닫기"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="sm:w-1/3 w-full h-64 flex items-center justify-center">
                    {previewEvent.attachment ? (
                      <img
                        src={`${baseUrl}${previewEvent.attachment.path}`}
                        alt={previewEvent.title}
                        className="h-full w-auto object-contain border border-[#b8860b]/50 rounded"
                      />
                    ) : (
                      <div className="w-full h-64 flex items-center justify-center border border-dashed border-[#b8860b]/50 rounded text-xs text-gray-500">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="sm:w-2/3 w-full h-64">
                    <div className="h-full text-sm whitespace-pre-line text-gray-200 bg-black/30 border border-[#b8860b]/40 rounded p-3 overflow-y-auto">
                      <KeywordHighlight
                        text={previewEvent.script || ""}
                        keywords={allKeywords}
                        egogifts={allEgoGifts}
                        onEgoGiftClick={(giftName) => {
                          const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                          if (egogift) {
                            handleEgoGiftClick(egogift.egogiftId);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  {previewEvent.nodes && previewEvent.nodes.filter((n: any) => n.parentClientKey === null).length > 0 ? (
                    <div className="space-y-2">
                      {renderNodeTree(null, 0)}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm py-8">
                      선택지가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 적 미리보기 모달 */}
      {isMounted && enemyPreviewOpen && enemyPreviewData && createPortal(
        <EnemyPreview
          enemyData={enemyPreviewData}
          allKeywords={allKeywords}
          onClose={closeEnemyPreview}
        />,
        document.body
      )}
    </div>
  );
}

export default function CardPackPage() {
  return <CardPackPageContent />;
}

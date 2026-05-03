"use client";

import { useEffect, useState, Suspense, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import EgoGiftPreview from "@/app/dante/(admin)/egogift/components/EgoGiftPreview";
import { normalizeCurseBlessCd } from "@/lib/egogiftCurseBless";

interface DungeonEvent {
  eventId: number;
  title: string;
  attachmentPath?: string | null;
  createdAt: string;
  updatedAt: string;
  cardpackIds?: number[]; // 연결된 카드팩 ID 목록
  nodes?: Array<{ // 필터링을 위한 노드 정보 (검색어 필터링용)
    nodeId: number;
    title: string;
    subtitle?: string | null;
  }>;
}

interface DungeonEventDetail {
  eventId: number;
  title: string;
  script: string;
  createdAt: string;
  updatedAt: string;
  attachment?: {
    fileId: number;
    path: string;
    originalName: string;
    storedName: string;
  } | null;
  cardpackTitles?: string[]; // 연결된 카드팩 제목 목록
  nodes: Array<{
    nodeId: number;
    clientKey: string;
    parentClientKey: string | null;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    sortOrder: number;
  }>;
}

function EventPageContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<DungeonEvent[]>([]);
  const [allEvents, setAllEvents] = useState<DungeonEvent[]>([]); // 전체 목록 (필터링 전)
  const [eventLoading, setEventLoading] = useState(false);
  const [eventSearchText, setEventSearchText] = useState(""); // 실제 검색어
  const [eventSearchInput, setEventSearchInput] = useState(""); // 입력 필드 값
  const [selectedCardpackIds, setSelectedCardpackIds] = useState<number[]>([]); // 선택한 카드팩 ID 목록
  const [cardpacksWithEvents, setCardpacksWithEvents] = useState<Array<{ cardpackId: number; title: string }>>([]);
  const [cardpacksOpen, setCardpacksOpen] = useState(false); // 출현 카드팩 펼치기/접기 상태
  const [cardpackSearchText, setCardpackSearchText] = useState(""); // 출현 카드팩 검색어
  const cardpackDropdownRef = useRef<HTMLDivElement>(null);
  const cardpackDropdownContentRef = useRef<HTMLDivElement>(null);
  const searchConditionsRef = useRef<HTMLDivElement>(null);
  const [previewEvent, setPreviewEvent] = useState<DungeonEventDetail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openedNodes, setOpenedNodes] = useState<Set<number>>(new Set());
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const [allKeywords, setAllKeywords] = useState<any[]>([]);
  const [allEgoGifts, setAllEgoGifts] = useState<
    Array<{
      egogiftId: number;
      giftName: string;
      giftTier?: string;
      thumbnailPath?: string;
      desc1?: string;
      desc2?: string;
      desc3?: string;
    }>
  >([]);
  const [egogiftPreviewData, setEgoGiftPreviewData] = useState<any>(null);
  const [egogiftPreviewOpen, setEgoGiftPreviewOpen] = useState(false);
  const [previewHashtags, setPreviewHashtags] = useState<any[]>([]);
  const [egogiftRecipe, setEgoGiftRecipe] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchAllKeywords();
    fetchAllEgoGifts();
    fetchAllEvents();
    fetchCardPacksWithEvents();
  }, []);

  // 출현 카드팩 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!cardpacksOpen) return;
      
      const target = event.target as Node;
      const dropdownRef = cardpackDropdownRef.current;
      const dropdownContentRef = cardpackDropdownContentRef.current;
      
      // 드롭다운 컨테이너나 컨텐츠 내부 클릭이 아니면 닫기
      if (
        dropdownRef &&
        dropdownContentRef &&
        !dropdownRef.contains(target) &&
        !dropdownContentRef.contains(target)
      ) {
        setCardpacksOpen(false);
      }
    };

    if (cardpacksOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cardpacksOpen]);

  // 출현 카드팩 드롭다운 위치 조정
  useEffect(() => {
    if (cardpacksOpen && searchConditionsRef.current && cardpackDropdownRef.current) {
      const updateLayout = () => {
        if (searchConditionsRef.current && cardpackDropdownRef.current) {
          const isMobile = window.innerWidth < 768; // md breakpoint
          const searchConditionsRect = searchConditionsRef.current.getBoundingClientRect();
          const dropdownButtonRect = cardpackDropdownRef.current.getBoundingClientRect();
          
          // 드롭다운 컨테이너 찾기
          const dropdownContainer = cardpackDropdownRef.current.querySelector('[data-dropdown-container]') as HTMLElement;
          if (!dropdownContainer) return;

          if (isMobile) {
            // 모바일: 출현 카드팩 버튼 바로 아래에 표시
            const button = cardpackDropdownRef.current.querySelector('button') as HTMLElement;
            if (button) {
              const buttonHeight = button.offsetHeight;
              dropdownContainer.style.top = `${buttonHeight}px`;
              dropdownContainer.style.marginTop = '0';
            }
          } else {
            // 데스크톱: 검색 조건 영역 상단에서부터 표시
            // cardpackDropdownRef의 상대적 위치에서 검색 조건 영역 상단까지의 거리를 계산
            const offsetFromTop = dropdownButtonRect.top - searchConditionsRect.top;
            dropdownContainer.style.top = `-${offsetFromTop}px`;
            dropdownContainer.style.marginTop = '0';
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
    }
  }, [cardpacksOpen]);

  // filteredEvents가 변경되면 events 업데이트 (useEffect에서 처리)

  // URL 파라미터로 이벤트 자동 열기
  useEffect(() => {
    const eventId = searchParams.get('eventId');
    const openEvent = searchParams.get('openEvent');
    const nodeId = searchParams.get('nodeId');
    if (eventId && openEvent === 'true') {
      const id = Number(eventId);
      if (!isNaN(id)) {
        const targetNodeId = nodeId ? Number(nodeId) : null;
        fetchEventDetail(id, targetNodeId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('eventId'), searchParams.get('openEvent'), searchParams.get('nodeId')]);

  // ESC 키로 모달 닫기 (제일 위에 있는 모달부터 닫기)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 에고기프트 미리보기가 열려있으면 먼저 닫기
        if (egogiftPreviewOpen) {
          setEgoGiftPreviewOpen(false);
          setEgoGiftRecipe(null);
        } 
        // 이벤트 미리보기가 열려있으면 닫기
        else if (previewOpen) {
          setPreviewOpen(false);
          setOpenedNodes(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [egogiftPreviewOpen, previewOpen]);




  // 모달을 직접 닫을 때
  const closeEventModal = () => {
    setPreviewOpen(false);
    setOpenedNodes(new Set());
  };

  const closeEgoGiftModal = () => {
    setEgoGiftPreviewOpen(false);
    setEgoGiftRecipe(null);
  };

  const fetchCardPacksWithEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/cardpack/with-unique-events`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCardpacksWithEvents(data.items || []);
      }
    } catch (err) {
      console.error("출현 카드팩 목록 조회 실패:", err);
    }
  };

  const fetchAllEvents = async () => {
    try {
      setEventLoading(true);
      // 모든 이벤트를 한 번에 불러오기 (검색어, 카드팩 필터 없이)
      const params = new URLSearchParams({ page: "1", size: "10000" });
      const res = await fetch(`${API_BASE_URL}/user/dungeon/event?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        // 이벤트 상세 정보를 위해 노드 정보도 함께 가져와야 함
        // 일단 기본 정보만 저장하고, 필요시 상세 정보는 fetchEventDetail에서 가져옴
        setAllEvents(data.items || []);
      }
    } catch (err) {
      console.error("이벤트 전체 목록 조회 실패:", err);
    } finally {
      setEventLoading(false);
    }
  };

  // 프론트엔드에서 필터링 처리 (검색어, 카드팩 필터)
  const filteredEvents = useMemo(() => {
    let filtered = [...allEvents];

    // 검색어 필터 (이벤트 제목에 검색어 포함)
    if (eventSearchText && eventSearchText.trim()) {
      const searchLower = eventSearchText.toLowerCase().trim();
      filtered = filtered.filter((event) => {
        // 이벤트 제목에 검색어 포함 여부
        const titleMatch = event.title?.toLowerCase().includes(searchLower) || false;
        
        // 노드 제목 또는 서브제목에 검색어 포함 여부 (노드 정보가 있는 경우)
        let nodeMatch = false;
        if (event.nodes && event.nodes.length > 0) {
          nodeMatch = event.nodes.some((node) => {
            const nodeTitleMatch = node.title?.toLowerCase().includes(searchLower) || false;
            const nodeSubtitleMatch = node.subtitle?.toLowerCase().includes(searchLower) || false;
            return nodeTitleMatch || nodeSubtitleMatch;
          });
        }
        
        return titleMatch || nodeMatch;
      });
    }

    // 카드팩 필터 (OR 검색)
    if (selectedCardpackIds.length > 0) {
      filtered = filtered.filter((event) => {
        const eventCardpackIds = event.cardpackIds || [];
        // 선택한 카드팩 중 하나라도 포함되어 있으면 통과
        return selectedCardpackIds.some((selectedId) => eventCardpackIds.includes(selectedId));
      });
    }

    return filtered;
  }, [allEvents, eventSearchText, selectedCardpackIds]);

  // 필터링된 결과를 상태에 반영
  useEffect(() => {
    setEvents(filteredEvents);
  }, [filteredEvents]);

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
      console.error("전체 키워드 목록 조회 실패:", err);
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
      console.error("에고기프트 전체 목록 조회 실패:", err);
    }
  };

  const handleEventSearch = () => {
    setEventSearchText(eventSearchInput);
    // 프론트에서 필터링하므로 API 호출 불필요
  };

  const fetchEventDetail = async (eventId: number, targetNodeId?: number | null) => {
    // 이미 같은 이벤트가 열려있으면 다시 열지 않음
    if (previewOpen && previewEvent && previewEvent.eventId === eventId) {
      // 노드만 업데이트
      if (targetNodeId) {
        const targetNode = previewEvent.nodes?.find((n: any) => n.nodeId === targetNodeId);
        const nodesToOpen = new Set<number>([targetNodeId]);
        
        const openParentNodes = (node: any) => {
          if (node?.parentClientKey) {
            const parentNode = previewEvent.nodes?.find((n: any) => n.clientKey === node.parentClientKey);
            if (parentNode) {
              nodesToOpen.add(parentNode.nodeId);
              openParentNodes(parentNode);
            }
          }
        };
        
        if (targetNode) {
          openParentNodes(targetNode);
        }
        
        setOpenedNodes(nodesToOpen);
      }
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/user/dungeon/event/${eventId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewEvent(data);
        setPreviewOpen(true);
        
        // 특정 노드를 열어야 하는 경우
        if (targetNodeId) {
          const targetNode = data.nodes?.find((n: any) => n.nodeId === targetNodeId);
          const nodesToOpen = new Set<number>();
          
          // 모든 부모 노드를 재귀적으로 찾아서 상위 노드부터 순서대로 추가
          const collectParentNodes = (node: any, nodeList: number[]): number[] => {
            if (node?.parentClientKey) {
              const parentNode = data.nodes?.find((n: any) => n.clientKey === node.parentClientKey);
              if (parentNode) {
                // 부모를 먼저 리스트에 추가 (상위 노드부터)
                nodeList.unshift(parentNode.nodeId);
                // 부모의 부모도 재귀적으로 찾기
                return collectParentNodes(parentNode, nodeList);
              }
            }
            return nodeList;
          };
          
          if (targetNode) {
            // 상위 노드부터 하위 노드 순서로 리스트 생성
            const orderedNodes = collectParentNodes(targetNode, []);
            // 마지막에 타겟 노드 추가
            orderedNodes.push(targetNodeId);
            // Set에 순서대로 추가
            orderedNodes.forEach(nodeId => nodesToOpen.add(nodeId));
          }
          
          setOpenedNodes(nodesToOpen);
          
          // 노드가 열린 후 스크롤 이동 (DOM 렌더링 대기)
          setTimeout(() => {
            const nodeElement = nodeRefs.current.get(targetNodeId);
            if (nodeElement && modalScrollRef.current) {
              const modalScroll = modalScrollRef.current;
              const nodeRect = nodeElement.getBoundingClientRect();
              const modalRect = modalScroll.getBoundingClientRect();
              const scrollTop = modalScroll.scrollTop;
              const nodeTop = nodeRect.top - modalRect.top + scrollTop;
              
              // 노드가 보이도록 스크롤 (약간의 여백 추가)
              modalScroll.scrollTo({
                top: nodeTop - 20,
                behavior: 'smooth'
              });
            }
          }, 300); // 노드 열림 애니메이션 대기
        } else {
          setOpenedNodes(new Set());
        }
      }
    } catch (err) {
      console.error("이벤트 상세 조회 실패:", err);
    }
  };

  const baseUrl = API_BASE_URL.replace("/api", "");

  const handleEgoGiftClick = async (giftName: string) => {
    try {
      const encodedName = encodeURIComponent(giftName);
      const res = await fetch(`${API_BASE_URL}/user/egogift/by-name/${encodedName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEgoGiftPreviewData(data);
        setPreviewHashtags(data.tags || []);
        
        if (data.keyword) {
          setKeywords([{
            keywordId: data.keyword.keywordId,
            keywordName: data.keyword.keywordName,
            categoryName: data.keyword.categoryName || "",
          }]);
        }
        
        setEgoGiftPreviewOpen(true);

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
      }
    } catch (err) {
      console.error("에고기프트 상세 조회 실패:", err);
    }
  };

  const handleEgoGiftClickById = async (egogiftId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/egogift/${egogiftId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEgoGiftPreviewData(data);
        setPreviewHashtags(data.tags || []);

        if (data.keyword) {
          setKeywords([
            {
              keywordId: data.keyword.keywordId,
              keywordName: data.keyword.keywordName,
              categoryName: data.keyword.categoryName || "",
            },
          ]);
        }

        setEgoGiftPreviewOpen(true);

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
      }
    } catch (err) {
      console.error("에고기프트 상세 조회 실패:", err);
    }
  };

  const renderNodeTree = (parentClientKey: string | null, depth: number = 0): React.ReactElement[] => {
    if (!previewEvent || !previewEvent.nodes) return [];

    const nodeChildren = previewEvent.nodes.filter(
      (n) => n.parentClientKey === parentClientKey
    );

    return nodeChildren.map((node) => {
      const nodeId = node.nodeId;
      const isOpened = openedNodes.has(nodeId);
      const hasDescription = node.description && node.description.trim() !== "";
      const nodeChildren = previewEvent.nodes.filter(
        (n) => n.parentClientKey === node.clientKey
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
              const wasOpened = newOpened.has(nodeId);
              if (wasOpened) {
                newOpened.delete(nodeId);
              } else {
                newOpened.add(nodeId);
                // 노드가 열릴 때 스크롤 이동 (애니메이션 시작 후)
                setTimeout(() => {
                  const nodeElement = nodeRefs.current.get(nodeId);
                  if (nodeElement && modalScrollRef.current) {
                    const modalScroll = modalScrollRef.current;
                    const nodeRect = nodeElement.getBoundingClientRect();
                    const modalRect = modalScroll.getBoundingClientRect();
                    const scrollTop = modalScroll.scrollTop;
                    const nodeTop = nodeRect.top - modalRect.top + scrollTop;
                    
                    // 노드가 보이도록 스크롤 (약간의 여백 추가)
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
                {node.title}
              </div>
              {node.subtitle && (
                <div className="text-xs text-gray-400">
                  <KeywordHighlight 
                    text={node.subtitle} 
                    keywords={[]} 
                    egogifts={[]}
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
                      text={node.description || ''} 
                      keywords={allKeywords} 
                      egogifts={allEgoGifts}
                      onEgoGiftClick={handleEgoGiftClick}
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
            {/* 검색 조건 */}
            <div className="w-full lg:w-1/5 flex-shrink-0 order-1 lg:order-1 min-w-[240px]">
              <div ref={searchConditionsRef} className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 lg:sticky lg:top-20 z-[100] overflow-visible">
                <h2 className="text-lg font-semibold text-yellow-300 mb-4">검색 조건</h2>
                
                <button
                  onClick={() => {
                    setEventSearchText("");
                    setEventSearchInput("");
                    setSelectedCardpackIds([]);
                    setCardpackSearchText("");
                    // 프론트에서 필터링하므로 API 호출 불필요
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm mb-4"
                >
                  필터 초기화
                </button>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">검색어</label>
                    <input
                      type="text"
                      placeholder="이벤트, 선택지 검색"
                      value={eventSearchInput}
                      onChange={(e) => setEventSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleEventSearch();
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-2"
                    />
                    <button
                      onClick={handleEventSearch}
                      className="w-full px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-500 transition-colors"
                    >
                      검색
                    </button>
                  </div>

                  <div className="relative" ref={cardpackDropdownRef}>
                    <button
                      onClick={() => {
                        setCardpacksOpen(!cardpacksOpen);
                        // 드롭다운을 닫을 때 검색어 초기화
                        if (cardpacksOpen) {
                          setCardpackSearchText("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#2a2a2d] text-gray-300 rounded hover:bg-[#3a3a3d] text-sm flex items-center justify-between relative z-10"
                    >
                      <span>출현 카드팩</span>
                      <span className={`transition-transform duration-200 ${cardpacksOpen ? "rotate-90" : ""}`}>▶</span>
                    </button>
                    <div
                      data-dropdown-container
                      className={`absolute transition-all duration-300 ease-in-out ${
                        cardpacksOpen
                          ? "opacity-100 visible md:ml-2 md:left-full"
                          : "opacity-0 invisible max-h-0 pointer-events-none"
                      } left-0 w-full md:w-[400px]`}
                      style={{ zIndex: 10001 }}
                    >
                      <div 
                        ref={cardpackDropdownContentRef}
                        className="p-3 bg-[#2a2a2d] border border-[#b8860b]/40 rounded overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shadow-lg max-h-[500px] md:max-h-[700px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 검색 입력 필드 */}
                        <input
                          type="text"
                          placeholder="카드팩 검색..."
                          value={cardpackSearchText}
                          onChange={(e) => setCardpackSearchText(e.target.value)}
                          className="w-full px-3 py-2 mb-3 bg-[#1a1a1d] text-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {/* 필터링된 카드팩 목록 */}
                        <div className="grid grid-cols-2 gap-2">
                          {cardpacksWithEvents
                            .filter((cardpack) => {
                              if (!cardpackSearchText.trim()) return true;
                              return cardpack.title.toLowerCase().includes(cardpackSearchText.toLowerCase().trim());
                            })
                            .map((cardpack) => (
                              <button
                                key={cardpack.cardpackId}
                                onClick={() => {
                                  const exists = selectedCardpackIds.includes(cardpack.cardpackId);
                                  const newIds = exists
                                    ? selectedCardpackIds.filter((id) => id !== cardpack.cardpackId)
                                    : [...selectedCardpackIds, cardpack.cardpackId];
                                  setSelectedCardpackIds(newIds);
                                  // 프론트에서 필터링하므로 API 호출 불필요
                                }}
                                className={`px-3 py-1.5 text-sm rounded transition-colors text-center truncate ${
                                  selectedCardpackIds.includes(cardpack.cardpackId)
                                    ? "bg-yellow-400 text-black font-semibold"
                                    : "bg-[#1a1a1d] text-gray-300 hover:bg-[#2a2a2d]"
                                }`}
                                title={cardpack.title}
                              >
                                {cardpack.title}
                              </button>
                            ))}
                        </div>
                        
                        {/* 검색 결과가 없을 때 */}
                        {cardpackSearchText.trim() && 
                         cardpacksWithEvents.filter((cardpack) => 
                           cardpack.title.toLowerCase().includes(cardpackSearchText.toLowerCase().trim())
                         ).length === 0 && (
                          <div className="text-center text-gray-500 text-sm py-4">
                            검색 결과가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 결과 */}
            <div className="flex-1 order-2 lg:order-2 relative">
              {/* 부드러운 페이드인 결과 영역 */}
              {events.length === 0 && !eventLoading ? (
                <div className="bg-[#131316] border border-[#b8860b]/40 rounded p-8 text-center text-gray-400 fade-in-soft">
                  등록된 이벤트가 없습니다.
                </div>
              ) : (
                <div className={`fade-in-soft ${eventLoading ? "opacity-60" : "opacity-100"} transition-opacity`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                    {events.map((event) => (
                      <div
                        key={event.eventId}
                        onClick={() => fetchEventDetail(event.eventId)}
                        className="bg-[#131316] border border-[#b8860b]/40 rounded p-4 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <div className="relative w-full mb-3 h-48 overflow-hidden rounded">
                          {event.attachmentPath ? (
                            <img
                              src={`${baseUrl}${event.attachmentPath}`}
                              alt={event.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex itemscenter justify-center bg-black/30 border border-dashed border-red-600/60 text-xs text-gray-500">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="text-base text-center text-gray-300 truncate font-medium">
                          {event.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 로딩 오버레이 (기존 내용 위에서 부드럽게 표시) */}
              {eventLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-4 py-2 rounded bg-black/70 border border-[#b8860b]/40 text-gray-300 text-sm fade-in-soft">
                    로딩 중...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 이벤트 미리보기 모달 */}
      {isMounted && previewOpen && previewEvent && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-page-preview-title"
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
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <h2 id="event-page-preview-title" className="text-lg sm:text-xl font-bold text-yellow-300">{previewEvent.title}</h2>
                  {previewEvent.cardpackTitles && previewEvent.cardpackTitles.length > 0 && (
                    <div className="text-sm" style={{ color: '#ccff00' }}>
                      {previewEvent.cardpackTitles.map((title, idx) => (
                        <span key={idx}>
                          "{title}" 카드팩 출현
                          {idx < previewEvent.cardpackTitles!.length - 1 && ", "}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={closeEventModal}
                  className="text-gray-400 hover:text-white text-3xl leading-none font-bold ml-2"
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
                      text={previewEvent.script} 
                      keywords={allKeywords} 
                      egogifts={allEgoGifts}
                      onEgoGiftClick={handleEgoGiftClick}
                    />
                  </div>
                </div>
              </div>

              <div>
                {previewEvent.nodes && previewEvent.nodes.filter((n) => n.parentClientKey === null).length > 0 ? (
                  <div className="space-y-2">
                    {renderNodeTree(null, 0)}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">등록된 첫 번째 선택지가 없습니다.</div>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 에고기프트 미리보기 모달 */}
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
          curseBlessCd={normalizeCurseBlessCd(
            egogiftPreviewData.egogift.curseBlessCd ??
              egogiftPreviewData.egogift.curse_bless_cd
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
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    }>
      <EventPageContent />
    </Suspense>
  );
}


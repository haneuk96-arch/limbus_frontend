"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import EnemyPreview from "@/components/EnemyPreview";
import { KeywordData } from "@/lib/keywordParser";

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
  grades?: string[];
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

export type CardPackHighlightEgoGift = {
  egogiftId: number;
  giftName: string;
  giftTier?: string;
  thumbnailPath?: string;
  desc1?: string;
  desc2?: string;
  desc3?: string;
};

export interface CardPackDetailModalProps {
  open: boolean;
  cardpackId: number | null;
  onClose: () => void;
  baseUrl: string;
  allKeywords: KeywordData[];
  allEgoGifts: CardPackHighlightEgoGift[];
  /** 카드팩 모달 내·이벤트 트리에서 에고기프트 클릭 시 */
  onEgoGiftClick: (egogiftId: number) => void;
  /** 에고 미리보기(9999) 위에 쌓일 때 */
  stackZBase?: number;
}

export default function CardPackDetailModal({
  open,
  cardpackId,
  onClose,
  baseUrl,
  allKeywords,
  allEgoGifts,
  onEgoGiftClick,
  stackZBase = 10020,
}: CardPackDetailModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [cardPackDetail, setCardPackDetail] = useState<CardPackDetail | null>(null);
  const [uniqueEgoGifts, setUniqueEgoGifts] = useState<UniqueEgoGift[]>([]);
  const [uniqueChoices, setUniqueChoices] = useState<UniqueChoice[]>([]);
  const [uniqueEnemies, setUniqueEnemies] = useState<UniqueEnemy[]>([]);
  const [egoGiftCategories, setEgoGiftCategories] = useState<EgoGiftCategory[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEgoGiftListExpanded, setIsEgoGiftListExpanded] = useState(false);

  const [enemyPreviewData, setEnemyPreviewData] = useState<unknown>(null);
  const [enemyPreviewOpen, setEnemyPreviewOpen] = useState(false);

  const [previewEvent, setPreviewEvent] = useState<Record<string, unknown> | null>(null);
  const [previewEventOpen, setPreviewEventOpen] = useState(false);
  const [openedNodes, setOpenedNodes] = useState<Set<number>>(new Set());
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const zPack = stackZBase;
  const zEvent = stackZBase + 10;
  const zEnemy = stackZBase + 20;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const resetDetailState = useCallback(() => {
    setCardPackDetail(null);
    setUniqueEgoGifts([]);
    setUniqueChoices([]);
    setUniqueEnemies([]);
    setEgoGiftCategories([]);
    setIsEgoGiftListExpanded(false);
    setDetailLoading(false);
  }, []);

  const fetchCardPackDetail = useCallback(
    async (id: number) => {
      try {
        setDetailLoading(true);

        const res = await fetch(`${API_BASE_URL}/user/cardpack/${id}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCardPackDetail(data);
        } else {
          setCardPackDetail(null);
        }

        try {
          const eventsRes = await fetch(`${API_BASE_URL}/user/cardpack/${id}/events`, {
            credentials: "include",
          });
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            const events = eventsData.items || [];
            setUniqueChoices(
              events.map((e: { eventId: number; title: string; thumbnailPath?: string }) => ({
                eventId: e.eventId,
                title: e.title,
                thumbnailPath: e.thumbnailPath,
              }))
            );
          }
        } catch {
          setUniqueChoices([]);
        }

        try {
          const egogiftsRes = await fetch(`${API_BASE_URL}/user/cardpack/${id}/egogifts`, {
            credentials: "include",
          });
          if (egogiftsRes.ok) {
            const egogiftsData = await egogiftsRes.json();
            const egogifts = egogiftsData.items || [];

            const unique = egogifts
              .filter((egogift: { limitedYn: string }) => egogift.limitedYn === "Y")
              .map(
                (egogift: {
                  egogiftId: number;
                  giftName: string;
                  thumbnailPath?: string;
                  grades?: string[];
                }) => ({
                  egogiftId: egogift.egogiftId,
                  giftName: egogift.giftName,
                  thumbnailPath: egogift.thumbnailPath,
                  grades: egogift.grades || [],
                })
              );

            const regularEgoGifts = egogifts.filter(
              (egogift: { limitedYn: string }) => egogift.limitedYn !== "Y"
            );
            const seenEgoGiftIds = new Set<number>();
            const deduplicatedRegularEgoGifts = regularEgoGifts.filter((egogift: { egogiftId: number }) => {
              if (seenEgoGiftIds.has(egogift.egogiftId)) return false;
              seenEgoGiftIds.add(egogift.egogiftId);
              return true;
            });

            const categoryMap: Record<number, EgoGiftCategory> = {};
            deduplicatedRegularEgoGifts.forEach(
              (egogift: {
                egogiftCategoryId: number;
                categoryName: string;
                egogiftId: number;
                giftName: string;
                thumbnailPath?: string;
                grades?: string[];
              }) => {
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
              }
            );

            setUniqueEgoGifts(unique);
            setEgoGiftCategories(Object.values(categoryMap));
          }
        } catch {
          setUniqueEgoGifts([]);
          setEgoGiftCategories([]);
        }

        try {
          const enemiesRes = await fetch(`${API_BASE_URL}/user/cardpack/${id}/enemies`, {
            credentials: "include",
          });
          if (enemiesRes.ok) {
            const enemiesData = await enemiesRes.json();
            const enemies = enemiesData.items || [];
            setUniqueEnemies(
              enemies.map((e: { enemyId: number; name: string; imagePath?: string }) => ({
                enemyId: e.enemyId,
                name: e.name,
                imagePath: e.imagePath,
              }))
            );
          }
        } catch {
          setUniqueEnemies([]);
        }
      } catch {
        setCardPackDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open || cardpackId == null) {
      resetDetailState();
      return;
    }
    void fetchCardPackDetail(cardpackId);
  }, [open, cardpackId, fetchCardPackDetail, resetDetailState]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        if (enemyPreviewOpen) return;
        if (previewEventOpen) return;
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose, enemyPreviewOpen, previewEventOpen]);

  const handleClose = useCallback(() => {
    setPreviewEventOpen(false);
    setPreviewEvent(null);
    setOpenedNodes(new Set());
    setEnemyPreviewOpen(false);
    setEnemyPreviewData(null);
    onClose();
  }, [onClose]);

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
    } catch {
      // ignore
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
    } catch {
      // ignore
    }
  };

  const handleEventClick = (eventId: number) => {
    void fetchEventDetail(eventId);
  };

  const closeEventModal = () => {
    setPreviewEventOpen(false);
    setPreviewEvent(null);
    setOpenedNodes(new Set());
  };

  const renderNodeTree = (parentClientKey: string | null, depth: number = 0): ReactNode[] => {
    if (!previewEvent || !Array.isArray(previewEvent.nodes)) return [];

    const nodes = previewEvent.nodes as Array<{
      nodeId: number;
      parentClientKey: string | null;
      clientKey: string;
      title?: string;
      subtitle?: string;
      description?: string;
    }>;

    const nodeChildren = nodes.filter((n) => n.parentClientKey === parentClientKey);

    return nodeChildren.map((node) => {
      const nodeId = node.nodeId;
      const isOpened = openedNodes.has(nodeId);
      const hasDescription = node.description && node.description.trim() !== "";
      const childNodes = nodes.filter((n) => n.parentClientKey === node.clientKey);

      return (
        <div
          key={node.clientKey}
          className="mb-2"
          ref={(el) => {
            if (el) nodeRefs.current.set(nodeId, el);
            else nodeRefs.current.delete(nodeId);
          }}
        >
          <div
            className={`p-3 rounded cursor-pointer transition-all duration-200 ${
              isOpened
                ? "bg-[#1a1a1f] border-2 border-[#ffcc33]/60 shadow-lg shadow-[#ffcc33]/20"
                : "bg-[#131316] border border-[#b8860b]/40 hover:bg-[#1b1b1f]"
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
                      behavior: "smooth",
                    });
                  }
                }, 100);
              }
              setOpenedNodes(newOpened);
            }}
          >
            <div className="flex items-center gap-2">
              <div className={`text-sm font-semibold ${isOpened ? "text-[#ffcc33]" : "text-gray-200"}`}>
                <KeywordHighlight
                  text={node.title || ""}
                  keywords={allKeywords}
                  egogifts={allEgoGifts}
                  onEgoGiftClick={(giftName) => {
                    const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                    if (egogift) onEgoGiftClick(egogift.egogiftId);
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
                      if (egogift) onEgoGiftClick(egogift.egogiftId);
                    }}
                  />
                </div>
              )}
            </div>

            <div
              className={`ml-4 mt-2 space-y-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isOpened ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
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
                        if (egogift) onEgoGiftClick(egogift.egogiftId);
                      }}
                    />
                  </div>
                </div>
              )}

              {childNodes.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">{renderNodeTree(node.clientKey, depth + 1)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  if (!isMounted || !open || typeof document === "undefined") return null;

  const eventTitle = (previewEvent?.title as string) || "";
  const eventScript = (previewEvent?.script as string) || "";
  const eventAttachment = previewEvent?.attachment as { path?: string } | undefined;
  type EventNodeRow = { parentClientKey?: string | null };
  const eventNodes = previewEvent?.nodes as EventNodeRow[] | undefined;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/70"
          style={{ zIndex: zPack }}
          onClick={handleClose}
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
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative">
                  <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 px-4 sm:px-6 py-4 z-50 flex justify-between items-center backdrop-blur-sm">
                    <h2 className="text-lg sm:text-xl font-bold text-yellow-300">{cardPackDetail.title}</h2>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-gray-400 hover:text-white text-3xl leading-none font-bold"
                      title="닫기"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4 sm:p-6 space-y-6">
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
                              const difficultyColors: Record<string, string> = {
                                노말: "text-green-200",
                                하드: "text-pink-200",
                                익스트림: "text-red-400",
                              };
                              const difficultyOrder: Record<string, number> = {
                                노말: 0,
                                하드: 1,
                                익스트림: 2,
                              };
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
                              const difficultyColors: Record<string, string> = {
                                노말: "text-green-200",
                                하드: "text-pink-200",
                                익스트림: "text-red-400",
                              };
                              const difficultyOrder: Record<string, number> = {
                                노말: 0,
                                하드: 1,
                                익스트림: 2,
                              };
                              const sortedDifficultyFloors = [...cardPackDetail.difficultyFloors].sort((a, b) => {
                                const orderA = difficultyOrder[a.difficulty] ?? 999;
                                const orderB = difficultyOrder[b.difficulty] ?? 999;
                                return orderA - orderB;
                              });
                              return sortedDifficultyFloors.map((df) => (
                                <div key={df.difficulty} className="space-y-1">
                                  <div className="text-xs text-gray-400">{df.difficulty}</div>
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

                    {uniqueEgoGifts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 고유 에고기프트
                        </h3>
                        <div className="grid grid-cols-5 md:grid-cols-[repeat(10,minmax(0,1fr))] gap-2 md:gap-3">
                          {uniqueEgoGifts.map((egogift) => {
                            const getGradeColor = () => {
                              if (egogift.grades?.includes("E")) {
                                return "border-red-600/50 shadow-[0_0_6px_rgba(252,165,165,0.3)]";
                              }
                              if (egogift.grades?.includes("H")) {
                                return "border-pink-600/50 shadow-[0_0_6px_rgba(249,168,212,0.3)]";
                              }
                              if (egogift.grades?.includes("N")) {
                                return "border-green-600/50 shadow-[0_0_6px_rgba(134,239,172,0.3)]";
                              }
                              return "border-transparent";
                            };
                            return (
                              <div
                                key={egogift.egogiftId}
                                role="button"
                                tabIndex={0}
                                className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-200 p-1 rounded border-2 ${getGradeColor()}`}
                                onClick={() => onEgoGiftClick(egogift.egogiftId)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onEgoGiftClick(egogift.egogiftId);
                                  }
                                }}
                              >
                                <div className="relative w-16 h-16 flex-shrink-0">
                                  <img
                                    src="/images/egogift/egogift_frame.webp"
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                                  />
                                  {egogift.thumbnailPath ? (
                                    <img
                                      src={`${baseUrl}${egogift.thumbnailPath}`}
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
                                <div className="text-center w-full">
                                  <div
                                    className="text-white text-xs font-medium break-keep w-full"
                                    title={egogift.giftName}
                                  >
                                    {egogift.giftName}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {uniqueChoices.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 고유 선택지
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {uniqueChoices.map((choice) => (
                            <div
                              key={choice.eventId}
                              role="button"
                              tabIndex={0}
                              className="bg-[#1a1a1a] border border-[#b8860b]/40 rounded p-3 cursor-pointer hover:bg-[#242428] hover:border-[#b8860b]/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                              onClick={() => handleEventClick(choice.eventId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleEventClick(choice.eventId);
                                }
                              }}
                            >
                              {choice.thumbnailPath && (
                                <div className="mb-2 flex items-center justify-center">
                                  <img
                                    src={`${baseUrl}${choice.thumbnailPath}`}
                                    alt={choice.title}
                                    className="max-w-full h-auto max-h-32 object-contain rounded"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                              <div className="text-sm font-semibold text-gray-200 text-center">{choice.title}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uniqueEnemies.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2">
                          출현 가능 보스
                        </h3>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-[repeat(8,minmax(0,1fr))] gap-3">
                          {uniqueEnemies.map((enemy) => (
                            <div
                              key={enemy.enemyId}
                              role="button"
                              tabIndex={0}
                              className="flex flex-col items-center gap-2 p-2 bg-[#1a1a1a] border border-[#b8860b]/40 rounded hover:bg-[#242428] hover:border-[#b8860b]/60 transition-all duration-200 cursor-pointer"
                              onClick={() => void handleEnemyClick(enemy.enemyId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  void handleEnemyClick(enemy.enemyId);
                                }
                              }}
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
                              <div
                                className="text-white text-xs font-medium text-center break-keep w-full"
                                title={enemy.name}
                              >
                                {enemy.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {egoGiftCategories.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsEgoGiftListExpanded(!isEgoGiftListExpanded)}
                          className="w-full flex justify-between items-center text-lg font-semibold text-yellow-300 mb-3 border-b border-[#b8860b]/40 pb-2 hover:text-yellow-400 transition-colors"
                        >
                          <span>출현 에고기프트 목록</span>
                          <span className="text-xl">{isEgoGiftListExpanded ? "−" : "+"}</span>
                        </button>
                        {isEgoGiftListExpanded && (
                          <div className="grid grid-cols-5 md:grid-cols-[repeat(10,minmax(0,1fr))] gap-2 md:gap-3">
                            {egoGiftCategories.flatMap((category) =>
                              category.egogifts.map((egogift) => {
                                const getGradeColor = () => {
                                  if (egogift.grades?.includes("E")) {
                                    return "border-red-600/50 shadow-[0_0_6px_rgba(252,165,165,0.3)]";
                                  }
                                  if (egogift.grades?.includes("H")) {
                                    return "border-pink-600/50 shadow-[0_0_6px_rgba(249,168,212,0.3)]";
                                  }
                                  if (egogift.grades?.includes("N")) {
                                    return "border-green-600/50 shadow-[0_0_6px_rgba(134,239,172,0.3)]";
                                  }
                                  return "border-transparent";
                                };
                                return (
                                  <div
                                    key={egogift.egogiftId}
                                    role="button"
                                    tabIndex={0}
                                    className={`flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-200 p-1 rounded border-2 ${getGradeColor()}`}
                                    onClick={() => onEgoGiftClick(egogift.egogiftId)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onEgoGiftClick(egogift.egogiftId);
                                      }
                                    }}
                                  >
                                    <div className="relative w-16 h-16 flex-shrink-0">
                                      <img
                                        src="/images/egogift/egogift_frame.webp"
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
                                      />
                                      {egogift.thumbnailPath ? (
                                        <img
                                          src={`${baseUrl}${egogift.thumbnailPath}`}
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
                                    <div className="text-center w-full">
                                      <div
                                        className="text-white text-xs font-medium break-keep w-full"
                                        title={egogift.giftName}
                                      >
                                        {egogift.giftName}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {uniqueEgoGifts.length === 0 &&
                      uniqueChoices.length === 0 &&
                      uniqueEnemies.length === 0 &&
                      egoGiftCategories.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">추가 정보가 등록되지 않았습니다.</div>
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

      {previewEventOpen &&
        previewEvent &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50"
            style={{ zIndex: zEvent }}
            onClick={closeEventModal}
          >
            <div
              className="bg-[#131316] border border-[#b8860b]/60 rounded-lg max-w-4xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={modalScrollRef}
                className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative"
              >
                <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 px-4 sm:px-6 py-4 z-50 flex justify-between items-center backdrop-blur-sm">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-yellow-300">{eventTitle}</h2>
                  </div>
                  <button
                    type="button"
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
                      {eventAttachment?.path ? (
                        <img
                          src={`${baseUrl}${eventAttachment.path}`}
                          alt={eventTitle}
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
                          text={eventScript}
                          keywords={allKeywords}
                          egogifts={allEgoGifts}
                          onEgoGiftClick={(giftName) => {
                            const egogift = allEgoGifts.find((e) => e.giftName === giftName);
                            if (egogift) onEgoGiftClick(egogift.egogiftId);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    {eventNodes && eventNodes.filter((n) => n.parentClientKey === null).length > 0 ? (
                      <div className="space-y-2">{renderNodeTree(null, 0)}</div>
                    ) : (
                      <div className="text-center text-gray-400 text-sm py-8">선택지가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {enemyPreviewOpen && enemyPreviewData && (
        <EnemyPreview
          enemyData={enemyPreviewData as never}
          allKeywords={allKeywords}
          onClose={closeEnemyPreview}
          overlayZIndex={zEnemy}
        />
      )}
    </>
  );
}

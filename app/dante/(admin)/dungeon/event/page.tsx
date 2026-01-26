"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import EgoGiftPreview from "@/app/dante/(admin)/egogift/components/EgoGiftPreview";

interface DungeonEvent {
  eventId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentPath?: string | null;
}

interface DungeonEventNode {
  nodeId: number;
  clientKey: string;
  parentClientKey: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  sortOrder: number;
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
  nodes: DungeonEventNode[];
}

export default function DungeonEventPage() {
  const router = useRouter();
  const [events, setEvents] = useState<DungeonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewEvent, setPreviewEvent] = useState<DungeonEventDetail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [openedNodes, setOpenedNodes] = useState<Set<number>>(new Set());
  const [allEgoGifts, setAllEgoGifts] = useState<Array<{ egogiftId: number; giftName: string; giftTier: string; thumbnailPath?: string; desc1?: string; desc2?: string; desc3?: string }>>([]);
  const [egogiftPreviewData, setEgoGiftPreviewData] = useState<any>(null);
  const [egogiftPreviewOpen, setEgoGiftPreviewOpen] = useState(false);
  const [egogiftRecipe, setEgoGiftRecipe] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [allKeywords, setAllKeywords] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchAllEgoGifts();
  }, []);

  const fetchAllEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift?page=0&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const egogifts = (data.content || []).map((e: any) => ({
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
      console.error("에고기프트 목록 조회 실패:", err);
    }
  };

  const handleEgoGiftClick = async (giftName: string) => {
    try {
      const encodedName = encodeURIComponent(giftName);
      const res = await fetch(`${API_BASE_URL}/admin/egogift/by-name/${encodedName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEgoGiftPreviewData(data);
        setEgoGiftPreviewOpen(true);
        
        // 키워드와 해시태그도 가져와야 함
        if (data.keyword) {
          setKeywords([{
            keywordId: data.keyword.keywordId,
            keywordName: data.keyword.keywordName,
            categoryName: data.keyword.categoryName || "",
          }]);
        }
        setHashtags(data.tags || []);
        // 전체 키워드도 가져와야 함 (하이라이팅용)
        fetchAllKeywords();
        
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

  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        // KeywordData 형식으로 변환
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

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/event/list?page=1&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
      }
    } catch (err) {
      console.error("이벤트 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까? 이벤트와 첨부파일, 트리 구조가 모두 삭제됩니다.")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/event/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  const baseUrl = API_BASE_URL.replace("/api", "");

  const handleNodeClick = (node: DungeonEventNode) => {
    setOpenedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(node.nodeId)) {
        // 이미 열려있으면 닫기
        newSet.delete(node.nodeId);
      } else {
        // 닫혀있으면 열기
        newSet.add(node.nodeId);
      }
      return newSet;
    });
  };

  const renderNodeTree = (parentKey: string | null, depth: number = 0): React.ReactElement[] => {
    if (!previewEvent) return [];

    const nodes = previewEvent.nodes
      .filter((n) => n.parentClientKey === parentKey)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return nodes.map((node) => {
      const isOpened = openedNodes.has(node.nodeId);
      const nodeChildren = previewEvent.nodes
        .filter((n) => n.parentClientKey === node.clientKey)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const hasDescription = node.description && node.description.trim().length > 0;

      return (
        <div key={node.nodeId} style={{ marginLeft: `${depth * 1}rem` }}>
          <div
            className={`bg-black/30 border rounded px-3 py-2 cursor-pointer ${
              isOpened
                ? "border-yellow-400"
                : "border-red-900/60 hover:border-yellow-300"
            }`}
            onClick={() => handleNodeClick(node)}
          >
            <div className="text-sm text-[#f5e6c8] font-semibold">
              {node.title}
            </div>
            {node.subtitle && (
              <div className="text-xs text-gray-400 mt-0.5">
                {node.subtitle}
              </div>
            )}
          </div>

          {/* 열린 노드의 설명과 하위 선택지 */}
          {isOpened && (
            <div className="ml-4 mt-2 space-y-3">
              {/* 설명 (먼저 표시) */}
              {hasDescription && (
                <div>
                  <h4 className="text-xs font-semibold text-yellow-300 mb-2">설명</h4>
                  <div className="bg-black/30 border border-red-900/60 rounded p-3 text-xs text-gray-200 whitespace-pre-line">
                    <KeywordHighlight 
                      text={node.description || ''} 
                      keywords={[]} 
                      egogifts={allEgoGifts}
                      onEgoGiftClick={handleEgoGiftClick}
                    />
                  </div>
                </div>
              )}

              {/* 하위 선택지 (설명 다음에 표시) */}
              {nodeChildren.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-yellow-300 mb-2">하위 선택지</h4>
                  <div className="space-y-2">
                    {renderNodeTree(node.clientKey, depth + 1)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">던전 이벤트 관리</h1>
        <Link
          href="/dante/dungeon/event/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : events.length === 0 ? (
        <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
          등록된 이벤트가 없습니다.
        </div>
      ) : (
        <div className="bg-[#131316] border border-red-700 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-gray-300">
              <tr>
                <th className="px-4 py-2 text-left w-12">ID</th>
                <th className="px-4 py-2 text-left">제목</th>
                <th className="px-4 py-2 text-left w-32">첨부</th>
                <th className="px-4 py-2 text-left w-40">등록일</th>
                <th className="px-4 py-2 text-left w-40">수정일</th>
                <th className="px-4 py-2 text-left w-32">관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.eventId} className="border-t border-red-900/60 hover:bg-black/30">
                  <td className="px-4 py-2 text-xs text-gray-400">{e.eventId}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={async () => {
                        try {
                          setPreviewLoading(true);
                          setOpenedNodes(new Set());
                          const res = await fetch(`${API_BASE_URL}/admin/dungeon/event/${e.eventId}`, {
                            credentials: "include",
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setPreviewEvent(data);
                            setPreviewOpen(true);
                          }
                        } catch (err) {
                          console.error("이벤트 상세 조회 실패:", err);
                        } finally {
                          setPreviewLoading(false);
                        }
                      }}
                      className="text-yellow-300 hover:underline text-sm"
                    >
                      {e.title}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {e.attachmentPath ? (
                      <a
                        href={`${baseUrl}${e.attachmentPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-300 hover:underline"
                      >
                        보기
                      </a>
                    ) : (
                      <span className="text-gray-500">없음</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(e.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <button
                      onClick={() => router.push(`/dante/dungeon/event/edit/${e.eventId}`)}
                      className="px-2 py-1 mr-1 bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(e.eventId)}
                      className="px-2 py-1 bg-red-700 hover:bg-red-800 rounded"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewOpen && previewEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setPreviewOpen(false);
            setOpenedNodes(new Set());
          }}
        >
          <div 
            className="bg-[#131316] border border-red-700 rounded-lg max-w-4xl w-full mx-4 h-[90vh] flex flex-col p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-yellow-300">{previewEvent.title}</h2>
                </div>
              <button
                onClick={() => {
                  setPreviewOpen(false);
                  setOpenedNodes(new Set());
                }}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
              </div>

            {/* 이미지 + 스크립트 */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* 왼쪽: 이미지 (고정 높이) */}
              <div className="sm:w-1/3 w-full h-64 flex items-center justify-center">
                {previewEvent.attachment ? (
                  <img
                    src={`${baseUrl}${previewEvent.attachment.path}`}
                    alt={previewEvent.title}
                    className="h-full w-auto object-contain border border-red-700/60 rounded"
                  />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center border border-dashed border-red-700/60 rounded text-xs text-gray-500">
                    이미지 없음
                  </div>
                )}
              </div>
              {/* 오른쪽: 설명 (이미지와 동일 고정 높이, 내부 스크롤) */}
              <div className="sm:w-2/3 w-full h-64">
                <div className="h-full text-sm whitespace-pre-line text-gray-200 bg-black/30 border border-red-900/60 rounded p-3 overflow-y-auto">
                  <KeywordHighlight 
                    text={previewEvent.script} 
                    keywords={[]} 
                    egogifts={allEgoGifts}
                    onEgoGiftClick={handleEgoGiftClick}
                  />
                </div>
              </div>
            </div>

            {/* 첫 번째 노드 선택지들 (parentClientKey가 null인 노드들) */}
            <div>
              <h3 className="text-sm font-semibold text-yellow-300 mb-2">첫 번째 선택지</h3>
              {previewEvent.nodes && previewEvent.nodes.filter((n) => n.parentClientKey === null).length > 0 ? (
                <div className="space-y-2">
                  {renderNodeTree(null, 0)}
                </div>
              ) : (
                <div className="text-xs text-gray-500">등록된 첫 번째 선택지가 없습니다.</div>
              )}
            </div>

              {previewLoading && (
                <div className="mt-4 text-xs text-gray-400">불러오는 중...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 에고기프트 미리보기 모달 */}
      {egogiftPreviewOpen && egogiftPreviewData && (
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
          keywords={keywords}
          hashtags={hashtags}
          allKeywords={allKeywords}
          egogiftId={egogiftPreviewData.egogift.egogiftId}
          recipes={egogiftRecipe}
          obtainableEvents={egogiftPreviewData?.obtainableEvents || []}
          limitedCategoryName={egogiftPreviewData?.limitedCategoryName || null}
          cardPackAppearances={egogiftPreviewData?.cardPackAppearances || []}
          onEgoGiftClick={(giftName) => handleEgoGiftClick(giftName)}
          onClose={() => setEgoGiftPreviewOpen(false)}
        />
      )}
    </div>
  );
}



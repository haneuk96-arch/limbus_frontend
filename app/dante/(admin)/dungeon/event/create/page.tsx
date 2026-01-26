"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface NodeItem {
  clientKey: string;
  parentClientKey: string | null;
  title: string;
  subtitle: string;
  description: string;
  sortOrder: number;
  eventType: number;  // 0: 일반, 1: 전투
  egogiftIds: number[];  // 획득 가능한 에고기프트 ID 목록
}

export default function DungeonEventCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [replaceText, setReplaceText] = useState(""); // 이벤트 기본 스크립트용
  const [replaceType, setReplaceType] = useState<"keyword" | "enhancement" | "egogift">("keyword");
  const [enhancementColor, setEnhancementColor] = useState<string>("yellow");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set()); // 설명 부분 접기/펼치기
  const [collapsedNodeContents, setCollapsedNodeContents] = useState<Set<string>>(new Set()); // 전체 노드 내용 접기/펼치기
  const [allEgoGifts, setAllEgoGifts] = useState<Array<{ egogiftId: number; giftName: string }>>([]);
  const [egogiftSearchTexts, setEgoGiftSearchTexts] = useState<Record<string, string>>({}); // 각 노드별 에고기프트 검색어
  const [nodeReplaceTexts, setNodeReplaceTexts] = useState<Record<string, string>>({}); // 각 노드별 변환할 텍스트

  useEffect(() => {
    fetchAllEgoGifts();
  }, []);

  const fetchAllEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/simple`, {
        credentials: "include",
      });
      if (res.ok) {
        const egogifts = await res.json();
        setAllEgoGifts(egogifts);
      }
    } catch (err) {
      console.error("에고기프트 목록 조회 실패:", err);
    }
  };

  const addNode = () => {
    const key = `node-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setNodes((prev) => [
      ...prev,
      {
        clientKey: key,
        parentClientKey: null,
        title: "",
        subtitle: "",
        description: "",
        sortOrder: prev.length + 1,
        eventType: 0,
        egogiftIds: [],
      },
    ]);
  };

  const updateNode = (index: number, patch: Partial<NodeItem>) => {
    setNodes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeNode = (index: number) => {
    setNodes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!script.trim()) {
      setError("스크립트를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      const data = {
        title,
        script,
        nodes: nodes.map((n) => ({
          clientKey: n.clientKey,
          parentClientKey: n.parentClientKey,
          title: n.title,
          subtitle: n.subtitle,
          description: n.description,
          sortOrder: n.sortOrder,
          eventType: n.eventType,
          egogiftIds: n.egogiftIds,
        })),
      };

      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE_URL}/admin/dungeon/event`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/dungeon/event");
      } else {
        try {
          const resp = await res.json();
          setError(resp.message || "등록에 실패했습니다.");
        } catch {
          setError("등록에 실패했습니다.");
        }
      }
    } catch (err) {
      console.error(err);
      setError("등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">던전 이벤트 등록</h1>
        <Link
          href="/dante/dungeon/event"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          목록
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="이벤트 제목을 입력하세요"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-yellow-300 text-sm font-medium mb-2">스크립트 *</label>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="변환할 텍스트"
                  className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400 w-32"
                />
                <select
                  value={replaceType}
                  onChange={(e) => setReplaceType(e.target.value as "keyword" | "enhancement" | "egogift")}
                  className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                >
                  <option value="keyword">[[키워드]]</option>
                  <option value="enhancement">{"{변경내용}"}</option>
                  <option value="egogift">{"((에고기프트))"}</option>
                </select>
                {replaceType === "enhancement" && (
                  <select
                    value={enhancementColor}
                    onChange={(e) => setEnhancementColor(e.target.value)}
                    className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                  >
                    <option value="red">빨강</option>
                    <option value="orange">주황</option>
                    <option value="yellow">노랑</option>
                    <option value="green">초록</option>
                    <option value="blue">파랑</option>
                    <option value="indigo">남색</option>
                    <option value="purple">보라</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!replaceText || !script) return;
                    const escapedText = replaceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const newScript = script.replace(new RegExp(escapedText, 'g'), (match, offset, string) => {
                      const before = string.substring(Math.max(0, offset - 2), offset);
                      const after = string.substring(offset + match.length, offset + match.length + 2);
                      if (
                        (before.endsWith('[[') && after.startsWith(']]')) ||
                        (before.endsWith('{') && after.startsWith('}')) ||
                        (before.endsWith('((') && after.startsWith('))'))
                      ) {
                        return match;
                      }
                      if (replaceType === "keyword") {
                        return `[[${match}]]`;
                      } else {
                        // {color:text} 형식
                        return `{${enhancementColor}:${match}}`;
                      }
                    });
                    setScript(newScript);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  변환
                </button>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full min-h-[160px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                placeholder="이벤트 기본 스크립트를 입력하세요"
              />
            </div>

            <div className="flex-1">
              <label className="block text-yellow-300 text-sm font-medium mb-2">첨부파일</label>
              <div className="min-h-[160px] flex flex-col">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                />
                {preview && (
                  <div className="mt-3 flex-1">
                    <img
                      src={preview}
                      alt="미리보기"
                      className="max-w-full max-h-[140px] object-contain border border-red-700/50 rounded"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-yellow-300 text-sm font-medium">선택지 트리</label>
              <button
                type="button"
                onClick={addNode}
                className="px-3 py-1 text-xs bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded"
              >
                선택지 추가
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              원하는 만큼 선택지를 추가하고, 각 선택지의 부모를 선택하면 트리 구조로 저장됩니다.
            </p>

            {nodes.length === 0 ? (
              <div className="text-xs text-gray-500 border border-dashed border-red-700 rounded p-3">
                아직 추가된 선택지가 없습니다. 상단의 &quot;선택지 추가&quot; 버튼을 눌러 추가하세요.
              </div>
            ) : (
              <div className="space-y-2">
                {nodes.map((node, idx) => {
                  const isCollapsed = collapsedNodeContents.has(node.clientKey);
                  return (
                    <div
                      key={node.clientKey}
                      className="bg-black/20 border border-red-900/60 rounded"
                    >
                      {/* 헤더: 접기/펼치기 버튼 + 제목 */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/30"
                        onClick={() => {
                          setCollapsedNodeContents(prev => {
                            const next = new Set(prev);
                            if (next.has(node.clientKey)) {
                              next.delete(node.clientKey);
                            } else {
                              next.add(node.clientKey);
                            }
                            return next;
                          });
                        }}
                      >
                        <button
                          type="button"
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedNodeContents(prev => {
                              const next = new Set(prev);
                              if (next.has(node.clientKey)) {
                                next.delete(node.clientKey);
                              } else {
                                next.add(node.clientKey);
                              }
                              return next;
                            });
                          }}
                        >
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                        <span className="text-sm text-yellow-300 font-medium flex-1">
                          {(() => {
                            const parentNode = node.parentClientKey 
                              ? nodes.find(n => n.clientKey === node.parentClientKey)
                              : null;
                            const parentTitle = parentNode?.title || null;
                            const nodeTitle = node.title || `Node ${idx + 1}`;
                            if (parentTitle) {
                              return (
                                <>
                                  <span className="text-xs text-gray-400">{parentTitle}</span>
                                  <span className="mx-1 text-gray-500">-</span>
                                  <span>{nodeTitle}</span>
                                </>
                              );
                            }
                            return nodeTitle;
                          })()}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={node.sortOrder}
                            onChange={(e) =>
                              updateNode(idx, { sortOrder: Number(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="순서"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNode(idx);
                            }}
                            className="px-2 py-1 text-xs bg-red-700 hover:bg-red-800 rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      {/* 내용 */}
                      {!isCollapsed && (
                        <div className="px-3 py-2 space-y-2">
                          <select
                            value={node.parentClientKey ?? ""}
                            onChange={(e) =>
                              updateNode(idx, {
                                parentClientKey: e.target.value === "" ? null : e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="">루트</option>
                            {nodes
                              .filter((n) => n.clientKey !== node.clientKey)
                              .map((n) => (
                                <option key={n.clientKey} value={n.clientKey}>
                                  부모: {n.title || n.clientKey}
                                </option>
                              ))}
                          </select>
                          <input
                            type="text"
                            value={node.title}
                            onChange={(e) => updateNode(idx, { title: e.target.value })}
                            className="w-full px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="선택지 제목"
                          />
                          <input
                            type="text"
                            value={node.subtitle}
                            onChange={(e) => updateNode(idx, { subtitle: e.target.value })}
                            className="w-full px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="서브제목"
                          />
                          <select
                            value={node.eventType}
                            onChange={(e) =>
                              updateNode(idx, { eventType: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value={0}>일반</option>
                            <option value={1}>전투</option>
                          </select>
                      {/* 아랫줄: 설명 전체 폭 */}
                      <div className="space-y-1">
                        <div className="flex gap-2 items-center mb-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCollapsedNodes(prev => {
                                const next = new Set(prev);
                                if (next.has(node.clientKey)) {
                                  next.delete(node.clientKey);
                                } else {
                                  next.add(node.clientKey);
                                }
                                return next;
                              });
                            }}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
                            title={collapsedNodes.has(node.clientKey) ? "펼치기" : "접기"}
                          >
                            {collapsedNodes.has(node.clientKey) ? "▶" : "▼"}
                          </button>
                          <input
                            type="text"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            placeholder="변환할 텍스트"
                            className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400 w-24"
                          />
                          <select
                            value={replaceType}
                            onChange={(e) => setReplaceType(e.target.value as "keyword" | "enhancement" | "egogift")}
                            className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="keyword">[[키워드]]</option>
                            <option value="enhancement">{"{변경내용}"}</option>
                            <option value="egogift">{"((에고기프트))"}</option>
                          </select>
                          {replaceType === "enhancement" && (
                            <select
                              value={enhancementColor}
                              onChange={(e) => setEnhancementColor(e.target.value)}
                              className="px-2 py-1 bg-[#1c1c1f] text-white text-xs border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            >
                              <option value="red">빨강</option>
                              <option value="orange">주황</option>
                              <option value="yellow">노랑</option>
                              <option value="green">초록</option>
                              <option value="blue">파랑</option>
                              <option value="indigo">남색</option>
                              <option value="purple">보라</option>
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (!replaceText || !node.description) return;
                              const escapedText = replaceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const newDescription = node.description.replace(new RegExp(escapedText, 'g'), (match, offset, string) => {
                                const before = string.substring(Math.max(0, offset - 2), offset);
                                const after = string.substring(offset + match.length, offset + match.length + 2);
                                if (
                                  (before.endsWith('[[') && after.startsWith(']]')) ||
                                  (before.endsWith('{') && after.startsWith('}')) ||
                                  (before.endsWith('((') && after.startsWith('))'))
                                ) {
                                  return match;
                                }
                                if (replaceType === "keyword") {
                                  return `[[${match}]]`;
                                } else if (replaceType === "egogift") {
                                  return `((${match}))`;
                                } else {
                                  return `{${enhancementColor}:${match}}`;
                                }
                              });
                              updateNode(idx, { description: newDescription });
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                          >
                            변환
                          </button>
                        </div>
                        {!collapsedNodes.has(node.clientKey) && (
                          <>
                            <textarea
                              value={node.description}
                              onChange={(e) => updateNode(idx, { description: e.target.value })}
                              className="w-full min-h-[120px] px-2 py-1 bg-[#1c1c1f] text-xs text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                              placeholder="설명"
                            />
                            <div className="mt-2">
                              <label className="block text-xs text-gray-400 mb-1">획득 가능한 에고기프트</label>
                              <input
                                type="text"
                                value={egogiftSearchTexts[node.clientKey] || ""}
                                onChange={(e) => {
                                  setEgoGiftSearchTexts(prev => ({
                                    ...prev,
                                    [node.clientKey]: e.target.value
                                  }));
                                }}
                                placeholder="에고기프트 검색..."
                                className="w-full px-2 py-1 mb-2 bg-[#1c1c1f] text-white text-xs border border-red-700/50 rounded focus:outline-none focus:border-yellow-400"
                              />
                              <div className="max-h-32 overflow-y-auto border border-red-700/50 rounded p-2 bg-[#1c1c1f]">
                                {allEgoGifts.length === 0 ? (
                                  <div className="text-xs text-gray-500">로딩 중...</div>
                                ) : (() => {
                                  const searchText = (egogiftSearchTexts[node.clientKey] || "").toLowerCase();
                                  const filteredEgoGifts = searchText
                                    ? allEgoGifts.filter(egogift => 
                                        egogift.giftName.toLowerCase().includes(searchText)
                                      )
                                    : allEgoGifts;
                                  
                                  if (filteredEgoGifts.length === 0) {
                                    return <div className="text-xs text-gray-500">검색 결과가 없습니다.</div>;
                                  }
                                  
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {filteredEgoGifts.map((egogift) => (
                                        <label
                                          key={egogift.egogiftId}
                                          className="flex items-center gap-1 text-xs cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={node.egogiftIds.includes(egogift.egogiftId)}
                                            onChange={(e) => {
                                              const newIds = e.target.checked
                                                ? [...node.egogiftIds, egogift.egogiftId]
                                                : node.egogiftIds.filter((id) => id !== egogift.egogiftId);
                                              updateNode(idx, { egogiftIds: newIds });
                                            }}
                                            className="w-3 h-3"
                                          />
                                          <span className="text-gray-300">{egogift.giftName}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
            >
              {loading ? "등록 중..." : "등록"}
            </button>
            <Link
              href="/dante/dungeon/event"
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-center"
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}



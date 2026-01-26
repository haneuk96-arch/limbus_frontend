"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface EgoGift {
  egogiftId: number;
  giftName: string;
}

interface RecipeItem {
  egogiftId: number | null;
  sortOrder: number;
  type: "재료" | "결과";
}

export default function EgoGiftRecipeEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [egogifts, setEgoGifts] = useState<EgoGift[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [searchQueries, setSearchQueries] = useState<{ [key: number]: string }>({});
  const [openDropdowns, setOpenDropdowns] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    fetchEgoGifts();
    fetchRecipe();
  }, [id]);

  const fetchEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.content || [];
        setEgoGifts(
          items.map((item: any) => ({
            egogiftId: item.egogiftId,
            giftName: item.giftName,
          }))
        );
      }
    } catch (err) {
      console.error("에고기프트 목록 조회 실패:", err);
    }
  };

  const fetchRecipe = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE_URL}/admin/egogift/recipe/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || "");
        setItems(
          (data.items || []).map((item: any) => ({
            egogiftId: item.egogiftId,
            sortOrder: item.sortOrder,
            type: item.type as "재료" | "결과",
          }))
        );
      } else {
        setError("조합식을 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("조합식 조회 실패:", err);
      setError("조합식 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const handleAddItem = () => {
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) : 0;
    setItems([
      ...items,
      {
        egogiftId: null,
        sortOrder: maxOrder + 1,
        type: "재료",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // 순서 재정렬
    const reorderedItems = newItems.map((item, i) => ({
      ...item,
      sortOrder: i + 1,
    }));
    setItems(reorderedItems);
  };

  const handleItemChange = (index: number, field: keyof RecipeItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSearchChange = (index: number, query: string) => {
    setSearchQueries({ ...searchQueries, [index]: query });
  };

  const handleSelectEgoGift = (index: number, egogiftId: number) => {
    handleItemChange(index, "egogiftId", egogiftId);
    setSearchQueries({ ...searchQueries, [index]: "" });
    setOpenDropdowns({ ...openDropdowns, [index]: false });
  };

  const toggleDropdown = (index: number) => {
    setOpenDropdowns({ ...openDropdowns, [index]: !openDropdowns[index] });
  };

  const getFilteredEgoGifts = (index: number) => {
    const query = searchQueries[index] || "";
    if (!query.trim()) {
      return egogifts;
    }
    return egogifts.filter((egogift) =>
      egogift.giftName.toLowerCase().includes(query.toLowerCase())
    );
  };

  const getSelectedEgoGiftName = (egogiftId: number | null) => {
    if (!egogiftId) return "";
    const egogift = egogifts.find((e) => e.egogiftId === egogiftId);
    return egogift?.giftName || "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    if (items.length === 0) {
      setError("에고기프트를 하나 이상 추가해주세요.");
      return;
    }

    // 모든 아이템에 에고기프트가 선택되었는지 확인
    const hasEmptyItem = items.some((item) => item.egogiftId === null);
    if (hasEmptyItem) {
      setError("모든 항목에 에고기프트를 선택해주세요.");
      return;
    }

    // 결과 타입이 하나 이상 있는지 확인
    const hasResult = items.some((item) => item.type === "결과");
    if (!hasResult) {
      setError("결과 타입의 에고기프트를 하나 이상 추가해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/egogift/recipe/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          recipeId: Number(id),
          title,
          items: items.map((item) => ({
            egogiftId: item.egogiftId,
            sortOrder: item.sortOrder,
            type: item.type,
          })),
        }),
      });

      if (res.ok) {
        router.push("/dante/egogift/recipe");
      } else {
        const data = await res.json();
        setError(data.message || "수정에 실패했습니다.");
      }
    } catch (err) {
      setError("수정에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".egogift-select")) {
        setOpenDropdowns({});
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (fetching) {
    return (
      <div>
        <div className="text-gray-300">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">에고기프트 조합식 수정</h1>
        <Link
          href="/dante/egogift/recipe"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          목록
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="조합식 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-yellow-300 text-sm font-medium">에고기프트 조합 *</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                추가
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 border border-red-700/50 rounded">
                에고기프트를 추가해주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-[#1c1c1f] border border-red-700/50 rounded flex flex-col sm:flex-row gap-3"
                  >
                    <div className="flex-1 relative egogift-select">
                      <label className="block text-gray-300 text-xs mb-1">에고기프트</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={item.egogiftId ? getSelectedEgoGiftName(item.egogiftId) : searchQueries[index] || ""}
                          onChange={(e) => {
                            handleSearchChange(index, e.target.value);
                            if (item.egogiftId) {
                              handleItemChange(index, "egogiftId", null);
                            }
                          }}
                          onFocus={() => setOpenDropdowns({ ...openDropdowns, [index]: true })}
                          placeholder="에고기프트 검색 또는 선택"
                          className="w-full px-3 py-2 bg-[#131316] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          required={!item.egogiftId}
                        />
                        {openDropdowns[index] && (
                          <div className="absolute z-10 w-full mt-1 bg-[#1c1c1f] border border-red-700 rounded max-h-60 overflow-y-auto shadow-lg">
                            {getFilteredEgoGifts(index).length === 0 ? (
                              <div className="px-3 py-2 text-gray-400 text-sm">검색 결과가 없습니다.</div>
                            ) : (
                              getFilteredEgoGifts(index).map((egogift) => (
                                <button
                                  key={egogift.egogiftId}
                                  type="button"
                                  onClick={() => handleSelectEgoGift(index, egogift.egogiftId)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#131316] hover:text-yellow-300"
                                >
                                  {egogift.giftName}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-24">
                      <label className="block text-gray-300 text-xs mb-1">순서</label>
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) =>
                          handleItemChange(index, "sortOrder", Number(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-[#131316] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                        min="1"
                        required
                      />
                    </div>

                    <div className="w-32">
                      <label className="block text-gray-300 text-xs mb-1">타입</label>
                      <select
                        value={item.type}
                        onChange={(e) =>
                          handleItemChange(index, "type", e.target.value as "재료" | "결과")
                        }
                        className="w-full px-3 py-2 bg-[#131316] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                        required
                      >
                        <option value="재료">재료</option>
                        <option value="결과">결과</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
            >
              {loading ? "수정 중..." : "수정"}
            </button>
            <Link
              href="/dante/egogift/recipe"
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


"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface CardPack {
  cardpackId: number;
  title: string;
}

interface EgoGiftCategory {
  egogiftCategoryId: number;
  categoryName: string;
  limitedYn?: string;
}

interface CategoryMap {
  cardpackId: number;
  egogiftCategoryId: number;
}

export default function CardPackEgoGiftCategoryMapPage() {
  const [cardPacks, setCardPacks] = useState<CardPack[]>([]);
  const [categories, setCategories] = useState<EgoGiftCategory[]>([]);
  const [selectedCardpackId, setSelectedCardpackId] = useState<number | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [maps, setMaps] = useState<CategoryMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [cardpackSearchText, setCardpackSearchText] = useState("");
  const [categorySearchText, setCategorySearchText] = useState("");

  useEffect(() => {
    fetchCardPacks();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCardpackId) {
      fetchMaps(selectedCardpackId);
    } else {
      setMaps([]);
      setSelectedCategoryIds([]);
    }
  }, [selectedCardpackId]);

  const fetchCardPacks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/list?page=1&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCardPacks(data.items || []);
      }
    } catch (err) {
      console.error("카드팩 목록 조회 실패:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/category/list?page=1&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.items || []);
      }
    } catch (err) {
      console.error("에고기프트 카테고리 목록 조회 실패:", err);
    }
  };

  const fetchMaps = async (cardpackId: number) => {
    try {
      setFetching(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/cardpack/egogift-category-map/by-cardpack/${cardpackId}`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const mapList = data.items || [];
        setMaps(mapList);
        setSelectedCategoryIds(mapList.map((m: CategoryMap) => m.egogiftCategoryId));
      }
    } catch (err) {
      console.error("매핑 목록 조회 실패:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!selectedCardpackId) {
      alert("카드팩을 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/cardpack/egogift-category-map/create/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            cardpackId: selectedCardpackId,
            egogiftCategoryIds: selectedCategoryIds,
          }),
        }
      );

      if (res.ok) {
        alert("매핑이 저장되었습니다.");
        if (selectedCardpackId) {
          fetchMaps(selectedCardpackId);
        }
      } else {
        alert("매핑 저장에 실패했습니다.");
      }
    } catch (err) {
      console.error("매핑 저장 실패:", err);
      alert("매핑 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cardpackId: number, categoryId: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/cardpack/egogift-category-map/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardpackId,
          egogiftCategoryId: categoryId,
        }),
      });

      if (res.ok) {
        alert("매핑이 삭제되었습니다.");
        if (selectedCardpackId) {
          fetchMaps(selectedCardpackId);
        }
      } else {
        alert("매핑 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("매핑 삭제 실패:", err);
      alert("매핑 삭제에 실패했습니다.");
    }
  };

  const selectedCardPack = cardPacks.find(
    (cp) => cp.cardpackId === selectedCardpackId
  );

  const filteredCardPacks = useMemo(() => {
    if (!cardpackSearchText.trim()) return cardPacks;
    const searchLower = cardpackSearchText.toLowerCase().trim();
    return cardPacks.filter((cp) => cp.title.toLowerCase().includes(searchLower));
  }, [cardPacks, cardpackSearchText]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchText.trim()) return categories;
    const searchLower = categorySearchText.toLowerCase().trim();
    return categories.filter((c) => c.categoryName.toLowerCase().includes(searchLower));
  }, [categories, categorySearchText]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
          카드팩-에고기프트 카테고리 매핑 관리
        </h1>
        <Link
          href="/dante/dungeon/cardpack"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          카드팩 목록
        </Link>
      </div>

      <div className="space-y-6">
        {/* 카드팩 선택 */}
        <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
          <label className="block text-yellow-300 text-sm font-medium mb-3">
            카드팩 선택
          </label>
          <input
            type="text"
            placeholder="카드팩 검색..."
            value={cardpackSearchText}
            onChange={(e) => setCardpackSearchText(e.target.value)}
            className="w-full px-3 py-2 mb-3 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
          />
          <select
            value={selectedCardpackId || ""}
            onChange={(e) =>
              setSelectedCardpackId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
          >
            <option value="">카드팩을 선택하세요</option>
            {filteredCardPacks.map((cardPack) => (
              <option key={cardPack.cardpackId} value={cardPack.cardpackId}>
                {cardPack.title}
              </option>
            ))}
          </select>
          {cardpackSearchText.trim() && filteredCardPacks.length === 0 && (
            <div className="mt-2 text-gray-400 text-sm">검색 결과가 없습니다.</div>
          )}
        </div>

        {selectedCardpackId && (
          <>
            {/* 에고기프트 카테고리 선택 */}
            <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
              <label className="block text-yellow-300 text-sm font-medium mb-3">
                연결할 에고기프트 카테고리 선택 (다중 선택 가능)
              </label>
              <input
                type="text"
                placeholder="에고기프트 카테고리 검색..."
                value={categorySearchText}
                onChange={(e) => setCategorySearchText(e.target.value)}
                className="w-full px-3 py-2 mb-3 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
              />
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {categories.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    등록된 에고기프트 카테고리가 없습니다.
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="text-gray-400 text-sm">검색 결과가 없습니다.</div>
                ) : (
                  filteredCategories.map((category) => (
                    <label
                      key={category.egogiftCategoryId}
                      className="flex items-center gap-2 p-2 hover:bg-[#1c1c1f] rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(category.egogiftCategoryId)}
                        onChange={() => handleCategoryToggle(category.egogiftCategoryId)}
                        className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400"
                      />
                      <span className="text-gray-300 text-sm">
                        {category.categoryName}
                        {category.limitedYn === "Y" && (
                          <span className="text-red-400 text-xs ml-2">(한정)</span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
              >
                {loading ? "저장 중..." : "매핑 저장"}
              </button>
            </div>

            {/* 현재 매핑 목록 */}
            <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
              <h2 className="text-yellow-300 text-lg font-semibold mb-4">
                현재 연결된 에고기프트 카테고리 ({selectedCardPack?.title})
              </h2>
              {fetching ? (
                <div className="text-gray-300">로딩 중...</div>
              ) : maps.length === 0 ? (
                <div className="text-gray-400 text-sm">연결된 에고기프트 카테고리가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {maps.map((map) => {
                    const category = categories.find((c) => c.egogiftCategoryId === map.egogiftCategoryId);
                    return (
                      <div
                        key={`${map.cardpackId}-${map.egogiftCategoryId}`}
                        className="flex justify-between items-center p-3 bg-[#1c1c1f] border border-red-700/50 rounded"
                      >
                        <span className="text-gray-300 text-sm">
                          {category?.categoryName || `카테고리 ID: ${map.egogiftCategoryId}`}
                          {category?.limitedYn === "Y" && (
                            <span className="text-red-400 text-xs ml-2">(한정)</span>
                          )}
                        </span>
                        <button
                          onClick={() => handleDelete(map.cardpackId, map.egogiftCategoryId)}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm rounded"
                        >
                          삭제
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface EgoGift {
  egogiftId: number;
  giftName: string;
  keywordId?: number | null;
  keywordName?: string;
}

interface EgoGiftCategory {
  egogiftCategoryId: number;
  categoryName: string;
}

interface CategoryMap {
  egogiftId: number;
  egogiftCategoryId: number;
}

interface Keyword {
  keywordId: number;
  keywordName: string;
  categoryName?: string;
}

export default function EgoGiftCategoryMapPage() {
  const [egogifts, setEgoGifts] = useState<EgoGift[]>([]);
  const [allEgoGifts, setAllEgoGifts] = useState<EgoGift[]>([]); // 전체 목록 (필터링 전)
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [categories, setCategories] = useState<EgoGiftCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null); // null = 전체, "0" = 범용
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedEgogiftIds, setSelectedEgogiftIds] = useState<number[]>([]);
  const [maps, setMaps] = useState<CategoryMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchEgoGifts();
    fetchCategories();
    fetchKeywords();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchMaps(selectedCategoryId);
    } else {
      setMaps([]);
      setSelectedEgogiftIds([]);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    filterEgoGifts();
  }, [selectedKeywordId, searchText, allEgoGifts]);

  const fetchEgoGifts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift?page=0&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.content || [];
        const egogiftsData = items.map((item: any) => ({
          egogiftId: item.egogiftId,
          giftName: item.giftName,
          keywordId: item.keywordId || null,
          keywordName: item.keywordName || null,
        }));
        setAllEgoGifts(egogiftsData);
      }
    } catch (err) {
      console.error("에고기프트 목록 조회 실패:", err);
    }
  };

  const fetchKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywordsData = (data.content || []).map((k: any) => ({
          keywordId: k.keywordId,
          keywordName: k.keywordName,
          categoryName: k.categoryName || "",
        }));
        setKeywords(keywordsData);
      }
    } catch (err) {
      console.error("키워드 목록 조회 실패:", err);
    }
  };

  const filterEgoGifts = () => {
    let filtered = [...allEgoGifts];

    // 키워드 필터링
    if (selectedKeywordId !== null) {
      if (selectedKeywordId === "0") {
        // 범용: keywordId가 0이거나 null인 경우
        filtered = filtered.filter((eg) => eg.keywordId === 0 || eg.keywordId === null || !eg.keywordId);
      } else {
        // 특정 키워드: keywordId로 매칭
        const keywordIdNum = Number(selectedKeywordId);
        filtered = filtered.filter((eg) => eg.keywordId === keywordIdNum);
      }
    }

    // 에고기프트 이름 검색 필터링
    if (searchText && searchText.trim()) {
      const searchLower = searchText.trim().toLowerCase();
      filtered = filtered.filter((eg) =>
        eg.giftName.toLowerCase().includes(searchLower) ||
        (eg.keywordName && eg.keywordName.toLowerCase().includes(searchLower))
      );
    }

    setEgoGifts(filtered);
  };

  const handleSearch = () => {
    setSearchText(searchInput);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/category/list?page=1&size=100`, {
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

  const fetchMaps = async (categoryId: number) => {
    try {
      setFetching(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/egogift/category-map/by-category/${categoryId}`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const mapList = data.items || [];
        setMaps(mapList);
        setSelectedEgogiftIds(mapList.map((m: CategoryMap) => m.egogiftId));
      }
    } catch (err) {
      console.error("매핑 목록 조회 실패:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleEgogiftToggle = (egogiftId: number) => {
    setSelectedEgogiftIds((prev) =>
      prev.includes(egogiftId)
        ? prev.filter((id) => id !== egogiftId)
        : [...prev, egogiftId]
    );
  };

  const handleSave = async () => {
    if (!selectedCategoryId) {
      alert("카테고리를 선택해주세요.");
      return;
    }

    if (selectedEgogiftIds.length === 0) {
      alert("에고기프트를 하나 이상 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/egogift/category-map/create/bulk-by-category`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            egogiftCategoryId: selectedCategoryId,
            egogiftIds: selectedEgogiftIds,
          }),
        }
      );

      if (res.ok) {
        alert("매핑이 저장되었습니다.");
        if (selectedCategoryId) {
          fetchMaps(selectedCategoryId);
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

  const handleDelete = async (egogiftId: number, categoryId: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/category-map/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          egogiftId,
          egogiftCategoryId: categoryId,
        }),
      });

      if (res.ok) {
        alert("매핑이 삭제되었습니다.");
        if (selectedCategoryId) {
          fetchMaps(selectedCategoryId);
        }
      } else {
        alert("매핑 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("매핑 삭제 실패:", err);
      alert("매핑 삭제에 실패했습니다.");
    }
  };

  const selectedCategory = categories.find(
    (c) => c.egogiftCategoryId === selectedCategoryId
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
          에고기프트-카테고리 매핑 관리
        </h1>
        <Link
          href="/dante/egogift"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          에고기프트 목록
        </Link>
      </div>

      <div className="space-y-6">
        {/* 카테고리 선택 */}
        <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
          <label className="block text-yellow-300 text-sm font-medium mb-3">
            카테고리 선택
          </label>
          <select
            value={selectedCategoryId || ""}
            onChange={(e) =>
              setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
          >
            <option value="">카테고리를 선택하세요</option>
            {categories.map((category) => (
              <option key={category.egogiftCategoryId} value={category.egogiftCategoryId}>
                {category.categoryName}
              </option>
            ))}
          </select>
        </div>

        {/* 에고기프트 검색 */}
        <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
          <label className="block text-yellow-300 text-sm font-medium mb-3">
            에고기프트 검색
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="에고기프트 이름으로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="flex-1 px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded"
            >
              검색
            </button>
            {searchText && (
              <button
                onClick={() => {
                  setSearchText("");
                  setSearchInput("");
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 키워드 필터 */}
        <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
          <label className="block text-yellow-300 text-sm font-medium mb-3">
            키워드 필터
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedKeywordId(null)}
              className={`px-4 py-2 rounded font-medium text-sm ${
                selectedKeywordId === null
                  ? "bg-yellow-400 text-black"
                  : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedKeywordId("0")}
              className={`px-4 py-2 rounded font-medium text-sm ${
                selectedKeywordId === "0"
                  ? "bg-yellow-400 text-black"
                  : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
              }`}
            >
              범용
            </button>
            {keywords
              .filter((k) => k.categoryName === "대표" || k.categoryName === "공격유형")
              .map((keyword) => (
                <button
                  key={keyword.keywordId}
                  onClick={() => setSelectedKeywordId(String(keyword.keywordId))}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    selectedKeywordId === String(keyword.keywordId)
                      ? "bg-yellow-400 text-black"
                      : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
                  }`}
                >
                  {keyword.keywordName}
                </button>
              ))}
          </div>
        </div>

        {selectedCategoryId && (
          <>
            {/* 에고기프트 선택 */}
            <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
              <label className="block text-yellow-300 text-sm font-medium mb-3">
                연결할 에고기프트 선택 (다중 선택 가능)
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {egogifts.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    {selectedKeywordId !== null ? "해당 키워드의 에고기프트가 없습니다." : "등록된 에고기프트가 없습니다."}
                  </div>
                ) : (
                  egogifts.map((egogift) => (
                    <label
                      key={egogift.egogiftId}
                      className="flex items-center gap-2 p-2 hover:bg-[#1c1c1f] rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEgogiftIds.includes(egogift.egogiftId)}
                        onChange={() => handleEgogiftToggle(egogift.egogiftId)}
                        className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400"
                      />
                      <span className="text-gray-300 text-sm">
                        {egogift.giftName}
                        {egogift.keywordName && (
                          <span className="text-gray-500 text-xs ml-2">({egogift.keywordName})</span>
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
                현재 연결된 에고기프트 ({selectedCategory?.categoryName})
              </h2>
              {fetching ? (
                <div className="text-gray-300">로딩 중...</div>
              ) : maps.length === 0 ? (
                <div className="text-gray-400 text-sm">연결된 에고기프트가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {maps.map((map) => {
                    const egogift = egogifts.find((e) => e.egogiftId === map.egogiftId);
                    return (
                      <div
                        key={`${map.egogiftId}-${map.egogiftCategoryId}`}
                        className="flex justify-between items-center p-3 bg-[#1c1c1f] border border-red-700/50 rounded"
                      >
                        <span className="text-gray-300 text-sm">
                          {egogift?.giftName || `에고기프트 ID: ${map.egogiftId}`}
                        </span>
                        <button
                          onClick={() => handleDelete(map.egogiftId, map.egogiftCategoryId)}
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


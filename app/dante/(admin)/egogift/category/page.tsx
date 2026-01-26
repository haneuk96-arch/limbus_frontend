"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface Category {
  egogiftCategoryId: number;
  categoryName: string;
  limitedYn?: string;
}

export default function EgoGiftCategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedLimitedYn, setSelectedLimitedYn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, [searchText, selectedLimitedYn]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "1",
        size: "10000",
      });
      if (searchText && searchText.trim()) {
        params.append("keyword", searchText.trim());
      }
      if (selectedLimitedYn) {
        params.append("limitedYn", selectedLimitedYn);
      }
      const res = await fetch(`${API_BASE_URL}/admin/egogift/category/list?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.items || []);
      }
    } catch (err) {
      console.error("카테고리 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchText(searchInput);
  };

  const handleLimitedYnFilter = (limitedYn: string | null) => {
    setSelectedLimitedYn(limitedYn);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/category/delete/one`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ egogiftCategoryId: id }),
      });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">에고기프트 카테고리 관리</h1>
        <Link
          href="/dante/egogift/category/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
      </div>

      {/* 검색 영역 */}
      <div className="mb-4 space-y-4">
        <div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="카테고리명으로 검색..."
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
            {(searchText || selectedLimitedYn !== null) && (
              <button
                onClick={() => {
                  setSearchText("");
                  setSearchInput("");
                  setSelectedLimitedYn(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 한정여부 필터 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleLimitedYnFilter(null)}
            className={`px-4 py-2 rounded font-medium text-sm ${
              selectedLimitedYn === null
                ? "bg-yellow-400 text-black"
                : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => handleLimitedYnFilter("N")}
            className={`px-4 py-2 rounded font-medium text-sm ${
              selectedLimitedYn === "N"
                ? "bg-yellow-400 text-black"
                : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
            }`}
          >
            일반
          </button>
          <button
            onClick={() => handleLimitedYnFilter("Y")}
            className={`px-4 py-2 rounded font-medium text-sm ${
              selectedLimitedYn === "Y"
                ? "bg-yellow-400 text-black"
                : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
            }`}
          >
            한정
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : (
        <div className="bg-[#131316] border border-red-700 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-red-700">
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">ID</th>
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">카테고리명</th>
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">한정여부</th>
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">관리</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      등록된 카테고리가 없습니다.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.egogiftCategoryId} className="border-b border-red-700/50">
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">{category.egogiftCategoryId}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">{category.categoryName}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          category.limitedYn === "Y"
                            ? "bg-red-700 text-white"
                            : "bg-gray-600 text-white"
                        }`}>
                          {category.limitedYn === "Y" ? "한정" : "일반"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dante/egogift/category/edit/${category.egogiftCategoryId}`}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(category.egogiftCategoryId)}
                            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


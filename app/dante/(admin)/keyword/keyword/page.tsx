"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface FileInfo {
  fileId: number;
  path: string;
  originalName: string;
  storedName: string;
}

interface Keyword {
  keywordId: number;
  keywordName: string;
  categoryId?: number;
  categoryName?: string;
  keywordDesc?: string;
  sortOrder?: number;
  useYn?: string;
  files?: FileInfo[];
}

interface Category {
  categoryId: number;
  categoryName: string;
}

export default function KeywordPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [selectedCategoryId, searchText]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/list?page=1&size=100`, {
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

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "0",
        size: "10000",
      });
      if (selectedCategoryId) {
        params.append("categoryId", String(selectedCategoryId));
      }
      if (searchText && searchText.trim()) {
        params.append("keywordName", searchText.trim());
      }
      const res = await fetch(`${API_BASE_URL}/admin/keyword?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.content || []);
      }
    } catch (err) {
      console.error("키워드 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchText(searchInput);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchKeywords();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-yellow-300">키워드 관리</h1>
        <Link
          href="/dante/keyword/keyword/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded"
        >
          등록
        </Link>
      </div>

      <div className="mb-4 space-y-4">
        {/* 검색 영역 */}
        <div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="키워드 이름으로 검색..."
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
            {(searchText || selectedCategoryId !== null) && (
              <button
                onClick={() => {
                  setSearchText("");
                  setSearchInput("");
                  setSelectedCategoryId(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded font-medium ${
              selectedCategoryId === null
                ? "bg-yellow-400 text-black"
                : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
            }`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category.categoryId}
              onClick={() => setSelectedCategoryId(category.categoryId)}
              className={`px-4 py-2 rounded font-medium ${
                selectedCategoryId === category.categoryId
                  ? "bg-yellow-400 text-black"
                  : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
              }`}
            >
              {category.categoryName}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : (
        <div className="bg-[#131316] border border-red-700 rounded">
          <table className="w-full">
            <thead>
              <tr className="border-b border-red-700">
                <th className="px-4 py-3 text-left text-yellow-300">ID</th>
                <th className="px-4 py-3 text-left text-yellow-300">키워드명</th>
                <th className="px-4 py-3 text-left text-yellow-300">카테고리</th>
                <th className="px-4 py-3 text-left text-yellow-300">이미지</th>
                <th className="px-4 py-3 text-left text-yellow-300">사용여부</th>
                <th className="px-4 py-3 text-left text-yellow-300">관리</th>
              </tr>
            </thead>
            <tbody>
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    등록된 키워드가 없습니다.
                  </td>
                </tr>
              ) : (
                keywords.map((keyword) => {
                  const firstFile = keyword.files && keyword.files.length > 0 ? keyword.files[0] : null;
                  // API_BASE_URL이 "http://localhost:8080/api"라면, 이미지 URL은 "http://localhost:8080/uploads/..."가 되어야 함
                  const baseUrl = API_BASE_URL.replace('/api', '');
                  const imageUrl = firstFile ? `${baseUrl}${firstFile.path}` : null;
                  
                  return (
                    <tr key={keyword.keywordId} className="border-b border-red-700/50">
                      <td className="px-4 py-3 text-gray-300">{keyword.keywordId}</td>
                      <td className="px-4 py-3 text-gray-300">{keyword.keywordName}</td>
                      <td className="px-4 py-3 text-gray-300">{keyword.categoryName || "-"}</td>
                      <td className="px-4 py-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={keyword.keywordName}
                            className="w-16 h-16 object-cover rounded border border-red-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {keyword.useYn || "Y"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dante/keyword/keyword/edit/${keyword.keywordId}`}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(keyword.keywordId)}
                            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


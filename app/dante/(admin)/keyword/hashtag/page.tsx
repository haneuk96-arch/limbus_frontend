"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { getCategoryName, HASHTAG_CATEGORIES } from "@/lib/hashtagCategories";

interface Hashtag {
  tagId: number;
  tagName: string;
  tagCategoryCd?: string;
}

export default function HashtagPage() {
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    fetchHashtags();
  }, []);

  const fetchHashtags = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "0",
        size: "100",
      });
      if (selectedCategory) {
        params.append("tagCategoryCd", selectedCategory);
      }
      const res = await fetch(`${API_BASE_URL}/admin/keyword/tag?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setHashtags(data.content || []);
      }
    } catch (err) {
      console.error("해시태그 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHashtags();
  }, [selectedCategory]);

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/tag/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchHashtags();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-yellow-300">해시태그 관리</h1>
        <Link
          href="/dante/keyword/hashtag/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded"
        >
          등록
        </Link>
      </div>

      <div className="mb-4">
        <label className="block text-yellow-300 text-sm font-medium mb-2">
          카테고리 필터
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
        >
          <option value="">전체</option>
          {HASHTAG_CATEGORIES.map((category) => (
            <option key={category.code} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : (
        <div className="bg-[#131316] border border-red-700 rounded">
          <table className="w-full">
            <thead>
              <tr className="border-b border-red-700">
                <th className="px-4 py-3 text-left text-yellow-300">ID</th>
                <th className="px-4 py-3 text-left text-yellow-300">해시태그명</th>
                <th className="px-4 py-3 text-left text-yellow-300">카테고리</th>
                <th className="px-4 py-3 text-left text-yellow-300">관리</th>
              </tr>
            </thead>
            <tbody>
              {hashtags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    등록된 해시태그가 없습니다.
                  </td>
                </tr>
              ) : (
                hashtags.map((hashtag) => (
                  <tr key={hashtag.tagId} className="border-b border-red-700/50">
                    <td className="px-4 py-3 text-gray-300">{hashtag.tagId}</td>
                    <td className="px-4 py-3 text-gray-300">{hashtag.tagName}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {getCategoryName(hashtag.tagCategoryCd)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/dante/keyword/hashtag/edit/${hashtag.tagId}`}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => handleDelete(hashtag.tagId)}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
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
      )}
    </div>
  );
}


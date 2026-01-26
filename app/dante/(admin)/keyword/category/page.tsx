"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface Category {
  categoryId: number;
  categoryName: string;
  sortOrder?: number;
  useYn?: string;
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/list?page=1&size=100`, {
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

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/delete/one`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ categoryId: id }),
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-yellow-300">카테고리 관리</h1>
        <Link
          href="/dante/keyword/category/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded"
        >
          등록
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : (
        <div className="bg-[#131316] border border-red-700 rounded">
          <table className="w-full">
            <thead>
              <tr className="border-b border-red-700">
                <th className="px-4 py-3 text-left text-yellow-300">ID</th>
                <th className="px-4 py-3 text-left text-yellow-300">카테고리명</th>
                <th className="px-4 py-3 text-left text-yellow-300">사용여부</th>
                <th className="px-4 py-3 text-left text-yellow-300">관리</th>
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
                  <tr key={category.categoryId} className="border-b border-red-700/50">
                    <td className="px-4 py-3 text-gray-300">{category.categoryId}</td>
                    <td className="px-4 py-3 text-gray-300">{category.categoryName}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {category.useYn || "Y"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/dante/keyword/category/edit/${category.categoryId}`}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => handleDelete(category.categoryId)}
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


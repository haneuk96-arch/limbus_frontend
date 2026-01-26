"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface Category {
  categoryId: number;
  categoryName: string;
}

export default function KeywordCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("키워드명을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      const data = {
        categoryId: categoryId ? Number(categoryId) : null,
        keywordName: name,
        keywordDesc: desc || "",
        sortOrder: sortOrder ? Number(sortOrder) : null,
      };
      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE_URL}/admin/keyword`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/keyword/keyword");
      } else {
        setError("등록에 실패했습니다.");
      }
    } catch (err) {
      setError("등록에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-yellow-300">키워드 등록</h1>
        <Link
          href="/dante/keyword/keyword"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded"
        >
          목록
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-6 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              키워드명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="키워드명을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              카테고리
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            >
              <option value="">선택 안함</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              설명
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="키워드 설명을 입력하세요"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              정렬순서
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="정렬순서를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              파일
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              accept="image/*"
            />
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
              href="/dante/keyword/keyword"
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


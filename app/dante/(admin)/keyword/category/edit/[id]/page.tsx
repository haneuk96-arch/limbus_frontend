"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

export default function CategoryEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategory();
  }, [id]);

  const fetchCategory = async () => {
    try {
      setFetching(true);
      // 카테고리 목록에서 해당 ID 찾기
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/list?page=1&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const category = data.items?.find((item: any) => item.categoryId === Number(id));
        if (category) {
          setName(category.categoryName || "");
        } else {
          setError("카테고리를 찾을 수 없습니다.");
        }
      }
    } catch (err) {
      console.error("카테고리 조회 실패:", err);
      setError("카테고리 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("카테고리명을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          categoryId: Number(id),
          categoryName: name 
        }),
      });

      if (res.ok) {
        router.push("/dante/keyword/category");
      } else {
        setError("수정에 실패했습니다.");
      }
    } catch (err) {
      setError("수정에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div>
        <div className="text-gray-300">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-yellow-300">카테고리 수정</h1>
        <Link
          href="/dante/keyword/category"
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
              카테고리명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="카테고리명을 입력하세요"
            />
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
              href="/dante/keyword/category"
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


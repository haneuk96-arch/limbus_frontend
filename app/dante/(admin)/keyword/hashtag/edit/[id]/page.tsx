"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { HASHTAG_CATEGORIES } from "@/lib/hashtagCategories";

export default function HashtagEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [categoryCd, setCategoryCd] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHashtag();
  }, [id]);

  const fetchHashtag = async () => {
    try {
      setFetching(true);
      // 해시태그 목록에서 해당 ID 찾기
      const res = await fetch(`${API_BASE_URL}/admin/keyword/tag?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const hashtag = data.content?.find((item: any) => item.tagId === Number(id));
        if (hashtag) {
          setName(hashtag.tagName || "");
          setCategoryCd(hashtag.tagCategoryCd || "");
        } else {
          setError("해시태그를 찾을 수 없습니다.");
        }
      }
    } catch (err) {
      console.error("해시태그 조회 실패:", err);
      setError("해시태그 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("해시태그명을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/keyword/tag/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          tagId: Number(id),
          tagCategoryCd: categoryCd || "",
          tagName: name 
        }),
      });

      if (res.ok) {
        router.push("/dante/keyword/hashtag");
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
        <h1 className="text-2xl font-bold text-yellow-300">해시태그 수정</h1>
        <Link
          href="/dante/keyword/hashtag"
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
              해시태그명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="해시태그명을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              카테고리
            </label>
            <select
              value={categoryCd}
              onChange={(e) => setCategoryCd(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            >
              <option value="">선택 안함</option>
              {HASHTAG_CATEGORIES.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
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
              href="/dante/keyword/hashtag"
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


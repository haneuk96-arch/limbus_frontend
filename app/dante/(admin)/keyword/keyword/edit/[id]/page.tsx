"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface Category {
  categoryId: number;
  categoryName: string;
}

interface FileInfo {
  fileId: number;
  path: string;
  originalName: string;
  storedName: string;
}

export default function KeywordEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<FileInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchKeyword();
  }, [id]);

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

  const fetchKeyword = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE_URL}/admin/keyword/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.keywordName || "");
        setDesc(data.keywordDesc || "");
        setSortOrder(data.sortOrder ? String(data.sortOrder) : "");
        setCategoryId(data.categoryId ? String(data.categoryId) : "");
        // 기존 파일 정보 설정 (첫 번째 파일만)
        if (data.files && data.files.length > 0) {
          setExistingFile(data.files[0]);
        }
      }
    } catch (err) {
      console.error("키워드 조회 실패:", err);
      setError("키워드 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
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
        keywordId: Number(id),
        categoryId: categoryId ? Number(categoryId) : null,
        keywordName: name,
        keywordDesc: desc || "",
        sortOrder: sortOrder ? Number(sortOrder) : null,
        useYn: "Y",
      };
      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE_URL}/admin/keyword`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/keyword/keyword");
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

  const handleDeleteFile = async () => {
    if (!existingFile) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/file/${existingFile.fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setExistingFile(null);
      } else {
        setError("파일 삭제에 실패했습니다.");
      }
    } catch (err) {
      setError("파일 삭제에 실패했습니다.");
      console.error(err);
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
        <h1 className="text-2xl font-bold text-yellow-300">키워드 수정</h1>
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
            {existingFile ? (
              <div className="flex items-center gap-4 p-4 bg-[#1c1c1f] border border-red-700 rounded">
                <img
                  src={`${API_BASE_URL.replace('/api', '')}${existingFile.path}`}
                  alt={existingFile.originalName}
                  className="w-24 h-24 object-cover rounded border border-red-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex-1">
                  <p className="text-gray-300 text-sm">{existingFile.originalName}</p>
                  <button
                    type="button"
                    onClick={handleDeleteFile}
                    className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                accept="image/*"
              />
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


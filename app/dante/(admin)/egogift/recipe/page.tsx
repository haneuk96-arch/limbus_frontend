"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface Recipe {
  recipeId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function EgoGiftRecipePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/admin/egogift/recipe/list?page=1&size=100`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.items || []);
      }
    } catch (err) {
      console.error("조합식 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/egogift/recipe/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchRecipes();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">에고기프트 조합식 관리</h1>
        <Link
          href="/dante/egogift/recipe/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
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
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">제목</th>
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">생성일자</th>
                  <th className="px-4 py-3 text-left text-yellow-300 text-sm sm:text-base">관리</th>
                </tr>
              </thead>
              <tbody>
                {recipes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      등록된 조합식이 없습니다.
                    </td>
                  </tr>
                ) : (
                  recipes.map((recipe) => (
                    <tr key={recipe.recipeId} className="border-b border-red-700/50">
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">{recipe.recipeId}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">{recipe.title}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm sm:text-base">
                        {new Date(recipe.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dante/egogift/recipe/edit/${recipe.recipeId}`}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(recipe.recipeId)}
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


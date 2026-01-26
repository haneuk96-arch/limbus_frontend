"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

interface CardPack {
  cardpackId: number;
  title: string;
  floors: number[];
  difficulty: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CardPackPage() {
  const router = useRouter();
  const [allCardPacks, setAllCardPacks] = useState<CardPack[]>([]);
  const [cardpacks, setCardpacks] = useState<CardPack[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  const fetchCardPacks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "1",
        size: "10000",
      });
      if (selectedDifficulty) {
        params.append("difficulty", selectedDifficulty);
      }
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/list?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAllCardPacks(data.items || []);
        setCardpacks(data.items || []);
      }
    } catch (err) {
      console.error("카드팩 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCardPacks();
  }, [selectedDifficulty]);

  const handleCardClick = (cardpack: CardPack) => {
    router.push(`/dante/dungeon/cardpack/edit/${cardpack.cardpackId}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchCardPacks();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">카드팩 관리</h1>
        <Link
          href="/dante/dungeon/cardpack/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
      </div>

      {/* 필터 버튼 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedDifficulty(null)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedDifficulty === null
              ? "bg-yellow-400 text-black"
              : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#131316]"
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setSelectedDifficulty("노말")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedDifficulty === "노말"
              ? "bg-yellow-400 text-black"
              : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#131316]"
          }`}
        >
          노말
        </button>
        <button
          onClick={() => setSelectedDifficulty("하드")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedDifficulty === "하드"
              ? "bg-yellow-400 text-black"
              : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#131316]"
          }`}
        >
          하드
        </button>
        <button
          onClick={() => setSelectedDifficulty("익스트림")}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedDifficulty === "익스트림"
              ? "bg-yellow-400 text-black"
              : "bg-[#1c1c1f] text-gray-300 border border-red-700 hover:bg-[#131316]"
          }`}
        >
          익스트림
        </button>
      </div>

      {loading ? (
        <div className="text-gray-300">로딩 중...</div>
      ) : cardpacks.length === 0 ? (
        <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
          등록된 카드팩이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5">
          {cardpacks.map((cardpack) => {
            const baseUrl = API_BASE_URL.replace('/api', '');
            const imageUrl = cardpack.thumbnail ? `${baseUrl}${cardpack.thumbnail}` : null;

            return (
              <div
                key={cardpack.cardpackId}
                className="bg-[#131316] border border-red-700 rounded p-0.5 hover:border-yellow-400 transition-colors relative"
                style={{ maxWidth: '140px' }}
              >
                {/* 이미지 영역 - 클릭 가능 */}
                <div 
                  onClick={() => handleCardClick(cardpack)}
                  className="relative w-full mb-0.5 cursor-pointer" 
                  style={{ height: '264px' }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={cardpack.title}
                      className="w-full h-full object-cover rounded border border-red-700/50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center rounded border border-red-700/50">
                      <span className="text-gray-500 text-[7px]">이미지 없음</span>
                    </div>
                  )}
                </div>

                {/* 정보 영역 */}
                <div className="space-y-0.5">
                  {/* 제목 - 클릭 가능 */}
                  <div 
                    onClick={() => handleCardClick(cardpack)}
                    className="text-[13px] font-bold text-[#d2b48c] truncate leading-tight text-center cursor-pointer hover:text-yellow-300"
                  >
                    {cardpack.title}
                  </div>
                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => handleDelete(e, cardpack.cardpackId)}
                    className="w-full px-2 py-1 bg-red-700 hover:bg-red-800 text-white text-[10px] rounded mt-1 font-medium"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import EnemyPreview from "@/components/EnemyPreview";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

interface Enemy {
  enemyId: number;
  name: string;
  image?: {
    fileId: number;
    path: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface EnemyDetail {
  enemyId: number;
  name: string;
  totalHealth?: string;
  health?: string;
  speed?: string;
  defense?: string;
  resistances?: {
    slash: string;
    pierce: string;
    blunt: string;
    wrath: string;
    lust: string;
    sloth: string;
    gluttony: string;
    gloom: string;
    pride: string;
    envy: string;
  };
  staggerRanges?: string[];
  traitKeywords: string[];
  bodyParts?: Array<{
    bodyPartId: number;
    name: string;
    attribute?: string;
    destructible?: string;
    destructionEffect?: string;
    specialNote?: string;
    health: string;
    speed: string;
    defense: string;
    resistances: {
      slash: string;
      pierce: string;
      blunt: string;
      wrath: string;
      lust: string;
      sloth: string;
      gluttony: string;
      gloom: string;
      pride: string;
      envy: string;
    };
    staggerRanges: string[];
    skills: Array<{
      skillId: number;
      name: string;
      icon?: {
        fileId: number;
        path: string;
      };
      attackType: string;
      sinAttribute: string;
      skillPower: string;
      coinPower: string;
      attackWeight: string;
      attackLevel: string;
      growthCoefficient: string;
      description: string;
      coins: Array<{
        coinId: number;
        description: string;
        indestructible?: string;
      }>;
    }>;
  }>;
  skills?: Array<{
    skillId: number;
    name: string;
    icon?: {
      fileId: number;
      path: string;
    };
    attackType: string;
    sinAttribute: string;
    skillPower: string;
    coinPower: string;
    attackWeight: string;
    attackLevel: string;
    growthCoefficient: string;
    description: string;
    coins: Array<{
      coinId: number;
      description: string;
      indestructible?: string;
    }>;
  }>;
  passives: Array<{
    passiveId: number;
    title: string;
    content: string;
  }>;
  mentalPowers: Array<{
    mentalPowerId: number;
    title: string;
    content: string;
  }>;
  image?: {
    fileId: number;
    path: string;
  };
}

export default function EnemyPage() {
  const router = useRouter();
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EnemyDetail | null>(null);
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]);

  const fetchEnemies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "1",
        size: "10000",
      });
      if (searchKeyword.trim()) {
        params.append("keyword", searchKeyword.trim());
      }
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy/list?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEnemies(data.items || []);
      }
    } catch (err) {
      console.error("적 목록 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllKeywords();
    fetchEnemies();
  }, [searchKeyword]);

  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword?page=0&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywords = data.content || [];
        const enrichedKeywords = keywords.map((k: any) => enrichKeywordData(k));
        setAllKeywords(enrichedKeywords);
      }
    } catch (err) {
      console.error("키워드 목록 조회 실패:", err);
    }
  };

  const handleEnemyClick = async (enemy: Enemy) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy/${enemy.enemyId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
        setShowPreview(true);
      }
    } catch (err) {
      console.error("적 정보 조회 실패:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        fetchEnemies();
      }
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">등장 적</h1>
        <Link
          href="/dante/dungeon/enemy/create"
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded text-sm sm:text-base"
        >
          등록
        </Link>
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="이름으로 검색..."
          className="w-full sm:w-auto px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
        />
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
          로딩 중...
        </div>
      ) : enemies.length === 0 ? (
        <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
          등록된 적이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {enemies.map((enemy) => (
            <div
              key={enemy.enemyId}
              className="bg-[#131316] border border-red-700 rounded p-4 cursor-pointer hover:bg-[#1a1a1d] transition-colors relative"
              onClick={() => handleEnemyClick(enemy)}
            >
              {enemy.image && (
                <div className="mb-3 flex justify-center">
                  <img
                    src={`${API_BASE_URL.replace('/api', '')}${enemy.image.path}`}
                    alt={enemy.name}
                    className="max-h-32 w-auto object-contain"
                  />
                </div>
              )}
              <h3 className="text-yellow-300 font-semibold mb-2">{enemy.name}</h3>
              <div className="text-gray-400 text-xs">
                <div>등록일: {new Date(enemy.createdAt).toLocaleDateString('ko-KR')}</div>
                <div>수정일: {new Date(enemy.updatedAt).toLocaleDateString('ko-KR')}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dante/dungeon/enemy/edit/${enemy.enemyId}`);
                  }}
                  className="flex-1 px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-xs rounded font-medium"
                >
                  수정
                </button>
                <button
                  onClick={(e) => handleDelete(e, enemy.enemyId)}
                  className="flex-1 px-2 py-1 bg-red-700 hover:bg-red-800 text-white text-xs rounded"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreview && previewData && (
        <EnemyPreview
          enemyData={previewData}
          allKeywords={allKeywords}
          onClose={() => {
            setShowPreview(false);
            setPreviewData(null);
          }}
          onEdit={() => {
            setShowPreview(false);
            setPreviewData(null);
            router.push(`/dante/dungeon/enemy/edit/${previewData.enemyId}`);
          }}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  deletePersonalityEgo,
  fetchPersonalityEgoList,
  PersonalityEgoListItem,
} from "@/lib/personalityEgoApi";

const personalityNameByOrder: Record<number, string> = {
  1: "이상",
  2: "파우스트",
  3: "돈키호테",
  4: "로슈",
  5: "뫼르소",
  6: "홍루",
  7: "히스클리프",
  8: "이스마엘",
  9: "로쟈",
  11: "싱클레어",
  12: "오티스",
  13: "그레고르",
};

function costSummary(r: PersonalityEgoListItem): string {
  const parts = [
    `분노 ${r.wrathCost}`,
    `색욕 ${r.lustCost}`,
    `나태 ${r.slothCost}`,
    `탐식 ${r.gluttonyCost}`,
    `우울 ${r.gloomCost}`,
    `오만 ${r.prideCost}`,
    `질투 ${r.envyCost}`,
  ];
  return parts.join(" · ");
}

export default function PersonalityEgoListPage() {
  const baseUrl = API_BASE_URL.replace("/api", "");
  const params = useParams<{ order: string }>();
  const order = Number(params.order);
  const personalityName = personalityNameByOrder[order];
  const [records, setRecords] = useState<PersonalityEgoListItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!personalityName) return;
    const load = async () => {
      try {
        setError("");
        const items = await fetchPersonalityEgoList(order);
        setRecords(items);
      } catch (e) {
        setError("목록을 불러오지 못했습니다.");
      }
    };
    load();
  }, [order, personalityName]);

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deletePersonalityEgo(id);
      const items = await fetchPersonalityEgoList(order);
      setRecords(items);
    } catch (e) {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
            {personalityName ? `${order}. ${personalityName} E.G.O 등록 목록` : "E.G.O 등록 목록"}
          </h1>
          {personalityName && (
            <p className="text-sm text-gray-300">
              현재 진행 인격: <span className="text-yellow-300 font-semibold">{order}. {personalityName}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {personalityName && (
            <Link
              href={`/dante/personality/ego/${order}/create`}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded text-sm sm:text-base"
            >
              등록
            </Link>
          )}
          <Link
            href="/dante/personality/ego"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
          >
            목록으로
          </Link>
        </div>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
        {!personalityName ? (
          <p className="text-sm text-red-300">존재하지 않는 인격 번호입니다.</p>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-400">빈 목록</p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.egoId}
                className="p-4 bg-[#1a1a1d] border border-red-700/70 rounded"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded overflow-hidden border border-red-700/70 bg-[#111] shrink-0 flex items-center justify-center min-w-[80px] min-h-[80px]">
                      {record.image?.path ? (
                        <img
                          src={`${baseUrl}${record.image.path}`}
                          alt={`${record.title} 썸네일`}
                          className="max-w-[120px] max-h-[120px] object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-2">
                          no image
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-yellow-300 font-semibold">
                        [{record.libraryGrade}] {record.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        속성: {record.sinAttribute} · 공격: {record.attackType}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">소모: {costSummary(record)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/dante/personality/ego/${order}/edit/${record.egoId}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.egoId)}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs rounded"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

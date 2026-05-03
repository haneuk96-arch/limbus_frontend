"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  deletePersonality,
  fetchPersonalityList,
  PersonalityListItem,
} from "@/lib/personalityApi";

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

export default function PersonalityListPage() {
  const baseUrl = API_BASE_URL.replace("/api", "");
  const params = useParams<{ order: string }>();
  const order = Number(params.order);
  const personalityName = personalityNameByOrder[order];
  const [records, setRecords] = useState<PersonalityListItem[]>([]);
  const [showAfterImageIds, setShowAfterImageIds] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!personalityName) return;
    const load = async () => {
      try {
        setError("");
        const items = await fetchPersonalityList(order);
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
      await deletePersonality(id);
      const items = await fetchPersonalityList(order);
      setRecords(items);
    } catch (e) {
      alert("삭제에 실패했습니다.");
    }
  };

  const toggleThumbnailImage = (record: PersonalityListItem) => {
    if (!record.beforeSyncImage?.path || !record.afterSyncImage?.path) return;
    setShowAfterImageIds((prev) => ({
      ...prev,
      [record.personalityId]: !prev[record.personalityId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
            {personalityName ? `${order}. ${personalityName} 등록 목록` : "인격 등록 목록"}
          </h1>
          {personalityName && (
            <p className="text-sm text-gray-300">
              현재 진입 인격: <span className="text-yellow-300 font-semibold">{order}. {personalityName}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {personalityName && (
            <Link
              href={`/dante/personality/${order}/create`}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded text-sm sm:text-base"
            >
              등록
            </Link>
          )}
          <Link
            href="/dante/personality"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
            {records.map((record) => (
              <div
                key={record.personalityId}
                className="rounded border border-red-700/70 overflow-hidden bg-[#1a1a1d]"
              >
                <button
                  type="button"
                  onClick={() => toggleThumbnailImage(record)}
                  className="relative w-full aspect-[4/5] bg-[#111] border-b border-red-700/60 flex items-center justify-center"
                  title="클릭하여 동기화 전/후 이미지 전환"
                >
                  {(record.beforeSyncImage?.path || record.afterSyncImage?.path) ? (
                    <img
                      src={`${baseUrl}${
                        showAfterImageIds[record.personalityId] && record.afterSyncImage?.path
                          ? record.afterSyncImage.path
                          : record.beforeSyncImage?.path ?? record.afterSyncImage!.path
                      }`}
                      alt={`${record.name} 썸네일`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-[10px] text-gray-500">no image</div>
                  )}
                  <span className="absolute top-2 left-2 inline-flex items-center rounded bg-black/65 px-2 py-0.5 text-[11px] text-yellow-300 border border-yellow-400/50">
                    {record.grade}성
                  </span>
                </button>

                <div className="p-3 space-y-2">
                  <p className="text-yellow-300 font-semibold text-sm leading-tight min-h-10">
                    {record.name}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    키워드: {record.keywords.join(", ") || "-"}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/dante/personality/${order}/edit/${record.personalityId}`}
                      className="flex-1 text-center px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.personalityId)}
                      className="flex-1 px-2 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs rounded"
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

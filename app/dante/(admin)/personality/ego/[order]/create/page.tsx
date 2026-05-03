"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { createPersonalityEgo } from "@/lib/personalityEgoApi";

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

const libraryGradeOptions = ["ZAYIN", "TETH", "HE", "WAW", "ALEPH"] as const;
const sinAttributeOptions = ["분노", "색욕", "나태", "탐식", "우울", "오만", "질투"] as const;
const attackTypeOptions = ["참격", "관통", "타격"] as const;

type CostState = {
  wrathCost: number;
  lustCost: number;
  slothCost: number;
  gluttonyCost: number;
  gloomCost: number;
  prideCost: number;
  envyCost: number;
};

const defaultCosts: CostState = {
  wrathCost: 0,
  lustCost: 0,
  slothCost: 0,
  gluttonyCost: 0,
  gloomCost: 0,
  prideCost: 0,
  envyCost: 0,
};

const costLabels: { key: keyof CostState; label: string }[] = [
  { key: "wrathCost", label: "분노" },
  { key: "lustCost", label: "색욕" },
  { key: "slothCost", label: "나태" },
  { key: "gluttonyCost", label: "탐식" },
  { key: "gloomCost", label: "우울" },
  { key: "prideCost", label: "오만" },
  { key: "envyCost", label: "질투" },
];

export default function PersonalityEgoCreatePage() {
  const params = useParams<{ order: string }>();
  const router = useRouter();
  const order = Number(params.order);
  const personalityName = personalityNameByOrder[order];
  const [title, setTitle] = useState("");
  const [costs, setCosts] = useState({ ...defaultCosts });
  const [libraryGrade, setLibraryGrade] = useState<string>("");
  const [sinAttribute, setSinAttribute] = useState<string>("");
  const [attackType, setAttackType] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setCost = (key: keyof CostState, raw: string) => {
    const n = raw === "" ? 0 : Math.max(0, Math.floor(Number(raw)) || 0);
    setCosts((prev) => ({ ...prev, [key]: n }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!libraryGrade) {
      setError("등급을 선택해주세요.");
      return;
    }
    if (!sinAttribute) {
      setError("속성을 선택해주세요.");
      return;
    }
    if (!attackType) {
      setError("공격유형을 선택해주세요.");
      return;
    }
    if (!image) {
      setError("이미지를 등록해주세요.");
      return;
    }

    try {
      setSaving(true);
      await createPersonalityEgo(
        {
          order,
          title: title.trim(),
          ...costs,
          libraryGrade,
          sinAttribute,
          attackType,
        },
        image
      );
      router.push(`/dante/personality/ego/${order}`);
    } catch (err) {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
            {personalityName ? `${order}. ${personalityName} E.G.O 등록` : "E.G.O 등록"}
          </h1>
          {personalityName && (
            <p className="text-sm text-gray-300">
              현재 등록 대상: <span className="text-yellow-300 font-semibold">{order}. {personalityName}</span>
            </p>
          )}
        </div>
        <Link
          href={personalityName ? `/dante/personality/ego/${order}` : "/dante/personality/ego"}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded"
        >
          목록으로
        </Link>
      </div>

      {!personalityName ? (
        <p className="text-sm text-red-300">존재하지 않는 인격 번호입니다.</p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 space-y-6 max-w-4xl">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="E.G.O 제목"
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">이미지 (1장)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-800 file:text-white"
            />
          </div>

          <div>
            <p className="text-yellow-300 text-sm font-medium mb-3">소모 자원 (0 이상, 기본 0)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {costLabels.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={costs[key]}
                    onChange={(e) => setCost(key, e.target.value)}
                    className="w-full px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">등급</label>
            <div className="flex flex-wrap gap-2">
              {libraryGradeOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setLibraryGrade(g)}
                  className={`px-3 py-1.5 rounded text-sm border ${
                    libraryGrade === g
                      ? "bg-yellow-500 text-black border-yellow-400"
                      : "bg-[#1c1c1f] text-gray-200 border-red-700 hover:border-yellow-400/60"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">속성</label>
            <div className="flex flex-wrap gap-2">
              {sinAttributeOptions.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setSinAttribute(a)}
                  className={`px-3 py-1.5 rounded text-sm border ${
                    sinAttribute === a
                      ? "bg-yellow-500 text-black border-yellow-400"
                      : "bg-[#1c1c1f] text-gray-200 border-red-700 hover:border-yellow-400/60"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">공격유형</label>
            <div className="flex flex-wrap gap-2">
              {attackTypeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAttackType(t)}
                  className={`px-3 py-1.5 rounded text-sm border ${
                    attackType === t
                      ? "bg-yellow-500 text-black border-yellow-400"
                      : "bg-[#1c1c1f] text-gray-200 border-red-700 hover:border-yellow-400/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-black font-semibold rounded"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

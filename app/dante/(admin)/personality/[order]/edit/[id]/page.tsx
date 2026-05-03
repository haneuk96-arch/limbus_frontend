"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchPersonalityDetail,
  updatePersonality,
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

const keywordOptions = ["화상", "출혈", "진동", "파열", "침잠", "호흡", "충전", "탄환"] as const;
const skillAttributeOptions = ["분노", "색욕", "나태", "탐식", "우울", "오만", "질투"] as const;
const attackTypeOptions = ["참격", "관통", "타격"] as const;
type SkillFormRow = { uiKey: number; skillId?: number; name: string; attribute: string; attackType: string };

export default function PersonalityEditPage() {
  const params = useParams<{ order: string; id: string }>();
  const router = useRouter();
  const order = Number(params.order);
  const personalityName = personalityNameByOrder[order];
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [personalityId, setPersonalityId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillFormRow[]>([]);
  const [beforeSyncImageUrl, setBeforeSyncImageUrl] = useState<string | null>(null); // 기존 URL 표시용
  const [afterSyncImageUrl, setAfterSyncImageUrl] = useState<string | null>(null); // 기존 URL 표시용
  const [beforeSyncImageFile, setBeforeSyncImageFile] = useState<File | null>(null);
  const [afterSyncImageFile, setAfterSyncImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const detail = await fetchPersonalityDetail(Number(params.id));
        setPersonalityId(detail.personalityId);
        setName(detail.name);
        setGrade(detail.grade);
        setKeywords(detail.keywords ?? []);
        setSkills(
          (detail.skills ?? []).map((skill) => ({
            uiKey: skill.skillId,
            skillId: skill.skillId,
            name: skill.name,
            attribute: skill.attribute,
            attackType: skill.attackType,
          }))
        );
        setBeforeSyncImageUrl(detail.beforeSyncImage?.path ?? null);
        setAfterSyncImageUrl(detail.afterSyncImage?.path ?? null);
        setExists(true);
      } catch (e) {
        setExists(false);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [params.id]);

  const toggleKeyword = (keyword: string) => {
    setKeywords((prev) => (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]));
  };

  const addSkill = () => {
    setSkills((prev) => {
      const nextUiKey = prev.length > 0 ? Math.min(...prev.map((s) => s.uiKey)) - 1 : -1;
      return [...prev, { uiKey: nextUiKey, name: "", attribute: "", attackType: "" }];
    });
  };

  const removeSkill = (uiKey: number) => {
    setSkills((prev) => prev.filter((s) => s.uiKey !== uiKey));
  };

  const updateSkill = (uiKey: number, field: "name" | "attribute" | "attackType", value: string) => {
    setSkills((prev) => prev.map((s) => (s.uiKey === uiKey ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!personalityId) return;
    if (!name.trim()) {
      setError("인격 명을 입력해주세요.");
      return;
    }
    if (!grade) {
      setError("성급(1~3성)을 선택해주세요.");
      return;
    }
    if (skills.some((skill) => !skill.name.trim() || !skill.attribute || !skill.attackType)) {
      setError("모든 스킬의 이름/속성/공격유형을 입력해주세요.");
      return;
    }
    if (!beforeSyncImageUrl && !beforeSyncImageFile) {
      setError("동기화 전/후 이미지를 모두 등록해주세요.");
      return;
    }
    if (!afterSyncImageUrl && !afterSyncImageFile) {
      setError("동기화 전/후 이미지를 모두 등록해주세요.");
      return;
    }

    try {
      setSaving(true);
      await updatePersonality(
        personalityId,
        {
          order,
          name: name.trim(),
          grade,
          keywords,
          skills: skills.map((skill) => ({
            ...(skill.skillId ? { skillId: skill.skillId } : {}),
            name: skill.name.trim(),
            attribute: skill.attribute,
            attackType: skill.attackType,
          })),
        },
        beforeSyncImageFile,
        afterSyncImageFile
      );
      router.push(`/dante/personality/${order}`);
    } catch (e) {
      setError("수정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <p className="text-gray-300">로딩 중...</p>;
  }

  if (!personalityName) {
    return <p className="text-red-300">존재하지 않는 인격 번호입니다.</p>;
  }

  if (!exists) {
    return (
      <div className="space-y-4">
        <p className="text-red-300">존재하지 않는 데이터입니다.</p>
        <Link
          href={`/dante/personality/${order}`}
          className="inline-block px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
        >
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
          {order}. {personalityName} 인격 수정
        </h1>
        <Link
          href={`/dante/personality/${order}`}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded"
        >
          목록으로
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 space-y-6 max-w-4xl">
        <div>
          <label className="block text-yellow-300 text-sm font-medium mb-2">인격명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-yellow-300 text-sm font-medium mb-2">성급</label>
          <div className="flex gap-2">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGrade(value)}
                className={`px-4 py-2 rounded border text-sm font-medium ${
                  grade === value
                    ? "bg-yellow-400 text-black border-yellow-400"
                    : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#242428]"
                }`}
              >
                {value}성
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-yellow-300 text-sm font-medium mb-2">키워드</label>
          <div className="flex flex-wrap gap-2">
            {keywordOptions.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => toggleKeyword(keyword)}
                className={`px-4 py-2 rounded border text-sm font-medium ${
                  keywords.includes(keyword)
                    ? "bg-yellow-400 text-black border-yellow-400"
                    : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#242428]"
                }`}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-yellow-300 text-sm font-medium">스킬 목록</label>
            <button type="button" onClick={addSkill} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
              스킬 추가
            </button>
          </div>
          <div className="space-y-3">
            {skills.map((skill, index) => (
              <div key={skill.uiKey} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_140px_auto] gap-2 p-3 bg-[#1a1a1d] border border-red-700/70 rounded">
                <input
                  type="text"
                  value={skill.name}
                  onChange={(e) => updateSkill(skill.uiKey, "name", e.target.value)}
                  className="px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                  placeholder={`스킬명 ${index + 1}`}
                />
                <select
                  value={skill.attribute}
                  onChange={(e) => updateSkill(skill.uiKey, "attribute", e.target.value)}
                  className="px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                >
                  <option value="">스킬속성 선택</option>
                  {skillAttributeOptions.map((attribute) => (
                    <option key={attribute} value={attribute}>
                      {attribute}
                    </option>
                  ))}
                </select>
                <select
                  value={skill.attackType}
                  onChange={(e) => updateSkill(skill.uiKey, "attackType", e.target.value)}
                  className="px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                >
                  <option value="">공격유형 선택</option>
                  {attackTypeOptions.map((attackType) => (
                    <option key={attackType} value={attackType}>
                      {attackType}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeSkill(skill.uiKey)}
                  disabled={skills.length === 1}
                  className="px-3 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">동기화 전 이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBeforeSyncImageFile(file);
              }}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            />
            {beforeSyncImageUrl && <p className="text-xs text-gray-400 mt-2">기존 이미지가 등록되어 있습니다.</p>}
          </div>
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">동기화 후 이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAfterSyncImageFile(file);
              }}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            />
            {afterSyncImageUrl && <p className="text-xs text-gray-400 mt-2">기존 이미지가 등록되어 있습니다.</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-60"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}


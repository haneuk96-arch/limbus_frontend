"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import KeywordHighlight from "@/components/KeywordHighlight";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";
import { API_BASE_URL } from "@/lib/api";

interface FileInfo {
  fileId: number;
  path: string;
  originalName?: string;
  storedName?: string;
}

interface SkillCoin {
  coinId: number;
  description: string;
  indestructible?: string;
}

interface Skill {
  skillId: number;
  name: string;
  icon?: FileInfo;
  attackType: string;
  sinAttribute: string;
  skillLevel?: string;
  skillPower: string;
  coinPower: string;
  attackWeight: string;
  attackLevel: string;
  growthCoefficient: string;
  description: string;
  coins: SkillCoin[];
}

interface BodyPart {
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
  skills: Skill[];
  passives?: Passive[];  // 부위별 패시브
}

interface Passive {
  passiveId: number;
  title: string;
  content: string;
}

interface MentalPower {
  mentalPowerId: number;
  title: string;
  content: string;
}

interface EnemyData {
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
  bodyParts?: BodyPart[];
  skills?: Skill[];
  passives: Passive[];
  mentalPowers: MentalPower[];
  image?: FileInfo;
}

interface EnemyPreviewProps {
  enemyData: EnemyData;
  allKeywords?: KeywordData[];
  onClose: () => void;
  onEdit?: () => void;
}

const resistanceOptions = [
  { value: "2", label: "취약(2)" },
  { value: "1.5", label: "약점(1.5)" },
  { value: "1.25", label: "약점(1.25)" },
  { value: "1.2", label: "약점(1.2)" },
  { value: "1", label: "보통(1)" },
  { value: "0.75", label: "견딤(0.75)" },
  { value: "0.5", label: "내성(0.5)" },
  { value: "0", label: "면역(0)" },
];

const skillTypes = [
  { value: "slash", label: "참격" },
  { value: "pierce", label: "관통" },
  { value: "blunt", label: "타격" },
  { value: "defense", label: "방어" },
  { value: "evade", label: "회피" },
  { value: "counter", label: "반격" },
  { value: "enhanced_defense", label: "강화방어" },
  { value: "enhanced_counter", label: "강화반격" },
];

const sinAttributes = [
  { value: "none", label: "없음" },
  { value: "wrath", label: "분노" },
  { value: "lust", label: "색욕" },
  { value: "sloth", label: "나태" },
  { value: "gluttony", label: "탐식" },
  { value: "gloom", label: "우울" },
  { value: "pride", label: "오만" },
  { value: "envy", label: "질투" },
];

const getResistanceLabel = (value: string) => {
  const option = resistanceOptions.find(opt => opt.value === value);
  return option ? option.label : value || "-";
};

/** E_SKILL_{죄악속성}_{스킬레벨}.webp - 스킬 아이콘 감쌀 프레임 */
const getSkillFrameSrc = (sinAttribute: string, skillLevel: string): string | null => {
  const attr = (sinAttribute || "").toUpperCase();
  if (!attr || attr === "NONE") return null;
  const level = ["1", "2", "3"].includes(skillLevel || "") ? skillLevel : "1";
  return `/images/enemy/E_SKILL_${attr}_${level}.webp`;
};

/* 프레임 내부 육각형 clip-path (참고: Limbus 위키) */
const SKILL_HEX_CLIP = "polygon(73% 2%, 98% 36%, 90% 80%, 50% 100%, 10% 80%, 2% 36%, 27% 2%)";

function SkillIconWithFrame({
  skill,
  baseUrl,
  size = "md",
}: {
  skill: Skill;
  baseUrl: string;
  size?: "sm" | "md";
}) {
  if (!skill.icon) return null;
  const frameSrc = getSkillFrameSrc(skill.sinAttribute, skill.skillLevel ?? "");
  /* 기존 크기(sm 3rem, md 4rem)에서 10% 확대 */
  const wrapper = size === "sm" ? "w-[3.3rem] h-[3.3rem]" : "w-[4.4rem] h-[4.4rem]";
  const iconSize = size === "sm" ? "w-8 h-8" : "w-11 h-11";
  const iconPx = size === "sm" ? "2.2rem" : "3.025rem";
  /* 참고 사이트: top/left ~12%, 영역 ~76% (74/112) */
  const inset = "12%";
  const iconArea = "76%";
  return (
    <div className={`relative ${wrapper} flex-shrink-0 overflow-visible`}>
      {/* 스킬 아이콘 (z-index:2) - clip-path 육각형으로 잘라서 프레임 밖 투명 영역에 안 보이게 */}
      <div
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          width: iconArea,
          height: iconArea,
          zIndex: 2,
          pointerEvents: "none",
          clipPath: SKILL_HEX_CLIP,
          WebkitClipPath: SKILL_HEX_CLIP,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={`${baseUrl}${skill.icon!.path}`}
          alt={skill.name || "스킬 아이콘"}
          className={`${iconSize} object-contain`}
          style={{ width: iconPx, height: iconPx, transform: "translate(1px, 4px)" }}
        />
      </div>
      {/* 프레임 이미지 (z-index:3) - 가장 위 */}
      {frameSrc && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }}>
          <img src={frameSrc} alt="" className="w-full h-full object-contain object-center" />
        </div>
      )}
    </div>
  );
}

const getResistanceColor = (value: string): string => {
  if (!value || value === "-") return "#ededed";
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return "#ededed";
  
  // 1.0이면 기본 색상
  if (numValue === 1.0) return "#ededed";
  
  // 1.0보다 크면 빨간색 계열 (1.0 ~ 2.0)
  if (numValue > 1.0) {
    const intensity = Math.min((numValue - 1.0) / 1.0, 1.0); // 0.0 ~ 1.0
    // 파스텔 빨강: hsl(0, 60%, 75% ~ 85%)
    const lightness = 85 - intensity * 10; // 85% ~ 75%
    return `hsl(0, 60%, ${lightness}%)`;
  }
  
  // 1.0보다 작으면 파란색 계열 (0.0 ~ 1.0)
  if (numValue < 1.0) {
    const intensity = Math.min((1.0 - numValue) / 1.0, 1.0); // 0.0 ~ 1.0
    // 파스텔 파랑: hsl(240, 60%, 75% ~ 85%)
    const lightness = 85 - intensity * 10; // 85% ~ 75%
    return `hsl(240, 60%, ${lightness}%)`;
  }
  
  return "#ededed";
};

const attackTypeIcons: Record<string, string> = {
  slash: "/images/enemy/E_SLASH.webp",
  pierce: "/images/enemy/E_PIERCE.webp",
  blunt: "/images/enemy/E_BLUNT.webp",
};

const sinAttributeIcons: Record<string, string> = {
  wrath: "/images/enemy/E_WRATH.webp",
  lust: "/images/enemy/E_LUST.webp",
  sloth: "/images/enemy/E_SLOTH.webp",
  gluttony: "/images/enemy/E_GLUTTONY.webp",
  gloom: "/images/enemy/E_GLOOM.webp",
  pride: "/images/enemy/E_PRIDE.webp",
  envy: "/images/enemy/E_ENVY.webp",
};

const attackTypeKeys = ["slash", "pierce", "blunt"] as const;
const attackTypeLabels: Record<string, string> = { slash: "참격", pierce: "관통", blunt: "타격" };
const sinKeys = ["wrath", "lust", "sloth", "gluttony", "gloom", "pride", "envy"] as const;
const sinLabels: Record<string, string> = {
  wrath: "분노", lust: "색욕", sloth: "나태", gluttony: "탐식", gloom: "우울", pride: "오만", envy: "질투",
};

type Resistances = {
  slash?: string; pierce?: string; blunt?: string;
  wrath?: string; lust?: string; sloth?: string; gluttony?: string; gloom?: string; pride?: string; envy?: string;
};

function AttackTypeResistances({ resistances, className = "" }: { resistances: Resistances; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-2 gap-y-2 ${className}`}>
      {attackTypeKeys.map((k) => {
        const v = resistances?.[k] ?? "";
        const icon = attackTypeIcons[k];
        const label = getResistanceLabel(v);
        const textLabel = attackTypeLabels[k];
        return (
          <div key={k} className="flex flex-col items-center gap-1">
            <span className="text-[#8a8580] text-xs">{textLabel}</span>
            {icon && (
              <img src={icon} alt={textLabel} className="w-5 h-5 object-contain flex-shrink-0" />
            )}
            <span className="text-xs" style={{ color: getResistanceColor(v) }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SinAttributeResistances({ resistances, className = "" }: { resistances: Resistances; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-2 gap-y-2 ${className}`}>
      {sinKeys.map((k) => {
        const v = resistances?.[k] ?? "";
        const icon = sinAttributeIcons[k];
        const label = getResistanceLabel(v);
        const textLabel = sinLabels[k];
        return (
          <div key={k} className="flex flex-col items-center gap-1">
            <span className="text-[#8a8580] text-xs">{textLabel}</span>
            {icon && (
              <img src={icon} alt={textLabel} className="w-5 h-5 object-contain flex-shrink-0" />
            )}
            <span className="text-xs" style={{ color: getResistanceColor(v) }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const getSkillTypeLabel = (value: string) => {
  const option = skillTypes.find(opt => opt.value === value);
  return option ? option.label : value;
};

const getSinAttributeLabel = (value: string) => {
  const option = sinAttributes.find(opt => opt.value === value);
  return option ? option.label : value;
};

const getSinAttributeColor = (value: string): string => {
  const colors: Record<string, string> = {
    wrath: "#ffb3ba",    // 분노 - 빨강
    lust: "#ffd3a5",      // 색욕 - 주황
    sloth: "#ffefba",     // 나태 - 노랑
    gluttony: "#baffc9",  // 탐식 - 초록
    gloom: "#bae1ff",     // 우울 - 파랑
    pride: "#c4c4ff",     // 오만 - 보라
    envy: "#e0baff",      // 질투 - 보라/분홍
  };
  return colors[value] || "#ededed";
};

function getInitialCollapsedState(enemyData: EnemyPreviewProps["enemyData"]) {
  const bodyPartIds = new Set<number>();
  const skillIds = new Set<number>();
  const parts = enemyData?.bodyParts ?? [];
  parts.forEach((p) => {
    if ((p.skills?.length ?? 0) > 0) {
      bodyPartIds.add(p.bodyPartId);
      p.skills!.forEach((s) => skillIds.add(s.skillId));
    }
  });
  if (!parts.length && enemyData?.skills?.length) {
    enemyData.skills.forEach((s) => skillIds.add(s.skillId));
  }
  return { bodyPartIds, skillIds };
}

export default function EnemyPreview({ enemyData, allKeywords = [], onClose, onEdit }: EnemyPreviewProps) {
  const [mounted, setMounted] = useState(false);
  const [collapsedSkillIds, setCollapsedSkillIds] = useState<Set<number>>(() =>
    getInitialCollapsedState(enemyData).skillIds
  );
  const [collapsedBodyPartIds, setCollapsedBodyPartIds] = useState<Set<number>>(() =>
    getInitialCollapsedState(enemyData).bodyPartIds
  );

  const toggleSkillCollapse = (skillId: number) => {
    setCollapsedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const toggleBodyPartCollapse = (bodyPartId: number) => {
    setCollapsedBodyPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(bodyPartId)) next.delete(bodyPartId);
      else next.add(bodyPartId);
      return next;
    });
  };

  /** 해당 부위 + 안의 모든 스킬 펼치기 */
  const expandAllInBodyPart = (bodyPartId: number) => {
    const part = enemyData.bodyParts?.find((p) => p.bodyPartId === bodyPartId);
    if (!part?.skills?.length) return;
    setCollapsedBodyPartIds((prev) => {
      const next = new Set(prev);
      next.delete(bodyPartId);
      return next;
    });
    setCollapsedSkillIds((prev) => {
      const next = new Set(prev);
      part.skills!.forEach((skill) => next.delete(skill.skillId));
      return next;
    });
  };

  /** 해당 부위 + 안의 모든 스킬 접기 */
  const collapseAllInBodyPart = (bodyPartId: number) => {
    const part = enemyData.bodyParts?.find((p) => p.bodyPartId === bodyPartId);
    if (!part?.skills?.length) return;
    setCollapsedSkillIds((prev) => {
      const next = new Set(prev);
      part.skills!.forEach((skill) => next.add(skill.skillId));
      return next;
    });
    setCollapsedBodyPartIds((prev) => {
      const next = new Set(prev);
      next.add(bodyPartId);
      return next;
    });
  };

  useEffect(() => {
    setMounted(true);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!mounted) return null;

  const baseUrl = API_BASE_URL.replace('/api', '');

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-[#b8860b]/40 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shadow-lg shadow-[#ffcc33]/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 p-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-[#ffcc33]">{enemyData.name}</h2>
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-[#ffcc33] hover:bg-[#ffd700] text-black font-semibold rounded transition-colors"
              >
                수정
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 이미지와 특성 키워드 같은 레벨 */}
          <div className="flex gap-6 items-start">
            {/* 이미지 (왼쪽) */}
            {enemyData.image && (
              <div className="flex-shrink-0">
                <img
                  src={`${baseUrl}${enemyData.image.path}`}
                  alt={enemyData.name}
                  className="max-h-64 w-auto object-contain border border-[#b8860b]/40 rounded"
                />
              </div>
            )}
            {/* 특성 키워드 (오른쪽) */}
            {enemyData.traitKeywords && enemyData.traitKeywords.length > 0 && (
              <div className="flex-1">
                <h3 className="text-[#ffcc33] text-lg font-semibold mb-3">특성 키워드</h3>
                <div className="flex flex-wrap gap-2">
                  {enemyData.traitKeywords.map((keyword, index) => (
                    <span key={index} className="px-3 py-1 bg-[#ffcc33]/20 border border-[#ffcc33]/50 rounded text-[#ffcc33]">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 전체 체력 */}
          {enemyData.totalHealth && (
            <div>
              <label className="block text-[#ffcc33] text-sm font-medium mb-1">전체 체력</label>
              <div className="text-[#ededed]">{enemyData.totalHealth}</div>
            </div>
          )}

          {/* 부위 정보 */}
          {enemyData.bodyParts && enemyData.bodyParts.length > 0 ? (
            <div>
              <h3 className="text-[#ffcc33] text-lg font-semibold mb-3">부위</h3>
              <div className="space-y-6">
                {enemyData.bodyParts.map((part) => {
                  const isBodyPartExpanded = !collapsedBodyPartIds.has(part.bodyPartId);
                  return (
                  <div key={part.bodyPartId} className="border border-[#b8860b]/40 rounded p-4 bg-[#1a1a1f]">
                    <div className="mb-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h4 className="text-[#ffcc33] font-semibold text-lg">{part.name}</h4>
                        {part.skills && part.skills.length > 0 && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => expandAllInBodyPart(part.bodyPartId)}
                              className="px-2 py-1 text-xs rounded bg-[#b8860b]/20 border border-[#b8860b]/50 text-[#ffcc33] hover:bg-[#b8860b]/30 transition-colors"
                            >
                              모두 펼치기
                            </button>
                            <button
                              type="button"
                              onClick={() => collapseAllInBodyPart(part.bodyPartId)}
                              className="px-2 py-1 text-xs rounded bg-[#b8860b]/20 border border-[#b8860b]/50 text-[#ffcc33] hover:bg-[#b8860b]/30 transition-colors"
                            >
                              모두 접기
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleBodyPartCollapse(part.bodyPartId)}
                              className="text-gray-400 hover:text-[#ffcc33] text-sm"
                              aria-label={isBodyPartExpanded ? "접기" : "펼치기"}
                            >
                              {isBodyPartExpanded ? "▼" : "▶"}
                            </button>
                          </div>
                        )}
                      </div>
                      {(part.attribute || part.destructible || part.destructionEffect || part.specialNote) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-sm">
                          {part.attribute && (
                            <div>
                              <span className="text-[#8a8580]">부위 속성: </span>
                              <span className="text-[#ededed]">
                                {part.attribute === "head" ? "머리" :
                                 part.attribute === "torso" ? "몸통" :
                                 part.attribute === "left_arm" ? "왼팔" :
                                 part.attribute === "right_arm" ? "오른팔" :
                                 part.attribute === "waist" ? "허리" :
                                 part.attribute === "legs" ? "다리" : part.attribute}
                              </span>
                            </div>
                          )}
                          {part.destructible && (
                            <div>
                              <span className="text-[#8a8580]">파괴가능여부: </span>
                              <span className="text-[#ededed]">
                                {part.destructible === "impossible" ? "파괴 및 적출 불가" :
                                 part.destructible === "destructible" ? "파괴 가능" :
                                 part.destructible === "destructible_and_extractable" ? "파괴 및 적출 가능" : part.destructible}
                              </span>
                            </div>
                          )}
                          {part.destructionEffect && (
                            <div>
                              <span className="text-gray-400">파괴효과: </span>
                              <span className="text-[#ededed]">{part.destructionEffect}</span>
                            </div>
                          )}
                          {part.specialNote && (
                            <div>
                              <span className="text-[#8a8580]">특이사항: </span>
                              <span className="text-[#ededed]">{part.specialNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 부위별 기본 정보 (체력·속도·방어·흐트러짐 구간 같은 높이) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                      <div>
                        <label className="block text-[#b8a88a] text-sm font-medium mb-0.5">체력</label>
                        <div className="text-[#ededed]">{part.health || "-"}</div>
                      </div>
                      <div>
                        <label className="block text-[#b8a88a] text-sm font-medium mb-1">속도</label>
                        <div className="text-[#ededed]">{part.speed || "-"}</div>
                      </div>
                      <div>
                        <label className="block text-[#b8a88a] text-sm font-medium mb-1">방어</label>
                        <div className="text-[#ededed]">{part.defense || "-"}</div>
                      </div>
                      <div>
                        <label className="block text-[#b8a88a] text-sm font-medium mb-1">흐트러짐 구간</label>
                        <div className="flex flex-wrap gap-2">
                          {part.staggerRanges && part.staggerRanges.length > 0
                            ? part.staggerRanges.map((range, idx) => (
                                <span key={idx} className="px-2 py-1 bg-[#0f0f0f] border border-[#b8860b]/40 rounded text-[#ededed] text-xs">
                                  {range}%
                                </span>
                              ))
                            : <span className="text-[#ededed]">-</span>
                          }
                        </div>
                      </div>
                    </div>

                    {/* 부위별 내성 (공격타입 + 속성별 같은 높이) */}
                    <div className="mb-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <h5 className="text-[#b8a88a] text-sm font-medium mb-1">공격 타입 내성</h5>
                        <AttackTypeResistances resistances={part.resistances || {}} />
                      </div>
                      <div>
                        <h5 className="text-[#b8a88a] text-sm font-medium mb-1">속성별 내성</h5>
                        <SinAttributeResistances resistances={part.resistances || {}} />
                      </div>
                    </div>

                    {/* 부위별 스킬 */}
                    {part.skills && part.skills.length > 0 && (
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden mt-4 ${isBodyPartExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <h5 className="text-[#b8a88a] text-base font-medium mb-2">스킬</h5>
                          <div className="space-y-3">
                          {part.skills.map((skill) => {
                            const isExpanded = !collapsedSkillIds.has(skill.skillId);
                            const visibleCoins = (skill.coins || []).filter(
                              (coin) => coin.description && coin.description.trim() !== ""
                            );
                            const hasDetail = skill.description || visibleCoins.length > 0;
                            return (
                            <div key={skill.skillId} className="border border-[#b8860b]/30 rounded p-3 bg-[#0f0f0f]">
                              <div className="flex gap-3 items-start mb-2">
                                <div className="flex flex-col items-center flex-shrink-0">
                                  {(() => {
                                    const n = parseInt(skill.coinPower ?? "", 10);
                                    const coinStr = !isNaN(n) ? (n > 0 ? `+${n}` : `${n}`) : (skill.coinPower || "-");
                                    return (
                                      <div className="-mb-[2px] text-[14px] text-[#ededed] font-medium leading-none">
                                        {coinStr}
                                      </div>
                                    );
                                  })()}
                                  <div className="mt-0.5">
                                    <SkillIconWithFrame skill={skill} baseUrl={baseUrl} size="sm" />
                                  </div>
                                  <div className="mt-0 flex items-center justify-center gap-1">
                                    <span className="text-[14px] text-[#ededed]">{skill.skillPower || "-"}</span>
                                    {attackTypeIcons[(skill.attackType || "").toLowerCase()] && (
                                      <img
                                        src={attackTypeIcons[(skill.attackType || "").toLowerCase()]}
                                        alt=""
                                        className="w-4 h-4 object-contain"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-0">
                                      <h6 
                                        className="font-medium text-sm"
                                        style={{ color: getSinAttributeColor(skill.sinAttribute) }}
                                      >
                                        {skill.name || "이름 없음"}
                                      </h6>
                                      {skill.coins && skill.coins.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                          {skill.coins.map((coin, i) => (
                                            <img
                                              key={i}
                                              src={coin.indestructible === "Y" ? "/images/enemy/E_COIN_UNBREAKABLE.webp" : "/images/enemy/E_COIN.webp"}
                                              alt=""
                                              className="w-4 h-4 object-contain"
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {skill.attackWeight && !isNaN(parseInt(skill.attackWeight)) && (
                                      <div className="-mt-0.5 mb-1">
                                        <span className="text-[#ffcc33] text-sm leading-none">
                                          {Array(parseInt(skill.attackWeight)).fill("■").join("")}
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-xs">
                                      <div>
                                        <span className="text-[#8a8580]">공격레벨: </span>
                                        <span className="text-[#ededed]">
                                          {skill.attackLevel || "-"}
                                          {(() => {
                                            const growth = parseFloat(skill.growthCoefficient ?? "");
                                            if (!isNaN(growth) && growth !== 0) {
                                              const sign = growth > 0 ? "+" : "";
                                              return ` ( 적 레벨 ${sign}${growth} )`;
                                            }
                                            return "";
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {hasDetail && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSkillCollapse(skill.skillId)}
                                      className="text-gray-400 hover:text-[#ffcc33] text-xs flex-shrink-0"
                                      aria-label={isExpanded ? "접기" : "펼치기"}
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {hasDetail && (
                                <div
                                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                                >
                                  <div className="min-h-0 overflow-hidden">
                                    {skill.description && (
                                      <div className="mb-2">
                                        <div className="text-[#8a8580] text-xs mb-1">스킬 설명:</div>
                                        <div className="text-[#ededed] text-xs whitespace-pre-line">
                                          <KeywordHighlight text={skill.description} keywords={allKeywords} />
                                        </div>
                                      </div>
                                    )}
                                    {visibleCoins.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        <div className="text-[#8a8580] text-xs font-medium">코인별 효과</div>
                                        {skill.coins!.map((coin, coinIndex) => {
                                          if (!coin.description || !coin.description.trim()) return null;
                                          return (
                                            <div key={coin.coinId} className="pl-3 border-l-2 border-[#b8860b]/30">
                                              <div className="flex items-start gap-2">
                                                <img
                                                  src={`/images/enemy/CoinEffect${coinIndex + 1}.webp`}
                                                  alt={`코인 ${coinIndex + 1}`}
                                                  className="w-6 h-6 object-contain flex-shrink-0"
                                                />
                                                <div className="text-[#ededed] text-xs whitespace-pre-line">
                                                  <KeywordHighlight text={coin.description} keywords={allKeywords} />
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                        </div>
                      </div>
                    )}

                    {/* 부위별 패시브 */}
                    {part.passives && part.passives.length > 0 && (
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden mt-4 ${isBodyPartExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <h5 className="text-[#b8a88a] text-base font-medium mb-2">패시브</h5>
                          <div className="space-y-3">
                            {part.passives.map((passive) => (
                              <div key={passive.passiveId} className="border border-[#34d399]/40 rounded p-3 bg-[#0f0f0f]">
                                <h4 className="text-[#b8a88a] text-sm font-medium mb-2">{passive.title}</h4>
                                <div className="text-[#ededed] text-xs whitespace-pre-line">
                                  <KeywordHighlight text={passive.content || ""} keywords={allKeywords} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* 레거시: 최상위 기본 정보 (체력·속도·방어·흐트러짐 구간 같은 높이) */}
              {(enemyData.health || enemyData.speed || enemyData.defense || (enemyData.staggerRanges && enemyData.staggerRanges.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-[#b8a88a] text-sm font-medium mb-1">체력</label>
                    <div className="text-[#ededed]">{enemyData.health || "-"}</div>
                  </div>
                  <div>
                    <label className="block text-[#b8a88a] text-sm font-medium mb-1">속도</label>
                    <div className="text-[#ededed]">{enemyData.speed || "-"}</div>
                  </div>
                  <div>
                    <label className="block text-[#b8a88a] text-sm font-medium mb-1">방어</label>
                    <div className="text-[#ededed]">{enemyData.defense || "-"}</div>
                  </div>
                  <div>
                    <label className="block text-[#b8a88a] text-sm font-medium mb-1">흐트러짐 구간</label>
                    <div className="flex flex-wrap gap-2">
                      {enemyData.staggerRanges && enemyData.staggerRanges.length > 0
                        ? enemyData.staggerRanges.map((range, index) => (
                            <span key={index} className="px-2 py-1 bg-[#1a1a1f] border border-[#b8860b]/40 rounded text-[#ededed] text-xs">
                              {range}%
                            </span>
                          ))
                        : <span className="text-[#ededed]">-</span>
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* 레거시: 내성 (공격타입 + 속성별 같은 높이) */}
              {enemyData.resistances && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[#b8a88a] text-lg font-semibold mb-3">공격 타입 내성</h3>
                    <AttackTypeResistances resistances={enemyData.resistances} />
                  </div>
                  <div>
                    <h3 className="text-[#b8a88a] text-lg font-semibold mb-3">속성별 내성</h3>
                    <SinAttributeResistances resistances={enemyData.resistances} />
                  </div>
                </div>
              )}
            </>
          )}


          {/* 레거시: 최상위 스킬 (bodyParts가 없을 때만) */}
          {!enemyData.bodyParts && enemyData.skills && enemyData.skills.length > 0 && (
            <div>
              <h3 className="text-[#ffcc33] text-lg font-semibold mb-3">스킬</h3>
              <div className="space-y-4">
                {enemyData.skills.map((skill) => {
                  const isExpanded = !collapsedSkillIds.has(skill.skillId);
                  const visibleCoins = (skill.coins || []).filter(
                    (coin) => coin.description && coin.description.trim() !== ""
                  );
                  const hasDetail = skill.description || visibleCoins.length > 0;
                  return (
                  <div key={skill.skillId} className="border border-[#b8860b]/40 rounded p-4 bg-[#1a1a1f] hover:bg-[#1b1b1f] transition-colors">
                    <div className="flex gap-4 items-start mb-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        {(() => {
                          const n = parseInt(skill.coinPower ?? "", 10);
                          const coinStr = !isNaN(n) ? (n > 0 ? `+${n}` : `${n}`) : (skill.coinPower || "-");
                          return (
                            <div className="-mb-[2px] text-[16px] text-[#ededed] font-medium leading-none">
                              {coinStr}
                            </div>
                          );
                        })()}
                        <div className="mt-0.5">
                          <SkillIconWithFrame skill={skill} baseUrl={baseUrl} size="md" />
                        </div>
                        <div className="mt-[0.125rem] flex items-center justify-center gap-1.5">
                          <span className="text-[16px] text-[#ededed]">{skill.skillPower || "-"}</span>
                          {attackTypeIcons[(skill.attackType || "").toLowerCase()] && (
                            <img
                              src={attackTypeIcons[(skill.attackType || "").toLowerCase()]}
                              alt=""
                              className="w-5 h-5 object-contain"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0">
                            <h4 
                              className="font-semibold"
                              style={{ color: getSinAttributeColor(skill.sinAttribute) }}
                            >
                              {skill.name || "이름 없음"}
                            </h4>
                            {skill.coins && skill.coins.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {skill.coins.map((coin, i) => (
                                  <img
                                    key={i}
                                    src={coin.indestructible === "Y" ? "/images/enemy/E_COIN_UNBREAKABLE.webp" : "/images/enemy/E_COIN.webp"}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          {skill.attackWeight && !isNaN(parseInt(skill.attackWeight)) && (
                            <div className="-mt-0.5 mb-1.5">
                              <span className="text-[#ffcc33] text-base leading-none">
                                {Array(parseInt(skill.attackWeight)).fill("■").join("")}
                              </span>
                            </div>
                          )}
                          <div className="text-sm">
                            <div>
                              <span className="text-[#8a8580]">공격레벨: </span>
                              <span className="text-[#ededed]">
                                {skill.attackLevel || "-"}
                                {(() => {
                                  const growth = parseFloat(skill.growthCoefficient ?? "");
                                  if (!isNaN(growth) && growth !== 0) {
                                    const sign = growth > 0 ? "+" : "";
                                    return ` ( 적 레벨 ${sign}${growth} )`;
                                  }
                                  return "";
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={() => toggleSkillCollapse(skill.skillId)}
                            className="text-gray-400 hover:text-[#ffcc33] text-sm flex-shrink-0"
                            aria-label={isExpanded ? "접기" : "펼치기"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        )}
                      </div>
                    </div>
                    {hasDetail && (
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          {skill.description && (
                            <div className="mb-3">
                              <div className="text-[#8a8580] text-sm mb-1">스킬 설명:</div>
                              <div className="text-[#ededed] text-sm whitespace-pre-line">
                                <KeywordHighlight text={skill.description} keywords={allKeywords} />
                              </div>
                            </div>
                          )}
                          {visibleCoins.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-[#8a8580] text-sm font-medium">코인별 효과</div>
                              {skill.coins!.map((coin, coinIndex) => {
                                if (!coin.description || !coin.description.trim()) return null;
                                return (
                                  <div key={coin.coinId} className="pl-4 border-l-2 border-[#b8860b]/40">
                                    <div className="flex items-start gap-2 mb-1">
                                      <img
                                        src={`/images/enemy/CoinEffect${coinIndex + 1}.webp`}
                                        alt={`코인 ${coinIndex + 1}`}
                                        className="w-7 h-7 object-contain flex-shrink-0"
                                      />
                                      <div className="text-[#ededed] text-sm whitespace-pre-line">
                                        <KeywordHighlight text={coin.description} keywords={allKeywords} />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 패시브 */}
          {enemyData.passives && enemyData.passives.length > 0 && (
            <div>
              <h3 className="text-[#34d399] text-lg font-semibold mb-3">패시브</h3>
              <div className="space-y-3">
                {enemyData.passives.map((passive) => (
                  <div key={passive.passiveId} className="border border-[#34d399]/40 rounded p-4 bg-[#1a1a1f] hover:bg-[#1b1b1f] transition-colors">
                    <h4 className="text-[#34d399] font-semibold mb-2">{passive.title}</h4>
                    <div className="text-[#ededed] text-sm whitespace-pre-line">
                      <KeywordHighlight text={passive.content} keywords={allKeywords} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 정신력 */}
          {enemyData.mentalPowers && enemyData.mentalPowers.length > 0 && (
            <div>
              <h3 className="text-[#60a5fa] text-lg font-semibold mb-3">정신력</h3>
              <div className="space-y-3">
                {enemyData.mentalPowers.map((mentalPower) => (
                  <div key={mentalPower.mentalPowerId} className="border border-[#60a5fa]/40 rounded p-4 bg-[#1a1a1f] hover:bg-[#1b1b1f] transition-colors">
                    <h4 className="text-[#60a5fa] font-semibold mb-2">{mentalPower.title}</h4>
                    <div className="text-[#ededed] text-sm whitespace-pre-line">
                      <KeywordHighlight text={mentalPower.content} keywords={allKeywords} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

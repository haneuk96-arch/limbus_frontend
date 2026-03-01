"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

export default function EnemyCreatePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [totalHealth, setTotalHealth] = useState("");
  const [traitKeywords, setTraitKeywords] = useState<Array<{ id: number; value: string }>>([]);
  const [bodyParts, setBodyParts] = useState<Array<{
    id: number;
    name: string;
    attribute: string;
    destructible: string;
    destructionEffect: string;
    specialNote: string;
    health: string;
    speed: string;
    defense: string;
    slashResistance: string;
    pierceResistance: string;
    bluntResistance: string;
    wrathResistance: string;
    lustResistance: string;
    slothResistance: string;
    gluttonyResistance: string;
    gloomResistance: string;
    prideResistance: string;
    envyResistance: string;
    staggerRanges: Array<{ id: number; value: string }>;
    isExpanded: boolean;
    skills: Array<{
      id: number;
      name: string;
      icon: File | null;
      iconPreview: string | null;
      attackType: string;
      sinAttribute: string;
      skillLevel: string;
      skillPower: string;
      coinPower: string;
      attackWeight: string;
      attackLevel: string;
      growthCoefficient: string;
      description: string;
      isExpanded: boolean;
      coins: Array<{
        id: number;
        description: string;
        isExpanded: boolean;
        indestructible: string;
      }>;
    }>;
    passives: Array<{
      id: number;
      title: string;
      content: string;
      isExpanded: boolean;
    }>;
  }>>([]);
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]);
  const [passives, setPassives] = useState<Array<{
    id: number;
    title: string;
    content: string;
    isExpanded: boolean;
  }>>([]);
  const [mentalPowers, setMentalPowers] = useState<Array<{
    id: number;
    title: string;
    content: string;
    isExpanded: boolean;
  }>>([]);

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
    { value: "dodge", label: "회피" },
    { value: "counter", label: "반격" },
    { value: "enhanced_defense", label: "강화방어" },
    { value: "enhanced_counter", label: "강화반격" },
  ];

  const bodyPartAttributes = [
    { value: "", label: "없음" },
    { value: "head", label: "머리" },
    { value: "torso", label: "몸통" },
    { value: "left_arm", label: "왼팔" },
    { value: "right_arm", label: "오른팔" },
    { value: "waist", label: "허리" },
    { value: "legs", label: "다리" },
  ];

  const destructibleOptions = [
    { value: "", label: "선택하세요" },
    { value: "impossible", label: "파괴 및 적출 불가" },
    { value: "destructible", label: "파괴 가능" },
    { value: "destructible_and_extractable", label: "파괴 및 적출 가능" },
  ];

  const sinAttributes = [
    { value: "", label: "없음" },
    { value: "wrath", label: "분노" },
    { value: "lust", label: "색욕" },
    { value: "sloth", label: "나태" },
    { value: "gluttony", label: "탐식" },
    { value: "gloom", label: "우울" },
    { value: "pride", label: "오만" },
    { value: "envy", label: "질투" },
  ];

  useEffect(() => {
    fetchAllKeywords();
  }, []);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null);
      setPreview(null);
    }
  };

  const addTraitKeyword = () => {
    const newId = traitKeywords.length > 0 ? Math.max(...traitKeywords.map(k => k.id)) + 1 : 1;
    setTraitKeywords([...traitKeywords, { id: newId, value: "" }]);
  };

  const removeTraitKeyword = (id: number) => {
    setTraitKeywords(traitKeywords.filter(k => k.id !== id));
  };

  const updateTraitKeyword = (id: number, value: string) => {
    setTraitKeywords(traitKeywords.map(k => k.id === id ? { ...k, value } : k));
  };

  const addBodyPart = () => {
    const newId = bodyParts.length > 0 ? Math.max(...bodyParts.map(b => b.id)) + 1 : 1;
    setBodyParts([...bodyParts, {
      id: newId,
      name: "",
      attribute: "",
      destructible: "",
      destructionEffect: "",
      specialNote: "",
      health: "",
      speed: "",
      defense: "",
      slashResistance: "",
      pierceResistance: "",
      bluntResistance: "",
      wrathResistance: "",
      lustResistance: "",
      slothResistance: "",
      gluttonyResistance: "",
      gloomResistance: "",
      prideResistance: "",
      envyResistance: "",
      staggerRanges: [],
      isExpanded: true,
      skills: [],
      passives: [],
    }]);
  };

  const removeBodyPart = (id: number) => {
    setBodyParts(bodyParts.filter(b => b.id !== id));
  };

  const toggleBodyPartExpanded = (id: number) => {
    setBodyParts(bodyParts.map(b => b.id === id ? { ...b, isExpanded: !b.isExpanded } : b));
  };

  const updateBodyPartField = (id: number, field: string, value: string) => {
    setBodyParts(bodyParts.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const addBodyPartStaggerRange = (bodyPartId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id === bodyPartId) {
        const newId = b.staggerRanges.length > 0 ? Math.max(...b.staggerRanges.map(r => r.id)) + 1 : 1;
        return { ...b, staggerRanges: [...b.staggerRanges, { id: newId, value: "" }] };
      }
      return b;
    }));
  };

  const removeBodyPartStaggerRange = (bodyPartId: number, rangeId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id === bodyPartId) {
        return { ...b, staggerRanges: b.staggerRanges.filter(r => r.id !== rangeId) };
      }
      return b;
    }));
  };

  const updateBodyPartStaggerRange = (bodyPartId: number, rangeId: number, value: string) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id === bodyPartId) {
        return { ...b, staggerRanges: b.staggerRanges.map(r => r.id === rangeId ? { ...r, value } : r) };
      }
      return b;
    }));
  };

  const addBodyPartSkill = (bodyPartId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      const skills = b.skills;
      const newId = skills.length > 0 ? Math.max(...skills.map(s => s.id)) + 1 : 1;
      return {
        ...b,
        skills: [...skills, {
          id: newId,
          name: "",
          icon: null,
          iconPreview: null,
          attackType: "",
          sinAttribute: "",
          skillLevel: "",
          skillPower: "",
          coinPower: "",
          attackWeight: "",
          attackLevel: "",
          growthCoefficient: "",
          description: "",
          isExpanded: true,
          coins: [],
        }],
      };
    }));
  };

  const toggleBodyPartSkillExpanded = (bodyPartId: number, skillId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => s.id === skillId ? { ...s, isExpanded: !s.isExpanded } : s),
      };
    }));
  };

  const removeBodyPartSkill = (bodyPartId: number, skillId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return { ...b, skills: b.skills.filter(s => s.id !== skillId) };
    }));
  };

  const updateBodyPartSkillField = (bodyPartId: number, skillId: number, field: string, value: string) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => s.id === skillId ? { ...s, [field]: value } : s),
      };
    }));
  };

  const handleBodyPartSkillIconChange = (bodyPartId: number, skillId: number, f: File | null) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => {
          if (s.id !== skillId) return s;
          if (f) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setBodyParts(prev => prev.map(pb => {
                if (pb.id !== bodyPartId) return pb;
                return {
                  ...pb,
                  skills: pb.skills.map(ps =>
                    ps.id === skillId ? { ...ps, icon: f, iconPreview: reader.result as string } : ps
                  ),
                };
              }));
            };
            reader.readAsDataURL(f);
            return { ...s, icon: f };
          }
          return { ...s, icon: null, iconPreview: null };
        }),
      };
    }));
  };

  const addBodyPartSkillCoin = (bodyPartId: number, skillId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => {
          if (s.id !== skillId) return s;
          const newCoinId = s.coins.length > 0 ? Math.max(...s.coins.map(c => c.id)) + 1 : 1;
          return {
            ...s,
            coins: [...s.coins, { id: newCoinId, description: "", isExpanded: true, indestructible: "N" }],
          };
        }),
      };
    }));
  };

  const toggleBodyPartCoinExpanded = (bodyPartId: number, skillId: number, coinId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => {
          if (s.id !== skillId) return s;
          return {
            ...s,
            coins: s.coins.map(c => c.id === coinId ? { ...c, isExpanded: !c.isExpanded } : c),
          };
        }),
      };
    }));
  };

  const removeBodyPartSkillCoin = (bodyPartId: number, skillId: number, coinId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s =>
          s.id === skillId ? { ...s, coins: s.coins.filter(c => c.id !== coinId) } : s
        ),
      };
    }));
  };

  const updateBodyPartCoinDescription = (bodyPartId: number, skillId: number, coinId: number, description: string) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => {
          if (s.id !== skillId) return s;
          return {
            ...s,
            coins: s.coins.map(c => c.id === coinId ? { ...c, description } : c),
          };
        }),
      };
    }));
  };

  const updateBodyPartCoinIndestructible = (bodyPartId: number, skillId: number, coinId: number, indestructible: string) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s => {
          if (s.id !== skillId) return s;
          return {
            ...s,
            coins: s.coins.map(c => c.id === coinId ? { ...c, indestructible } : c),
          };
        }),
      };
    }));
  };

  const addBodyPartPassive = (bodyPartId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      const newId = b.passives.length > 0 ? Math.max(...b.passives.map(p => p.id)) + 1 : 1;
      return {
        ...b,
        passives: [...b.passives, { id: newId, title: "", content: "", isExpanded: true }],
      };
    }));
  };

  const toggleBodyPartPassiveExpanded = (bodyPartId: number, passiveId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        passives: b.passives.map(p => p.id === passiveId ? { ...p, isExpanded: !p.isExpanded } : p),
      };
    }));
  };

  const removeBodyPartPassive = (bodyPartId: number, passiveId: number) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        passives: b.passives.filter(p => p.id !== passiveId),
      };
    }));
  };

  const updateBodyPartPassiveField = (bodyPartId: number, passiveId: number, field: "title" | "content", value: string) => {
    setBodyParts(bodyParts.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        passives: b.passives.map(p => p.id === passiveId ? { ...p, [field]: value } : p),
      };
    }));
  };

  const addPassive = () => {
    const newId = passives.length > 0 ? Math.max(...passives.map(p => p.id)) + 1 : 1;
    setPassives([...passives, { id: newId, title: "", content: "", isExpanded: true }]);
  };

  const togglePassiveExpanded = (id: number) => {
    setPassives(passives.map(p => p.id === id ? { ...p, isExpanded: !p.isExpanded } : p));
  };

  const removePassive = (id: number) => {
    setPassives(passives.filter(p => p.id !== id));
  };

  const updatePassiveField = (id: number, field: string, value: string) => {
    setPassives(passives.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addMentalPower = () => {
    const newId = mentalPowers.length > 0 ? Math.max(...mentalPowers.map(m => m.id)) + 1 : 1;
    setMentalPowers([...mentalPowers, { id: newId, title: "", content: "", isExpanded: true }]);
  };

  const removeMentalPower = (id: number) => {
    setMentalPowers(mentalPowers.filter(m => m.id !== id));
  };

  const updateMentalPowerField = (id: number, field: string, value: string) => {
    setMentalPowers(mentalPowers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const toggleMentalPowerExpanded = (id: number) => {
    setMentalPowers(mentalPowers.map(m => m.id === id ? { ...m, isExpanded: !m.isExpanded } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();

      // 요청 데이터 구조 정리
      const data = {
        // 기본 정보
        name,
        totalHealth, // 전체 체력 (부위별 체력과 별도)
        traitKeywords: traitKeywords.map(k => k.value), // 특성 키워드 (최상위)

        // 부위 정보 (각 부위별로 체력, 속도, 방어, 내성, 흐트러짐 구간, 스킬 포함)
        bodyParts: bodyParts.map(part => ({
          // 부위 기본 정보
          name: part.name, // 부위 이름
          attribute: part.attribute, // 부위 속성 (없음, 머리, 몸통, 왼팔, 오른팔, 허리, 다리)
          destructible: part.destructible, // 파괴가능여부 (파괴 및 적출 불가, 파괴 가능, 파괴 및 적출 가능)
          destructionEffect: part.destructionEffect, // 파괴효과
          specialNote: part.specialNote, // 특이사항

          // 부위별 스탯
          health: part.health, // 부위별 체력
          speed: part.speed, // 부위별 속도
          defense: part.defense, // 부위별 방어

          // 부위별 내성
          resistances: {
            slash: part.slashResistance, // 참격 내성
            pierce: part.pierceResistance, // 관통 내성
            blunt: part.bluntResistance, // 타격 내성
            wrath: part.wrathResistance, // 분노 내성
            lust: part.lustResistance, // 색욕 내성
            sloth: part.slothResistance, // 나태 내성
            gluttony: part.gluttonyResistance, // 탐식 내성
            gloom: part.gloomResistance, // 우울 내성
            pride: part.prideResistance, // 오만 내성
            envy: part.envyResistance, // 질투 내성
          },

          // 부위별 흐트러짐 구간
          staggerRanges: part.staggerRanges.map(r => r.value),

          // 부위별 스킬 (스킬은 부위 안에 포함)
          skills: part.skills.map(skill => ({
            name: skill.name,
            attackType: skill.attackType,
            sinAttribute: skill.sinAttribute,
            skillLevel: skill.skillLevel,
            skillPower: skill.skillPower,
            coinPower: skill.coinPower,
            attackWeight: skill.attackWeight,
            attackLevel: skill.attackLevel,
            growthCoefficient: skill.growthCoefficient,
            description: skill.description,
            coins: skill.coins.map(coin => ({
              description: coin.description,
              indestructible: coin.indestructible,
            })),
          })),

          // 부위별 패시브
          passives: part.passives.map(p => ({
            title: p.title,
            content: p.content,
          })),
        })),

        // 패시브 (최상위)
        passives: passives.map(p => ({ 
          title: p.title, 
          content: p.content 
        })),

        // 정신력 (최상위)
        mentalPowers: mentalPowers.map(m => ({ 
          title: m.title, 
          content: m.content 
        })),
      };

      // JSON 데이터를 FormData에 추가
      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));

      // 메인 이미지 파일 추가
      if (file) {
        formData.append("file", file);
      }

      // 스킬 아이콘 파일 추가 (부위 순서대로, 각 부위의 스킬 순서대로)
      let skillIconIndex = 0;
      bodyParts.forEach((part) => {
        part.skills.forEach((skill) => {
          if (skill.icon) {
            formData.append(`skillIcon_${skillIconIndex}`, skill.icon);
            skillIconIndex++;
          }
        });
      });

      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/dungeon/enemy");
      } else {
        try {
          const errorData = await res.json();
          setError(errorData.message || `등록에 실패했습니다. (상태 코드: ${res.status})`);
        } catch {
          setError(`등록에 실패했습니다. (상태 코드: ${res.status})`);
        }
      }
    } catch (err: any) {
      console.error("등록 중 오류 발생:", err);
      if (err.message?.includes("Failed to fetch") || err.message?.includes("ERR_")) {
        setError("서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.");
      } else {
        setError(`등록에 실패했습니다: ${err.message || "알 수 없는 오류"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">등장 적 등록</h1>
        <Link
          href="/dante/dungeon/enemy"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          목록
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-5xl mx-auto">
        {/* 이미지 입력 섹션 */}
        <div className="mb-6">
          <label className="block text-yellow-300 text-sm font-medium mb-2">이미지</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              />
            </div>
            {preview && (
              <div className="flex-shrink-0">
                <img
                  src={preview}
                  alt="미리보기"
                  className="h-[200px] w-auto object-contain border border-red-700/50 rounded"
                />
              </div>
            )}
          </div>
        </div>

        {/* 이름 입력 섹션 */}
        <div className="mb-6">
          <label className="block text-yellow-300 text-sm font-medium mb-2">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            placeholder="이름을 입력하세요"
          />
        </div>

        {/* 전체 체력 입력 섹션 */}
        <div className="mb-6">
          <label className="block text-yellow-300 text-sm font-medium mb-2">전체 체력</label>
          <input
            type="text"
            value={totalHealth}
            onChange={(e) => setTotalHealth(e.target.value)}
            className="w-full max-w-xs px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            placeholder="전체 체력을 입력하세요"
          />
        </div>

        {/* 부위 입력 섹션 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-yellow-300 text-sm font-medium">부위</label>
            <button type="button" onClick={addBodyPart} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
              추가
            </button>
          </div>
          {bodyParts.length > 0 && (
            <div className="space-y-6">
              {bodyParts.map((part) => (
                <div key={part.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors"
                    onClick={() => toggleBodyPartExpanded(part.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-300 text-sm">{part.isExpanded ? "▼" : "▶"}</span>
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updateBodyPartField(part.id, "name", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                        placeholder="부위 이름을 입력하세요"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBodyPart(part.id);
                      }}
                      className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                    >
                      삭제
                    </button>
                  </div>
                  {part.isExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      {/* 부위 속성 및 파괴가능여부 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">부위 속성</label>
                          <select
                            value={part.attribute}
                            onChange={(e) => updateBodyPartField(part.id, "attribute", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            {bodyPartAttributes.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">파괴가능여부</label>
                          <select
                            value={part.destructible}
                            onChange={(e) => updateBodyPartField(part.id, "destructible", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            {destructibleOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 파괴효과, 특이사항 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">파괴효과</label>
                          <input
                            type="text"
                            value={part.destructionEffect}
                            onChange={(e) => updateBodyPartField(part.id, "destructionEffect", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="파괴효과를 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">특이사항</label>
                          <input
                            type="text"
                            value={part.specialNote}
                            onChange={(e) => updateBodyPartField(part.id, "specialNote", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="특이사항을 입력하세요"
                          />
                        </div>
                      </div>

                      {/* 체력, 속도, 방어 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">체력</label>
                          <input
                            type="text"
                            value={part.health}
                            onChange={(e) => updateBodyPartField(part.id, "health", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="체력을 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">속도</label>
                          <input
                            type="text"
                            value={part.speed}
                            onChange={(e) => updateBodyPartField(part.id, "speed", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="속도를 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">방어</label>
                          <input
                            type="text"
                            value={part.defense}
                            onChange={(e) => updateBodyPartField(part.id, "defense", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                            placeholder="방어를 입력하세요"
                          />
                        </div>
                      </div>

                      {/* 참격 내성, 관통 내성, 타격 내성 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">참격 내성</label>
                          <select
                            value={part.slashResistance}
                            onChange={(e) => updateBodyPartField(part.id, "slashResistance", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="">선택하세요</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">관통 내성</label>
                          <select
                            value={part.pierceResistance}
                            onChange={(e) => updateBodyPartField(part.id, "pierceResistance", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="">선택하세요</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">타격 내성</label>
                          <select
                            value={part.bluntResistance}
                            onChange={(e) => updateBodyPartField(part.id, "bluntResistance", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="">선택하세요</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 속성별 내성 */}
                      <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">분노 내성</label>
                          <select
                            value={part.wrathResistance}
                            onChange={(e) => updateBodyPartField(part.id, "wrathResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">색욕 내성</label>
                          <select
                            value={part.lustResistance}
                            onChange={(e) => updateBodyPartField(part.id, "lustResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">나태 내성</label>
                          <select
                            value={part.slothResistance}
                            onChange={(e) => updateBodyPartField(part.id, "slothResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">탐식 내성</label>
                          <select
                            value={part.gluttonyResistance}
                            onChange={(e) => updateBodyPartField(part.id, "gluttonyResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">우울 내성</label>
                          <select
                            value={part.gloomResistance}
                            onChange={(e) => updateBodyPartField(part.id, "gloomResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">오만 내성</label>
                          <select
                            value={part.prideResistance}
                            onChange={(e) => updateBodyPartField(part.id, "prideResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">질투 내성</label>
                          <select
                            value={part.envyResistance}
                            onChange={(e) => updateBodyPartField(part.id, "envyResistance", e.target.value)}
                            className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                          >
                            <option value="">선택</option>
                            {resistanceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 흐트러짐 구간 */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-yellow-300 text-sm font-medium">흐트러짐 구간 (%)</label>
                          <button
                            type="button"
                            onClick={() => addBodyPartStaggerRange(part.id)}
                            className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded"
                          >
                            추가
                          </button>
                        </div>
                        {part.staggerRanges.length > 0 && (
                          <div className="space-y-2">
                            {part.staggerRanges.map((range) => (
                              <div key={range.id} className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={range.value}
                                  onChange={(e) => updateBodyPartStaggerRange(part.id, range.id, e.target.value)}
                                  className="flex-1 px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                  placeholder="% 값을 입력하세요"
                                  step="0.1"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeBodyPartStaggerRange(part.id, range.id)}
                                  className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                                >
                                  삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 스킬 */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-yellow-300 text-sm font-medium">스킬</label>
                          <button type="button" onClick={() => addBodyPartSkill(part.id)} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
                            추가
                          </button>
                        </div>
                        {part.skills.length > 0 && (
                          <div className="space-y-6">
                            {part.skills.map((skill) => (
                              <div key={`${part.id}-${skill.id}`} className="border border-red-700 rounded bg-[#1a1a1d]">
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors" onClick={() => toggleBodyPartSkillExpanded(part.id, skill.id)}>
                                  <h3 className="text-yellow-300 text-sm font-medium">{skill.name || `스킬 ${skill.id}`}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs">{skill.isExpanded ? "▼" : "▶"}</span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeBodyPartSkill(part.id, skill.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                                      삭제
                                    </button>
                                  </div>
                                </div>
                                {skill.isExpanded && (
                                  <div className="p-4 pt-0 space-y-4">
                                    <div className="flex gap-4 items-start">
                                      <div className="flex-shrink-0">
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 아이콘</label>
                                        {skill.iconPreview ? (
                                          <div className="flex flex-col gap-2">
                                            <img src={skill.iconPreview} alt="스킬 아이콘 미리보기" className="h-16 w-16 object-contain border border-red-700/50 rounded" />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => handleBodyPartSkillIconChange(part.id, skill.id, e.target.files?.[0] || null)}
                                              className="w-full px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-xs"
                                            />
                                          </div>
                                        ) : (
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleBodyPartSkillIconChange(part.id, skill.id, e.target.files?.[0] || null)}
                                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                          />
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 이름</label>
                                        <input
                                          type="text"
                                          value={skill.name}
                                          onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "name", e.target.value)}
                                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                          placeholder="스킬 이름을 입력하세요"
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬유형</label>
                                        <select
                                          value={skill.attackType}
                                          onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "attackType", e.target.value)}
                                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        >
                                          <option value="">선택하세요</option>
                                          {skillTypes.map((type) => {
                                            const isAttack = ["slash", "pierce", "blunt"].includes(type.value);
                                            return (
                                              <option key={type.value} value={type.value} style={{ color: isAttack ? "#ffb3ba" : "#baffc9", backgroundColor: "#1c1c1f" }}>
                                                {type.label}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">죄악속성</label>
                                        <select
                                          value={skill.sinAttribute}
                                          onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "sinAttribute", e.target.value)}
                                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        >
                                          {sinAttributes.map((attr) => {
                                            const colors: Record<string, string> = { wrath: "#ffb3ba", lust: "#ffd3a5", sloth: "#ffefba", gluttony: "#baffc9", gloom: "#bae1ff", pride: "#c4c4ff", envy: "#e0baff" };
                                            return (
                                              <option key={attr.value} value={attr.value} style={{ color: attr.value ? (colors[attr.value] || "#fff") : "#fff", backgroundColor: "#1c1c1f" }}>
                                                {attr.label}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 레벨</label>
                                        <select
                                          value={skill.skillLevel}
                                          onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "skillLevel", e.target.value)}
                                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        >
                                          <option value="">선택하세요</option>
                                          <option value="1">1</option>
                                          <option value="2">2</option>
                                          <option value="3">3</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                      {[
                                        { key: "skillPower", label: "스킬위력", placeholder: "스킬위력을 입력하세요" },
                                        { key: "coinPower", label: "코인위력", placeholder: "코인위력을 입력하세요" },
                                        { key: "attackWeight", label: "공격 가중치", placeholder: "공격 가중치를 입력하세요" },
                                        { key: "attackLevel", label: "공격레벨", placeholder: "공격레벨을 입력하세요" },
                                        { key: "growthCoefficient", label: "성장계수", placeholder: "성장계수를 입력하세요" },
                                      ].map(({ key, label, placeholder }) => (
                                        <div key={key}>
                                          <label className="block text-yellow-300 text-sm font-medium mb-2">{label}</label>
                                          <input
                                            type="number"
                                            value={(skill as any)[key]}
                                            onChange={(e) => updateBodyPartSkillField(part.id, skill.id, key, e.target.value)}
                                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                            placeholder={placeholder}
                                          />
                                        </div>
                                      ))}
                                    </div>

                                    <div>
                                      <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 설명</label>
                                      <textarea
                                        value={skill.description}
                                        onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "description", e.target.value)}
                                        className="w-full min-h-[120px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        placeholder="스킬 설명을 입력하세요. [[키워드명]] 형식으로 키워드를 사용할 수 있습니다."
                                      />
                                      {skill.description && (
                                        <div className="mt-3 p-4 bg-[#0b0b0c] border border-red-700/50 rounded">
                                          <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                                          <div className="text-white text-sm whitespace-pre-line">
                                            <KeywordHighlight text={skill.description} keywords={allKeywords} />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-4">
                                        <label className="block text-yellow-300 text-sm font-medium">코인</label>
                                        <button type="button" onClick={() => addBodyPartSkillCoin(part.id, skill.id)} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
                                          추가
                                        </button>
                                      </div>
                                      {skill.coins.length > 0 && (
                                        <div className="space-y-4">
                                          {skill.coins.map((coin) => (
                                            <div key={coin.id} className="border border-red-700/50 rounded bg-[#0b0b0c]">
                                              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#131316] transition-colors" onClick={() => toggleBodyPartCoinExpanded(part.id, skill.id, coin.id)}>
                                                <label className="text-yellow-300 text-sm font-medium">코인 {coin.id}</label>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-gray-400 text-xs">{coin.isExpanded ? "▼" : "▶"}</span>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); removeBodyPartSkillCoin(part.id, skill.id, coin.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                                                    삭제
                                                  </button>
                                                </div>
                                              </div>
                                              {coin.isExpanded && (
                                                <div className="p-4 pt-0">
                                                  <textarea
                                                    value={coin.description}
                                                    onChange={(e) => updateBodyPartCoinDescription(part.id, skill.id, coin.id, e.target.value)}
                                                    className="w-full min-h-[100px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                                    placeholder="코인 설명을 입력하세요. [[키워드명]] 형식으로 키워드를 사용할 수 있습니다."
                                                  />
                                                  <div className="mt-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        checked={coin.indestructible === "Y"}
                                                        onChange={(e) => updateBodyPartCoinIndestructible(part.id, skill.id, coin.id, e.target.checked ? "Y" : "N")}
                                                        className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400"
                                                      />
                                                      <span className="text-yellow-300 text-sm">파괴불가코인</span>
                                                    </label>
                                                  </div>
                                                  {coin.description && (
                                                    <div className="mt-3 p-4 bg-[#131316] border border-red-700/50 rounded">
                                                      <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                                                      <div className="text-white text-sm whitespace-pre-line">
                                                        <KeywordHighlight text={coin.description} keywords={allKeywords} />
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 부위별 패시브 */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-yellow-300 text-sm font-medium">패시브</label>
                          <button type="button" onClick={() => addBodyPartPassive(part.id)} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
                            추가
                          </button>
                        </div>
                        {part.passives.length > 0 && (
                          <div className="space-y-4">
                            {part.passives.map((passive) => (
                              <div key={passive.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors" onClick={() => toggleBodyPartPassiveExpanded(part.id, passive.id)}>
                                  <h3 className="text-yellow-300 text-sm font-medium">{passive.title || `패시브 ${passive.id}`}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs">{passive.isExpanded ? "▼" : "▶"}</span>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeBodyPartPassive(part.id, passive.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                                      삭제
                                    </button>
                                  </div>
                                </div>
                                {passive.isExpanded && (
                                  <div className="p-4 pt-0 space-y-4">
                                    <div>
                                      <label className="block text-yellow-300 text-sm font-medium mb-2">제목</label>
                                      <input
                                        type="text"
                                        value={passive.title}
                                        onChange={(e) => updateBodyPartPassiveField(part.id, passive.id, "title", e.target.value)}
                                        className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        placeholder="패시브 제목을 입력하세요"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-yellow-300 text-sm font-medium mb-2">내용</label>
                                      <textarea
                                        value={passive.content}
                                        onChange={(e) => updateBodyPartPassiveField(part.id, passive.id, "content", e.target.value)}
                                        className="w-full min-h-[100px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                                        placeholder="패시브 내용을 입력하세요. [[키워드명]] 형식으로 키워드를 사용할 수 있습니다."
                                      />
                                    </div>
                                    {passive.content && (
                                      <div className="p-4 bg-[#131316] border border-red-700/50 rounded">
                                        <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                                        <div className="text-white text-sm whitespace-pre-line">
                                          <KeywordHighlight text={passive.content} keywords={allKeywords} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 특성 키워드 입력 섹션 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-yellow-300 text-sm font-medium">특성 키워드</label>
            <button type="button" onClick={addTraitKeyword} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
              추가
            </button>
          </div>
          {traitKeywords.length > 0 && (
            <div className="space-y-2">
              {traitKeywords.map((keyword) => (
                <div key={keyword.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={keyword.value}
                    onChange={(e) => updateTraitKeyword(keyword.id, e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                    placeholder="특성 키워드를 입력하세요"
                  />
                  <button type="button" onClick={() => removeTraitKeyword(keyword.id)} className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 패시브 입력 섹션 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-yellow-300 text-sm font-medium">패시브</label>
            <button type="button" onClick={addPassive} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
              추가
            </button>
          </div>
          {passives.length > 0 && (
            <div className="space-y-4">
              {passives.map((passive) => (
                <div key={passive.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors" onClick={() => togglePassiveExpanded(passive.id)}>
                    <h3 className="text-yellow-300 text-sm font-medium">{passive.title || `패시브 ${passive.id}`}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{passive.isExpanded ? "▼" : "▶"}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removePassive(passive.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                        삭제
                      </button>
                    </div>
                  </div>
                  {passive.isExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      <div>
                        <label className="block text-yellow-300 text-sm font-medium mb-2">제목</label>
                        <input
                          type="text"
                          value={passive.title}
                          onChange={(e) => updatePassiveField(passive.id, "title", e.target.value)}
                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          placeholder="패시브 제목을 입력하세요"
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-300 text-sm font-medium mb-2">내용</label>
                        <textarea
                          value={passive.content}
                          onChange={(e) => updatePassiveField(passive.id, "content", e.target.value)}
                          className="w-full min-h-[120px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          placeholder="패시브 내용을 입력하세요. [[키워드명]] 형식으로 키워드를 사용할 수 있습니다."
                        />
                        {passive.content && (
                          <div className="mt-3 p-4 bg-[#131316] border border-red-700/50 rounded">
                            <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                            <div className="text-white text-sm whitespace-pre-line">
                              <KeywordHighlight text={passive.content} keywords={allKeywords} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 정신력 입력 섹션 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-yellow-300 text-sm font-medium">정신력</label>
            <button type="button" onClick={addMentalPower} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
              추가
            </button>
          </div>
          {mentalPowers.length > 0 && (
            <div className="space-y-4">
              {mentalPowers.map((mentalPower) => (
                <div key={mentalPower.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors" onClick={() => toggleMentalPowerExpanded(mentalPower.id)}>
                    <h3 className="text-yellow-300 text-sm font-medium">{mentalPower.title || `정신력 ${mentalPower.id}`}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{mentalPower.isExpanded ? "▼" : "▶"}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeMentalPower(mentalPower.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                        삭제
                      </button>
                    </div>
                  </div>
                  {mentalPower.isExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      <div>
                        <label className="block text-yellow-300 text-sm font-medium mb-2">제목</label>
                        <input
                          type="text"
                          value={mentalPower.title}
                          onChange={(e) => updateMentalPowerField(mentalPower.id, "title", e.target.value)}
                          className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          placeholder="정신력 제목을 입력하세요"
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-300 text-sm font-medium mb-2">내용</label>
                        <textarea
                          value={mentalPower.content}
                          onChange={(e) => updateMentalPowerField(mentalPower.id, "content", e.target.value)}
                          className="w-full min-h-[120px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          placeholder="정신력 내용을 입력하세요. [[키워드명]] 형식으로 키워드를 사용할 수 있습니다."
                        />
                        {mentalPower.content && (
                          <div className="mt-3 p-4 bg-[#131316] border border-red-700/50 rounded">
                            <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                            <div className="text-white text-sm whitespace-pre-line">
                              <KeywordHighlight text={mentalPower.content} keywords={allKeywords} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-4">
          <Link href="/dante/dungeon/enemy" className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded">
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}

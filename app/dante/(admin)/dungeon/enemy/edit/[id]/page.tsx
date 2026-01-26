"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import KeywordHighlight from "@/components/KeywordHighlight";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

export default function EnemyEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [existingFile, setExistingFile] = useState<{ fileId: number; path: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
      existingIcon?: { fileId: number; path: string };
      iconRemoved?: boolean; // 삭제 플래그
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
  }>>([]);
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]);
  const [passives, setPassives] = useState<Array<{
    id: number;
    passiveId?: number;
    title: string;
    content: string;
    isExpanded: boolean;
  }>>([]);
  const [mentalPowers, setMentalPowers] = useState<Array<{
    id: number;
    mentalPowerId?: number;
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
    if (id) {
      fetchEnemy();
    }
  }, [id]);

  const fetchEnemy = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name || "");
        setTotalHealth(data.totalHealth || "");

        if (data.traitKeywords && Array.isArray(data.traitKeywords)) {
          setTraitKeywords(data.traitKeywords.map((value: string, index: number) => ({
            id: index + 1,
            value: value || "",
          })));
        }

        const baseUrl = API_BASE_URL.replace("/api", "");

        if (data.bodyParts && Array.isArray(data.bodyParts) && data.bodyParts.length > 0) {
          const parts = data.bodyParts.map((bp: any, pi: number) => ({
            id: pi + 1,
            name: bp.name || "",
            attribute: bp.attribute || "",
            destructible: bp.destructible || "",
            destructionEffect: bp.destructionEffect || "",
            specialNote: bp.specialNote || "",
            health: bp.health || "",
            speed: bp.speed || "",
            defense: bp.defense || "",
            slashResistance: bp.resistances?.slash ?? "",
            pierceResistance: bp.resistances?.pierce ?? "",
            bluntResistance: bp.resistances?.blunt ?? "",
            wrathResistance: bp.resistances?.wrath ?? "",
            lustResistance: bp.resistances?.lust ?? "",
            slothResistance: bp.resistances?.sloth ?? "",
            gluttonyResistance: bp.resistances?.gluttony ?? "",
            gloomResistance: bp.resistances?.gloom ?? "",
            prideResistance: bp.resistances?.pride ?? "",
            envyResistance: bp.resistances?.envy ?? "",
            staggerRanges: (bp.staggerRanges || []).map((v: string, i: number) => ({ id: i + 1, value: v || "" })),
            isExpanded: true,
            skills: (bp.skills || []).map((skill: any, si: number) => ({
              id: si + 1,
              name: skill.name || "",
              icon: null,
              iconPreview: skill.icon ? `${baseUrl}${skill.icon.path}` : null,
              existingIcon: skill.icon,
              iconRemoved: false,
              attackType: skill.attackType || "",
              sinAttribute: skill.sinAttribute || "",
              skillLevel: skill.skillLevel || "",
              skillPower: skill.skillPower || "",
              coinPower: skill.coinPower || "",
              attackWeight: skill.attackWeight || "",
              attackLevel: skill.attackLevel || "",
              growthCoefficient: skill.growthCoefficient || "",
              description: skill.description || "",
              isExpanded: true,
              coins: (skill.coins || []).map((coin: any, ci: number) => ({
                id: ci + 1,
                description: coin.description || "",
                isExpanded: true,
                indestructible: coin.indestructible || "N",
              })),
            })),
          }));
          setBodyParts(parts);
        } else {
          setBodyParts([]);
        }

        if (data.passives && Array.isArray(data.passives)) {
          setPassives(data.passives.map((p: any, i: number) => ({
            id: i + 1,
            passiveId: p.passiveId,
            title: p.title || "",
            content: p.content || "",
            isExpanded: true,
          })));
        }

        if (data.mentalPowers && Array.isArray(data.mentalPowers)) {
          setMentalPowers(data.mentalPowers.map((m: any, i: number) => ({
            id: i + 1,
            mentalPowerId: m.mentalPowerId,
            title: m.title || "",
            content: m.content || "",
            isExpanded: true,
          })));
        }

        if (data.image) {
          setExistingFile({ fileId: data.image.fileId, path: data.image.path });
          setPreview(`${baseUrl}${data.image.path}`);
        }
      } else {
        setError("적 정보를 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("적 정보 조회 실패:", err);
      setError("적 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
    }
  };

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
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBodyParts(prev => prev.map(pb => {
          if (pb.id !== bodyPartId) return pb;
          return {
            ...pb,
            skills: pb.skills.map(ps =>
              ps.id === skillId ? { ...ps, icon: f, iconPreview: reader.result as string, existingIcon: undefined, iconRemoved: false } : ps
            ),
          };
        }));
      };
      reader.readAsDataURL(f);
      return;
    }
    // 이미지 삭제: 기존/미리보기 제거 → 파일 입력만 보이도록
    setBodyParts(prev => prev.map(b => {
      if (b.id !== bodyPartId) return b;
      return {
        ...b,
        skills: b.skills.map(s =>
          s.id === skillId ? { ...s, icon: null, iconPreview: null, existingIcon: undefined, iconRemoved: true } : s
        ),
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
        setPreview(null);
      } else {
        setError("파일 삭제에 실패했습니다.");
      }
    } catch (err) {
      setError("파일 삭제에 실패했습니다.");
      console.error(err);
    }
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

      const data = {
        name,
        totalHealth,
        traitKeywords: traitKeywords.map(k => k.value),
        bodyParts: bodyParts.map(part => ({
          name: part.name,
          attribute: part.attribute,
          destructible: part.destructible,
          destructionEffect: part.destructionEffect,
          specialNote: part.specialNote,
          health: part.health,
          speed: part.speed,
          defense: part.defense,
          resistances: {
            slash: part.slashResistance,
            pierce: part.pierceResistance,
            blunt: part.bluntResistance,
            wrath: part.wrathResistance,
            lust: part.lustResistance,
            sloth: part.slothResistance,
            gluttony: part.gluttonyResistance,
            gloom: part.gloomResistance,
            pride: part.prideResistance,
            envy: part.envyResistance,
          },
          staggerRanges: part.staggerRanges.map(r => r.value),
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
        })),
        passives: passives.map(p => ({ title: p.title, content: p.content })),
        mentalPowers: mentalPowers.map(m => ({ title: m.title, content: m.content })),
      };

      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));

      if (file) {
        formData.append("file", file);
      }

      const emptyFile = new File([], "empty");
      let skillIconIndex = 0;
      bodyParts.forEach((part) => {
        part.skills.forEach((skill) => {
          formData.append(`skillIcon_${skillIconIndex}`, skill.icon ?? emptyFile);
          // 삭제 플래그 전송 (iconRemoved가 true이고 icon이 null이면 삭제 의도)
          if (skill.iconRemoved && !skill.icon) {
            formData.append(`skillIconRemoved_${skillIconIndex}`, "true");
          }
          skillIconIndex++;
        });
      });

      const res = await fetch(`${API_BASE_URL}/admin/dungeon/enemy/${id}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/dungeon/enemy");
      } else {
        try {
          const errorData = await res.json();
          setError(errorData.message || `수정에 실패했습니다. (상태 코드: ${res.status})`);
        } catch {
          setError(`수정에 실패했습니다. (상태 코드: ${res.status})`);
        }
      }
    } catch (err: any) {
      console.error("수정 중 오류 발생:", err);
      if (err.message?.includes("Failed to fetch") || err.message?.includes("ERR_")) {
        setError("서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.");
      } else {
        setError(`수정에 실패했습니다: ${err.message || "알 수 없는 오류"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-[#131316] border border-red-700 rounded p-8 text-center text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">등장 적 수정</h1>
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
            {(preview || (existingFile && !file)) && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                <img
                  src={preview || (existingFile ? `${API_BASE_URL.replace("/api", "")}${existingFile.path}` : "")}
                  alt="미리보기"
                  className="h-[200px] w-auto object-contain border border-red-700/50 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {existingFile && !file && (
                  <button
                    type="button"
                    onClick={handleDeleteFile}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                  >
                    삭제
                  </button>
                )}
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-yellow-300 text-sm font-medium mb-2">참격 내성</label>
                          <select
                            value={part.slashResistance}
                            onChange={(e) => updateBodyPartField(part.id, "slashResistance", e.target.value)}
                            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                          >
                            <option value="">선택하세요</option>
                            {resistanceOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
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
                            {resistanceOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
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
                            {resistanceOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {[
                          { k: "wrathResistance", l: "분노" },
                          { k: "lustResistance", l: "색욕" },
                          { k: "slothResistance", l: "나태" },
                          { k: "gluttonyResistance", l: "탐식" },
                          { k: "gloomResistance", l: "우울" },
                          { k: "prideResistance", l: "오만" },
                          { k: "envyResistance", l: "질투" },
                        ].map(({ k, l }) => (
                          <div key={k} className="flex-1 min-w-0" style={{ maxWidth: "calc(14.28% - 0.75rem)" }}>
                            <label className="block text-yellow-300 text-sm font-medium mb-2">{l} 내성</label>
                            <select
                              value={(part as any)[k]}
                              onChange={(e) => updateBodyPartField(part.id, k, e.target.value)}
                              className="w-full px-2 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                            >
                              <option value="">선택</option>
                              {resistanceOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-yellow-300 text-sm font-medium">흐트러짐 구간 (%)</label>
                          <button type="button" onClick={() => addBodyPartStaggerRange(part.id)} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">
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
                                <button type="button" onClick={() => removeBodyPartStaggerRange(part.id, range.id)} className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded">
                                  삭제
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                                        {(skill.iconPreview || skill.existingIcon) ? (
                                          <div className="flex flex-col gap-2">
                                            <img src={skill.iconPreview || (skill.existingIcon ? `${API_BASE_URL.replace("/api", "")}${skill.existingIcon.path}` : "")} alt="스킬 아이콘 미리보기" className="h-16 w-16 object-contain border border-red-700/50 rounded" />
                                            <button type="button" onClick={() => handleBodyPartSkillIconChange(part.id, skill.id, null)} className="px-2 py-1 bg-red-700/80 hover:bg-red-700 text-white text-xs rounded">
                                              이미지 삭제
                                            </button>
                                            <p className="text-gray-400 text-xs">이미지 삭제 후 새 이미지 등록 가능</p>
                                          </div>
                                        ) : (
                                          <input type="file" accept="image/*" onChange={(e) => handleBodyPartSkillIconChange(part.id, skill.id, e.target.files?.[0] || null)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400" />
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 이름</label>
                                        <input type="text" value={skill.name} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "name", e.target.value)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400" placeholder="스킬 이름을 입력하세요" />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬유형</label>
                                        <select value={skill.attackType} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "attackType", e.target.value)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400">
                                          <option value="">선택하세요</option>
                                          {skillTypes.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">죄악속성</label>
                                        <select value={skill.sinAttribute} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "sinAttribute", e.target.value)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400">
                                          {sinAttributes.map((a) => (
                                            <option key={a.value} value={a.value}>{a.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 레벨</label>
                                        <select value={skill.skillLevel} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "skillLevel", e.target.value)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400">
                                          <option value="">선택하세요</option>
                                          <option value="1">1</option>
                                          <option value="2">2</option>
                                          <option value="3">3</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                      {[{ key: "skillPower", label: "스킬위력" }, { key: "coinPower", label: "코인위력" }, { key: "attackWeight", label: "공격 가중치" }, { key: "attackLevel", label: "공격레벨" }, { key: "growthCoefficient", label: "성장계수" }].map(({ key, label }) => (
                                        <div key={key}>
                                          <label className="block text-yellow-300 text-sm font-medium mb-2">{label}</label>
                                          <input type="number" value={(skill as any)[key]} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, key, e.target.value)} className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400" />
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <label className="block text-yellow-300 text-sm font-medium mb-2">스킬 설명</label>
                                      <textarea value={skill.description} onChange={(e) => updateBodyPartSkillField(part.id, skill.id, "description", e.target.value)} className="w-full min-h-[120px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400" placeholder="스킬 설명. [[키워드명]] 형식 사용 가능." />
                                      {skill.description && (
                                        <div className="mt-3 p-4 bg-[#0b0b0c] border border-red-700/50 rounded">
                                          <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                                          <div className="text-white text-sm whitespace-pre-line"><KeywordHighlight text={skill.description} keywords={allKeywords} /></div>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between mb-4">
                                        <label className="block text-yellow-300 text-sm font-medium">코인</label>
                                        <button type="button" onClick={() => addBodyPartSkillCoin(part.id, skill.id)} className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded">추가</button>
                                      </div>
                                      {skill.coins.length > 0 && (
                                        <div className="space-y-4">
                                          {skill.coins.map((coin) => (
                                            <div key={coin.id} className="border border-red-700/50 rounded bg-[#0b0b0c]">
                                              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#131316] transition-colors" onClick={() => toggleBodyPartCoinExpanded(part.id, skill.id, coin.id)}>
                                                <label className="text-yellow-300 text-sm font-medium">코인 {coin.id}</label>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-gray-400 text-xs">{coin.isExpanded ? "▼" : "▶"}</span>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); removeBodyPartSkillCoin(part.id, skill.id, coin.id); }} className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded">삭제</button>
                                                </div>
                                              </div>
                                              {coin.isExpanded && (
                                                <div className="p-4 pt-0">
                                                  <textarea value={coin.description} onChange={(e) => updateBodyPartCoinDescription(part.id, skill.id, coin.id, e.target.value)} className="w-full min-h-[100px] px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400" placeholder="코인 설명. [[키워드명]] 형식 사용 가능." />
                                                  <div className="mt-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                      <input type="checkbox" checked={coin.indestructible === "Y"} onChange={(e) => updateBodyPartCoinIndestructible(part.id, skill.id, coin.id, e.target.checked ? "Y" : "N")} className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400" />
                                                      <span className="text-yellow-300 text-sm">파괴불가코인</span>
                                                    </label>
                                                  </div>
                                                  {coin.description && (
                                                    <div className="mt-3 p-4 bg-[#131316] border border-red-700/50 rounded">
                                                      <div className="text-yellow-300 text-sm font-medium mb-2">미리보기:</div>
                                                      <div className="text-white text-sm whitespace-pre-line"><KeywordHighlight text={coin.description} keywords={allKeywords} /></div>
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
            <button
              type="button"
              onClick={addTraitKeyword}
              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded"
            >
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
                  <button
                    type="button"
                    onClick={() => removeTraitKeyword(keyword.id)}
                    className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                  >
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
            <button
              type="button"
              onClick={addPassive}
              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded"
            >
              추가
            </button>
          </div>
          {passives.length > 0 && (
            <div className="space-y-4">
              {passives.map((passive) => (
                <div key={passive.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors"
                       onClick={() => togglePassiveExpanded(passive.id)}>
                    <h3 className="text-yellow-300 text-sm font-medium">
                      {passive.title ? passive.title : `패시브 ${passive.id}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {passive.isExpanded ? "▼" : "▶"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePassive(passive.id);
                        }}
                        className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                      >
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
                          <div className="text-white text-sm">
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
            <button
              type="button"
              onClick={addMentalPower}
              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded"
            >
              추가
            </button>
          </div>
          {mentalPowers.length > 0 && (
            <div className="space-y-4">
              {mentalPowers.map((mentalPower) => (
                <div key={mentalPower.id} className="border border-red-700 rounded bg-[#1a1a1d]">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1f1f22] transition-colors"
                       onClick={() => toggleMentalPowerExpanded(mentalPower.id)}>
                    <h3 className="text-yellow-300 text-sm font-medium">
                      {mentalPower.title ? mentalPower.title : `정신력 ${mentalPower.id}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {mentalPower.isExpanded ? "▼" : "▶"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMentalPower(mentalPower.id);
                        }}
                        className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                      >
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

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-6 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}

        {/* 저장 버튼 */}
        <div className="mt-6 flex justify-end gap-4">
          <Link
            href="/dante/dungeon/enemy"
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { HASHTAG_CATEGORIES, getCategoryName } from "@/lib/hashtagCategories";
import EgoGiftPreview from "../components/EgoGiftPreview";
import KeywordHighlight from "@/components/KeywordHighlight";
import { enrichKeywordData, KeywordData } from "@/lib/keywordParser";

interface Keyword {
  keywordId: number;
  keywordName: string;
  categoryId?: number;
  categoryName?: string;
  keywordDesc?: string;
  files?: Array<{ path: string }>;
}

interface Hashtag {
  tagId: number;
  tagName: string;
  tagCategoryCd?: string;
}

interface Category {
  categoryId: number;
  categoryName: string;
}

export default function EgoGiftCreatePage() {
  const router = useRouter();
  const [keywordId, setKeywordId] = useState("");
  const [attrKeywordId, setAttrKeywordId] = useState("");
  const [giftName, setGiftName] = useState("");
  const [giftTier, setGiftTier] = useState("");
  const [cost, setCost] = useState("");
  const [enhanceYn, setEnhanceYn] = useState("Y");
  const [synthesisYn, setSynthesisYn] = useState("N");  // 합성전용 여부
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);  // 출현난이도: 'N', 'H', 'E'
  const [desc1, setDesc1] = useState("");
  const [desc2, setDesc2] = useState("");
  const [desc3, setDesc3] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [attrKeywords, setAttrKeywords] = useState<Keyword[]>([]);  // 속성 키워드 (category_id = 9)
  const [allKeywords, setAllKeywords] = useState<KeywordData[]>([]); // 전체 키워드 (하이라이팅용)
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [replaceText, setReplaceText] = useState("");
  const [replaceType, setReplaceType] = useState<"keyword" | "enhancement">("keyword");
  const [enhancementColor, setEnhancementColor] = useState<string>("yellow");
  const [replaceText2, setReplaceText2] = useState("");
  const [replaceType2, setReplaceType2] = useState<"keyword" | "enhancement">("keyword");
  const [enhancementColor2, setEnhancementColor2] = useState<string>("yellow");
  const [replaceText3, setReplaceText3] = useState("");
  const [replaceType3, setReplaceType3] = useState<"keyword" | "enhancement">("keyword");
  const [enhancementColor3, setEnhancementColor3] = useState<string>("yellow");

  useEffect(() => {
    fetchCategories();
    fetchHashtags();
    fetchAllKeywords(); // 전체 키워드 조회 (하이라이팅용)
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      fetchKeywords();
      fetchAttrKeywords();
    }
  }, [categories]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/category/list?page=1&size=100`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.items || []);
      }
    } catch (err) {
      console.error("카테고리 목록 조회 실패:", err);
    }
  };

  const fetchKeywords = async () => {
    try {
      // 대표, 공격유형 카테고리 찾기
      const targetCategoryNames = ["대표", "공격유형"];
      const targetCategories = categories.filter((cat) =>
        targetCategoryNames.includes(cat.categoryName)
      );
      const targetCategoryIds = targetCategories.map((cat) => cat.categoryId);

      if (targetCategoryIds.length === 0) {
        console.warn("대표, 공격유형 카테고리를 찾을 수 없습니다.");
        return;
      }

      // 각 카테고리별로 키워드 조회
      const allKeywords: Keyword[] = [];
      for (const categoryId of targetCategoryIds) {
        const res = await fetch(
          `${API_BASE_URL}/admin/keyword?page=0&size=1000&categoryId=${categoryId}`,
          {
            credentials: "include",
          }
        );
        if (res.ok) {
          const data = await res.json();
          allKeywords.push(...(data.content || []));
        }
      }
      setKeywords(allKeywords);
    } catch (err) {
      console.error("키워드 목록 조회 실패:", err);
    }
  };

  const fetchAttrKeywords = async () => {
    try {
      // category_id가 9인 카테고리 찾기
      const attrCategory = categories.find((cat) => cat.categoryId === 9);
      if (!attrCategory) {
        console.warn("속성 카테고리(category_id = 9)를 찾을 수 없습니다.");
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/admin/keyword?page=0&size=1000&categoryId=9`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAttrKeywords(data.content || []);
      }
    } catch (err) {
      console.error("속성 키워드 목록 조회 실패:", err);
    }
  };

  const fetchHashtags = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword/tag?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setHashtags(data.content || []);
      }
    } catch (err) {
      console.error("해시태그 목록 조회 실패:", err);
    }
  };

  // 전체 키워드 조회 (하이라이팅용 - desc, files 포함)
  const fetchAllKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/keyword?page=0&size=1000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const keywordsWithData: Keyword[] = data.content || [];
        // 키워드 데이터를 enrich하여 저장
        const enrichedKeywords = keywordsWithData.map((k) => enrichKeywordData(k));
        setAllKeywords(enrichedKeywords);
      }
    } catch (err) {
      console.error("전체 키워드 목록 조회 실패:", err);
    }
  };

  const handleTagToggle = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleCategory = (categoryCode: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryCode)) {
        newSet.delete(categoryCode);
      } else {
        newSet.add(categoryCode);
      }
      return newSet;
    });
  };

  // 해시태그를 카테고리별로 그룹화 및 정렬
  const groupedHashtags = hashtags.reduce((acc, tag) => {
    const categoryCode = tag.tagCategoryCd || "기타";
    if (!acc[categoryCode]) {
      acc[categoryCode] = [];
    }
    acc[categoryCode].push(tag);
    return acc;
  }, {} as Record<string, Hashtag[]>);

  // 각 카테고리 내 태그들을 이름순으로 정렬
  Object.keys(groupedHashtags).forEach((key) => {
    groupedHashtags[key].sort((a, b) => a.tagName.localeCompare(b.tagName, 'ko'));
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!giftName.trim()) {
      setError("에고기프트 이름을 입력해주세요.");
      return;
    }
    if (!keywordId) {
      setError("키워드를 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      // 범용은 keyword_id가 0번
      const finalKeywordId = Number(keywordId);
      const data = {
        keywordId: finalKeywordId,
        attrKeywordId: attrKeywordId ? Number(attrKeywordId) : null,
        giftName,
        giftTier: giftTier || "1",
        cost: cost ? Number(cost) : 0,
        enhanceYn,
        synthesisYn,
        grades: selectedGrades,
        desc1,
        desc2,
        desc3,
        tagIds: selectedTagIds,
      };
      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE_URL}/admin/egogift`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        router.push("/dante/egogift");
      } else {
        setError("등록에 실패했습니다.");
      }
    } catch (err) {
      setError("등록에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">에고기프트 등록</h1>
        <Link
          href="/dante/egogift"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          목록
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              에고기프트 이름 *
            </label>
            <input
              type="text"
              value={giftName}
              onChange={(e) => setGiftName(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="에고기프트 이름을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              이미지
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              accept="image/*"
            />
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              키워드 *
            </label>
            <div className="space-y-2">
              {/* 첫번째 줄: 대표 키워드들 */}
              <div className="flex flex-wrap gap-2">
                {keywords
                  .filter((k) => k.categoryName === "대표")
                  .map((keyword) => (
                    <label
                      key={keyword.keywordId}
                      className={`flex-1 min-w-[80px] px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                        keywordId === String(keyword.keywordId)
                          ? "bg-yellow-400 text-black border-yellow-400"
                          : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="keyword"
                        value={keyword.keywordId}
                        checked={keywordId === String(keyword.keywordId)}
                        onChange={(e) => setKeywordId(e.target.value)}
                        className="hidden"
                      />
                      {keyword.keywordName}
                    </label>
                  ))}
              </div>
              {/* 두번째 줄: 공격유형 키워드들 + 범용 */}
              <div className="flex flex-wrap gap-2">
                <label
                  className={`flex-1 min-w-[80px] px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                    keywordId === "0"
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                  }`}
                >
                  <input
                    type="radio"
                    name="keyword"
                    value="0"
                    checked={keywordId === "0"}
                    onChange={(e) => setKeywordId(e.target.value)}
                    className="hidden"
                  />
                  범용
                </label>
                {keywords
                  .filter((k) => k.categoryName === "공격유형")
                  .map((keyword) => (
                    <label
                      key={keyword.keywordId}
                      className={`flex-1 min-w-[80px] px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                        keywordId === String(keyword.keywordId)
                          ? "bg-yellow-400 text-black border-yellow-400"
                          : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="keyword"
                        value={keyword.keywordId}
                        checked={keywordId === String(keyword.keywordId)}
                        onChange={(e) => setKeywordId(e.target.value)}
                        className="hidden"
                      />
                      {keyword.keywordName}
                    </label>
                  ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              속성
            </label>
            <div className="flex flex-wrap gap-2">
              <label
                className={`px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                  attrKeywordId === ""
                    ? "bg-yellow-400 text-black border-yellow-400"
                    : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                }`}
              >
                <input
                  type="radio"
                  name="attrKeyword"
                  value=""
                  checked={attrKeywordId === ""}
                  onChange={(e) => setAttrKeywordId(e.target.value)}
                  className="hidden"
                />
                선택 안함
              </label>
              {attrKeywords.map((keyword) => (
                <label
                  key={keyword.keywordId}
                  className={`px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                    attrKeywordId === String(keyword.keywordId)
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                  }`}
                >
                  <input
                    type="radio"
                    name="attrKeyword"
                    value={keyword.keywordId}
                    checked={attrKeywordId === String(keyword.keywordId)}
                    onChange={(e) => setAttrKeywordId(e.target.value)}
                    className="hidden"
                  />
                  {keyword.keywordName}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-yellow-300 text-sm font-medium mb-2">
                  티어
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {["1", "2", "3", "4", "5", "EX"].map((tier) => (
                    <label
                      key={tier}
                      className={`px-4 py-2 rounded cursor-pointer border font-medium ${
                        giftTier === tier
                          ? "bg-yellow-400 text-black border-yellow-400"
                          : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="giftTier"
                        value={tier}
                        checked={giftTier === tier}
                        onChange={(e) => setGiftTier(e.target.value)}
                        className="hidden"
                      />
                      {tier}
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <label className="block text-yellow-300 text-sm font-medium mb-2">
                  출현난이도
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: "N", label: "일반" },
                    { value: "H", label: "하드" },
                    { value: "E", label: "익스트림" },
                  ].map((grade) => (
                    <button
                      key={grade.value}
                      type="button"
                      onClick={() => {
                        setSelectedGrades((prev) =>
                          prev.includes(grade.value)
                            ? prev.filter((g) => g !== grade.value)
                            : [...prev, grade.value]
                        );
                      }}
                      className={`px-4 py-2 rounded border font-medium transition-colors ${
                        selectedGrades.includes(grade.value)
                          ? "bg-yellow-400 text-black border-yellow-400"
                          : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                      }`}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-yellow-300 text-sm font-medium mb-2">
                비용
              </label>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                placeholder="비용을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-yellow-300 text-sm font-medium mb-2">
                강화 여부
              </label>
              <div className="flex gap-2">
                {["Y", "N"].map((value) => (
                  <label
                    key={value}
                    className={`flex-1 px-4 py-2 rounded cursor-pointer border font-medium text-center ${
                      enhanceYn === value
                        ? "bg-yellow-400 text-black border-yellow-400"
                        : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="enhanceYn"
                      value={value}
                      checked={enhanceYn === value}
                      onChange={(e) => setEnhanceYn(e.target.value)}
                      className="hidden"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-yellow-300 text-sm font-medium mb-2">
                합성전용
              </label>
              <div className="flex gap-4">
                {[
                  { value: "Y", label: "예" },
                  { value: "N", label: "아니오" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex-1 px-3 sm:px-4 py-2 rounded cursor-pointer border font-medium text-center text-sm sm:text-base ${
                      synthesisYn === option.value
                        ? "bg-yellow-400 text-black border-yellow-400"
                        : "bg-[#1c1c1f] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="synthesisYn"
                      value={option.value}
                      checked={synthesisYn === option.value}
                      onChange={(e) => setSynthesisYn(e.target.value)}
                      className="hidden"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-yellow-300 text-sm font-medium">
                기본 효과 설명
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="변환할 문구"
                  className="px-3 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400 w-32"
                />
                <select
                  value={replaceType}
                  onChange={(e) => setReplaceType(e.target.value as "keyword" | "enhancement")}
                  className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                >
                  <option value="keyword">[[키워드]]</option>
                  <option value="enhancement">{"{변경내용}"}</option>
                </select>
                {replaceType === "enhancement" && (
                  <select
                    value={enhancementColor}
                    onChange={(e) => setEnhancementColor(e.target.value)}
                    className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                  >
                    <option value="red">빨강</option>
                    <option value="orange">주황</option>
                    <option value="yellow">노랑</option>
                    <option value="green">초록</option>
                    <option value="blue">파랑</option>
                    <option value="indigo">남색</option>
                    <option value="purple">보라</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!replaceText || !desc1) return;
                    // 이미 감싸져 있는 부분을 제외하고 변환
                    const escapedText = replaceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // 매칭된 텍스트의 앞뒤를 확인하여 이미 감싸져 있는지 체크
                    const newDesc1 = desc1.replace(new RegExp(escapedText, 'g'), (match, offset, string) => {
                      // 매칭된 텍스트의 앞뒤를 확인
                      const before = string.substring(Math.max(0, offset - 2), offset);
                      const after = string.substring(offset + match.length, offset + match.length + 2);
                      
                      // 이미 [[...]], {...}, ((...))로 감싸져 있으면 변환하지 않음
                      if (
                        (before.endsWith('[[') && after.startsWith(']]')) ||
                        (before.endsWith('{') && after.startsWith('}')) ||
                        (before.endsWith('((') && after.startsWith('))'))
                      ) {
                        return match;
                      }
                      
                      // 감싸져 있지 않으면 변환
                      if (replaceType === "keyword") {
                        return `[[${match}]]`;
                      } else {
                        return `{${enhancementColor}:${match}}`;
                      }
                    });
                    
                    setDesc1(newDesc1);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  변환
                </button>
              </div>
            </div>
            <textarea
              value={desc1}
              onChange={(e) => setDesc1(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="기본 효과 설명을 입력하세요 (키워드는 [[키워드명]], 변경부분은 {변경내용} 형식으로 입력)"
              rows={3}
            />
            {desc1 && (
              <div className="mt-2 p-3 bg-[#1a1a1a] border border-red-700/50 rounded text-sm">
                <div className="text-gray-400 mb-1 text-xs">미리보기:</div>
                <div className="text-white whitespace-pre-wrap">
                  <KeywordHighlight text={desc1} keywords={allKeywords} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-yellow-300 text-sm font-medium">
                강화 +1 설명
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replaceText2}
                  onChange={(e) => setReplaceText2(e.target.value)}
                  placeholder="변환할 문구"
                  className="px-3 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400 w-32"
                />
                <select
                  value={replaceType2}
                  onChange={(e) => setReplaceType2(e.target.value as "keyword" | "enhancement")}
                  className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                >
                  <option value="keyword">[[키워드]]</option>
                  <option value="enhancement">{"{변경내용}"}</option>
                </select>
                {replaceType2 === "enhancement" && (
                  <select
                    value={enhancementColor2}
                    onChange={(e) => setEnhancementColor2(e.target.value)}
                    className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                  >
                    <option value="red">빨강</option>
                    <option value="orange">주황</option>
                    <option value="yellow">노랑</option>
                    <option value="green">초록</option>
                    <option value="blue">파랑</option>
                    <option value="indigo">남색</option>
                    <option value="purple">보라</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!replaceText2 || !desc2) return;
                    const escapedText = replaceText2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const newDesc2 = desc2.replace(new RegExp(escapedText, 'g'), (match, offset, string) => {
                      const before = string.substring(Math.max(0, offset - 2), offset);
                      const after = string.substring(offset + match.length, offset + match.length + 2);
                      if (
                        (before.endsWith('[[') && after.startsWith(']]')) ||
                        (before.endsWith('{') && after.startsWith('}'))
                      ) {
                        return match;
                      }
                      if (replaceType2 === "keyword") {
                        return `[[${match}]]`;
                      } else {
                        return `{${enhancementColor2}:${match}}`;
                      }
                    });
                    setDesc2(newDesc2);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  변환
                </button>
              </div>
            </div>
            <textarea
              value={desc2}
              onChange={(e) => setDesc2(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="강화 +1 설명을 입력하세요 (키워드는 [[키워드명]], 변경부분은 {변경내용} 형식으로 입력)"
              rows={3}
            />
            {desc2 && (
              <div className="mt-2 p-3 bg-[#1a1a1a] border border-red-700/50 rounded text-sm">
                <div className="text-gray-400 mb-1 text-xs">미리보기:</div>
                <div className="text-white whitespace-pre-wrap">
                  <KeywordHighlight text={desc2} keywords={allKeywords} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-yellow-300 text-sm font-medium">
                강화 +2 설명
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replaceText3}
                  onChange={(e) => setReplaceText3(e.target.value)}
                  placeholder="변환할 문구"
                  className="px-3 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400 w-32"
                />
                <select
                  value={replaceType3}
                  onChange={(e) => setReplaceType3(e.target.value as "keyword" | "enhancement")}
                  className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                >
                  <option value="keyword">[[키워드]]</option>
                  <option value="enhancement">{"{변경내용}"}</option>
                </select>
                {replaceType3 === "enhancement" && (
                  <select
                    value={enhancementColor3}
                    onChange={(e) => setEnhancementColor3(e.target.value)}
                    className="px-2 py-1 bg-[#1c1c1f] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                  >
                    <option value="red">빨강</option>
                    <option value="orange">주황</option>
                    <option value="yellow">노랑</option>
                    <option value="green">초록</option>
                    <option value="blue">파랑</option>
                    <option value="indigo">남색</option>
                    <option value="purple">보라</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!replaceText3 || !desc3) return;
                    const escapedText = replaceText3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const newDesc3 = desc3.replace(new RegExp(escapedText, 'g'), (match, offset, string) => {
                      const before = string.substring(Math.max(0, offset - 2), offset);
                      const after = string.substring(offset + match.length, offset + match.length + 2);
                      if (
                        (before.endsWith('[[') && after.startsWith(']]')) ||
                        (before.endsWith('{') && after.startsWith('}'))
                      ) {
                        return match;
                      }
                      if (replaceType3 === "keyword") {
                        return `[[${match}]]`;
                      } else {
                        return `{${enhancementColor3}:${match}}`;
                      }
                    });
                    setDesc3(newDesc3);
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  변환
                </button>
              </div>
            </div>
            <textarea
              value={desc3}
              onChange={(e) => setDesc3(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="강화 +2 설명을 입력하세요 (키워드는 [[키워드명]], 변경부분은 {변경내용} 형식으로 입력)"
              rows={3}
            />
            {desc3 && (
              <div className="mt-2 p-3 bg-[#1a1a1a] border border-red-700/50 rounded text-sm">
                <div className="text-gray-400 mb-1 text-xs">미리보기:</div>
                <div className="text-white whitespace-pre-wrap">
                  <KeywordHighlight text={desc3} keywords={allKeywords} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">
              해시태그 (다중 선택)
            </label>
            <div className="border border-red-700 rounded bg-[#1c1c1f]">
              {hashtags.length === 0 ? (
                <p className="text-gray-400 text-sm p-3">해시태그가 없습니다.</p>
              ) : (
                <div className="divide-y divide-red-700">
                  {/* HASHTAG_CATEGORIES에 정의된 카테고리들 */}
                  {HASHTAG_CATEGORIES.map((category) => {
                    const categoryTags = groupedHashtags[category.code] || [];
                    const isExpanded = expandedCategories.has(category.code);
                    
                    if (categoryTags.length === 0) return null;
                    
                    return (
                      <div key={category.code}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(category.code)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#2a2a2d] transition-colors"
                        >
                          <span className="text-yellow-300 font-medium">
                            {category.name}
                          </span>
                          <span className="text-gray-400 text-sm">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {categoryTags.map((tag) => (
                              <label
                                key={tag.tagId}
                                className={`px-3 py-1 rounded cursor-pointer border ${
                                  selectedTagIds.includes(tag.tagId)
                                    ? "bg-yellow-400 text-black border-yellow-400"
                                    : "bg-[#131316] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTagIds.includes(tag.tagId)}
                                  onChange={() => handleTagToggle(tag.tagId)}
                                  className="hidden"
                                />
                                {tag.tagName}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* 기타 카테고리 (HASHTAG_CATEGORIES에 없는 카테고리) */}
                  {groupedHashtags["기타"] && groupedHashtags["기타"].length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleCategory("기타")}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#2a2a2d] transition-colors"
                      >
                        <span className="text-yellow-300 font-medium">
                          기타
                        </span>
                        <span className="text-gray-400 text-sm">
                          {expandedCategories.has("기타") ? "▼" : "▶"}
                        </span>
                      </button>
                      {expandedCategories.has("기타") && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2">
                          {groupedHashtags["기타"].map((tag) => (
                            <label
                              key={tag.tagId}
                              className={`px-3 py-1 rounded cursor-pointer border ${
                                selectedTagIds.includes(tag.tagId)
                                  ? "bg-yellow-400 text-black border-yellow-400"
                                  : "bg-[#131316] text-gray-300 border-red-700 hover:bg-[#2a2a2d]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTagIds.includes(tag.tagId)}
                                onChange={() => handleTagToggle(tag.tagId)}
                                className="hidden"
                              />
                              {tag.tagName}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded"
            >
              미리보기
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
            >
              {loading ? "등록 중..." : "등록"}
            </button>
            <Link
              href="/dante/egogift"
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-center"
            >
              취소
            </Link>
          </div>
        </form>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <EgoGiftPreview
          giftName={giftName}
          giftTier={giftTier}
          keywordId={keywordId}
          attrKeywordId={attrKeywordId ? Number(attrKeywordId) : null}
          cost={cost}
          enhanceYn={enhanceYn}
          synthesisYn={synthesisYn}
          grades={selectedGrades}
          desc1={desc1}
          desc2={desc2}
          desc3={desc3}
          selectedTagIds={selectedTagIds}
          file={file}
          keywords={keywords}
          hashtags={hashtags}
          allKeywords={allKeywords}
          limitedCategoryName={null}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}


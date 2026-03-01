"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface FileInfo {
  fileId: number;
  path: string;
  originalName: string;
  storedName: string;
}

interface DifficultyFloor {
  difficulty: string;
  floors: number[];
}

interface Enemy {
  enemyId: number;
  name: string;
}

export default function CardPackEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [themeType, setThemeType] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [difficultyFloors, setDifficultyFloors] = useState<DifficultyFloor[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<FileInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [selectedEnemyIds, setSelectedEnemyIds] = useState<number[]>([]);
  const [loadingEnemies, setLoadingEnemies] = useState(false);
  const [enemySearch, setEnemySearch] = useState("");

  useEffect(() => {
    fetchCardPack();
    fetchEnemies();
    fetchEnemyMappings();
  }, [id]);

  const fetchCardPack = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || "");
        setThemeType(data.themeType ?? null);
        setDescription(data.description || "");
        // difficultyFloors 형식으로 변환
        if (data.difficultyFloors && Array.isArray(data.difficultyFloors)) {
          // 기존 데이터 호환성: "평행중첩"을 "익스트림"으로 변환
          const convertedDifficultyFloors = data.difficultyFloors.map((df: DifficultyFloor) => ({
            ...df,
            difficulty: df.difficulty === "평행중첩" ? "익스트림" : df.difficulty,
          }));
          setDifficultyFloors(convertedDifficultyFloors);
        } else {
          // 기존 형식 호환성 (floors, difficulty)
          if (data.floors && data.difficulty) {
            const difficulty = data.difficulty === "평행중첩" ? "익스트림" : data.difficulty;
            setDifficultyFloors([{ difficulty, floors: data.floors }]);
          } else {
            setDifficultyFloors([]);
          }
        }
        if (data.thumbnail) {
          setExistingFile({
            fileId: data.thumbnail.fileId,
            path: data.thumbnail.path,
            originalName: data.thumbnail.originalName,
            storedName: data.thumbnail.storedName,
          });
          const baseUrl = API_BASE_URL.replace('/api', '');
          setPreview(`${baseUrl}${data.thumbnail.path}`);
        }
      } else {
        setError("카드팩을 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("카드팩 조회 실패:", err);
      setError("카드팩 정보를 불러오는데 실패했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const fetchEnemies = async () => {
    try {
      setLoadingEnemies(true);
      const params = new URLSearchParams({
        page: "1",
        size: "10000",
      });
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
      setLoadingEnemies(false);
    }
  };

  const fetchEnemyMappings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/cardpack/enemy-map/by-cardpack/${id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const enemyIds = (data.items || []).map((item: { enemyId: number }) => item.enemyId);
        setSelectedEnemyIds(enemyIds);
      }
    } catch (err) {
      console.error("적 매핑 조회 실패:", err);
    }
  };

  const addDifficultyFloor = () => {
    setDifficultyFloors((prev) => [...prev, { difficulty: "노말", floors: [] }]);
  };

  const removeDifficultyFloor = (index: number) => {
    setDifficultyFloors((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDifficulty = (index: number, difficulty: string) => {
    setDifficultyFloors((prev) =>
      prev.map((df, i) => (i === index ? { ...df, difficulty } : df))
    );
  };

  const handleFloorToggle = (index: number, floor: number) => {
    setDifficultyFloors((prev) =>
      prev.map((df, i) => {
        if (i === index) {
          const newFloors = df.floors.includes(floor)
            ? df.floors.filter((f) => f !== floor)
            : [...df.floors, floor].sort((a, b) => a - b);
          return { ...df, floors: newFloors };
        }
        return df;
      })
    );
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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    if (themeType === null) {
      setError("테마 타입을 선택해주세요.");
      return;
    }

    if (difficultyFloors.length === 0) {
      setError("난이도별 층 정보를 하나 이상 추가해주세요.");
      return;
    }

    // 각 난이도별로 층이 하나 이상 선택되었는지 확인
    const hasEmptyFloors = difficultyFloors.some((df) => df.floors.length === 0);
    if (hasEmptyFloors) {
      setError("각 난이도별로 층을 하나 이상 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      const data = {
        cardpackId: Number(id),
        title,
        themeType,
        description,
        difficultyFloors: difficultyFloors.map((df) => ({
          difficulty: df.difficulty,
          floors: df.floors,
        })),
      };
      formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));

      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/${id}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        // 적 매핑 저장
        if (selectedEnemyIds.length > 0) {
          const mapRes = await fetch(`${API_BASE_URL}/admin/cardpack/enemy-map/create/bulk`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cardpackId: Number(id),
              enemyIds: selectedEnemyIds,
            }),
          });
          if (!mapRes.ok) {
            console.error("적 매핑 저장 실패");
          }
        } else {
          // 선택된 적이 없으면 기존 매핑 삭제
          await fetch(`${API_BASE_URL}/admin/cardpack/enemy-map/create/bulk`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cardpackId: Number(id),
              enemyIds: [],
            }),
          });
        }
        router.push("/dante/dungeon/cardpack");
      } else {
        const data = await res.json();
        setError(data.message || "수정에 실패했습니다.");
      }
    } catch (err) {
      setError("수정에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnemyToggle = (enemyId: number) => {
    setSelectedEnemyIds((prev) =>
      prev.includes(enemyId)
        ? prev.filter((id) => id !== enemyId)
        : [...prev, enemyId]
    );
  };

  const filteredEnemies = useMemo(() => {
    const keyword = enemySearch.trim().toLowerCase();
    if (!keyword) return enemies;
    return enemies.filter((enemy) =>
      enemy.name.toLowerCase().includes(keyword)
    );
  }, [enemies, enemySearch]);

  if (fetching) {
    return (
      <div>
        <div className="text-gray-300">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">카드팩 수정</h1>
        <Link
          href="/dante/dungeon/cardpack"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          목록
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="카드팩 제목을 입력하세요"
              required
            />
          </div>

          {/* 테마 타입 선택 */}
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">테마 타입 *</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 1, label: "주요 이야기" },
                { value: 2, label: "그 밖의 이야기" },
                { value: 3, label: "공격 유형" },
                { value: 4, label: "죄악 속성" },
                { value: 5, label: "키워드 속성" },
                { value: 6, label: "익스트림" },
                { value: 7, label: "기간한정" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setThemeType(item.value)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    themeType === item.value
                      ? "bg-yellow-400 text-black"
                      : "bg-[#131316] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 카드팩 설명 */}
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
              placeholder="카드팩 설명을 입력하세요 (최대 200자)"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-yellow-300 text-sm font-medium">난이도별 출현층수 *</label>
              <button
                type="button"
                onClick={addDifficultyFloor}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                + 추가
              </button>
            </div>

            {difficultyFloors.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 bg-[#1c1c1f] border border-red-700 rounded">
                난이도별 층 정보를 추가해주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {difficultyFloors.map((df, index) => (
                  <div
                    key={index}
                    className="p-4 bg-[#1c1c1f] border border-red-700 rounded"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <label className="text-yellow-300 text-sm font-medium">난이도</label>
                        <select
                          value={df.difficulty}
                          onChange={(e) => updateDifficulty(index, e.target.value)}
                          className="px-3 py-1 bg-[#131316] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                        >
                          <option value="노말">노말</option>
                          <option value="하드">하드</option>
                          <option value="익스트림">익스트림</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDifficultyFloor(index)}
                        className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-sm rounded"
                      >
                        삭제
                      </button>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-2">출현층수 (1~15, 다중 선택 가능)</label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((floor) => (
                          <button
                            key={floor}
                            type="button"
                            onClick={() => handleFloorToggle(index, floor)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                              df.floors.includes(floor)
                                ? "bg-yellow-400 text-black"
                                : "bg-[#131316] text-gray-300 border border-red-700 hover:bg-[#2a2a2d]"
                            }`}
                          >
                            {floor}층
                          </button>
                        ))}
                      </div>
                      {df.floors.length > 0 && (
                        <div className="mt-2 text-gray-400 text-xs">
                          선택된 층: {df.floors.sort((a, b) => a - b).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 등장 적 선택 */}
          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">출현 가능한 적</label>
            {loadingEnemies ? (
              <div className="text-gray-400 text-sm p-4 bg-[#1c1c1f] border border-red-700 rounded">
                적 목록을 불러오는 중...
              </div>
            ) : enemies.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 bg-[#1c1c1f] border border-red-700 rounded">
                등록된 적이 없습니다.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto p-4 bg-[#1c1c1f] border border-red-700 rounded">
                <div className="mb-3">
                  <input
                    type="text"
                    value={enemySearch}
                    onChange={(e) => setEnemySearch(e.target.value)}
                    placeholder="적 이름으로 검색..."
                    className="w-full px-3 py-2 bg-[#131316] text-white border border-red-700 rounded text-sm focus:outline-none focus:border-yellow-400"
                  />
                </div>
                {filteredEnemies.length === 0 ? (
                  <div className="text-gray-400 text-xs">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredEnemies.map((enemy) => (
                      <label
                        key={enemy.enemyId}
                        className="flex items-center gap-2 cursor-pointer hover:bg-[#2a2a2d] p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEnemyIds.includes(enemy.enemyId)}
                          onChange={() => handleEnemyToggle(enemy.enemyId)}
                          className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400"
                        />
                        <span className="text-white text-sm">{enemy.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedEnemyIds.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-700/50 text-gray-400 text-xs">
                    선택된 적: {selectedEnemyIds.length}개
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-yellow-300 text-sm font-medium mb-2">첨부파일</label>
            {existingFile && !file ? (
              <div className="space-y-3">
                <div className="p-4 bg-[#1c1c1f] border border-red-700 rounded">
                  <div className="mb-3">
                    <p className="text-gray-300 text-sm mb-2">{existingFile.originalName}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setExistingFile(null);
                        setPreview(null);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      이미지 교체
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <img
                      src={preview || undefined}
                      alt={existingFile.originalName}
                      className="max-w-full max-h-96 object-contain rounded border border-red-700/50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
                />
                {preview && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={preview}
                      alt="미리보기"
                      className="max-w-full max-h-96 object-contain border border-red-700/50 rounded"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
            >
              {loading ? "수정 중..." : "수정"}
            </button>
            <Link
              href="/dante/dungeon/cardpack"
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-center"
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}


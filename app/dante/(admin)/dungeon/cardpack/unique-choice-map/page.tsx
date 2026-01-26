"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface CardPack {
  cardpackId: number;
  title: string;
}

interface DungeonEvent {
  eventId: number;
  title: string;
}


interface UniqueChoiceMap {
  cardpackId: number;
  eventId: number;
}

export default function CardPackUniqueChoiceMapPage() {
  const [cardPacks, setCardPacks] = useState<CardPack[]>([]);
  const [events, setEvents] = useState<DungeonEvent[]>([]);
  const [selectedCardpackId, setSelectedCardpackId] = useState<number | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [maps, setMaps] = useState<UniqueChoiceMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [cardpackSearchText, setCardpackSearchText] = useState("");
  const [eventSearchText, setEventSearchText] = useState("");

  useEffect(() => {
    fetchCardPacks();
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedCardpackId) {
      fetchMaps(selectedCardpackId);
    } else {
      setMaps([]);
      setSelectedEventIds([]);
    }
  }, [selectedCardpackId]);

  const fetchCardPacks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/cardpack/list?page=1&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCardPacks(data.items || []);
      }
    } catch (err) {
      console.error("카드팩 목록 조회 실패:", err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dungeon/event/list?page=1&size=10000`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items || []);
      }
    } catch (err) {
      console.error("이벤트 목록 조회 실패:", err);
    }
  };

  const fetchMaps = async (cardpackId: number) => {
    try {
      setFetching(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/cardpack/unique-choice-map/by-cardpack/${cardpackId}`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const mapList = data.items || [];
        setMaps(mapList);
        setSelectedEventIds(mapList.map((m: UniqueChoiceMap) => m.eventId));
      }
    } catch (err) {
      console.error("매핑 목록 조회 실패:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleEventToggle = (eventId: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSave = async () => {
    if (!selectedCardpackId) {
      alert("카드팩을 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/admin/cardpack/unique-choice-map/create/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            cardpackId: selectedCardpackId,
            eventIds: selectedEventIds,
          }),
        }
      );

      if (res.ok) {
        alert("매핑이 저장되었습니다.");
        if (selectedCardpackId) {
          fetchMaps(selectedCardpackId);
        }
      } else {
        alert("매핑 저장에 실패했습니다.");
      }
    } catch (err) {
      console.error("매핑 저장 실패:", err);
      alert("매핑 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cardpackId: number, eventId: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/cardpack/unique-choice-map/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardpackId,
          eventId,
        }),
      });

      if (res.ok) {
        alert("매핑이 삭제되었습니다.");
        if (selectedCardpackId) {
          fetchMaps(selectedCardpackId);
        }
      } else {
        alert("매핑 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("매핑 삭제 실패:", err);
      alert("매핑 삭제에 실패했습니다.");
    }
  };

  const selectedCardPack = cardPacks.find(
    (cp) => cp.cardpackId === selectedCardpackId
  );

  // 필터링된 카드팩 목록
  const filteredCardPacks = useMemo(() => {
    if (!cardpackSearchText.trim()) return cardPacks;
    const searchLower = cardpackSearchText.toLowerCase().trim();
    return cardPacks.filter((cp) =>
      cp.title.toLowerCase().includes(searchLower)
    );
  }, [cardPacks, cardpackSearchText]);

  // 필터링된 이벤트 목록
  const filteredEvents = useMemo(() => {
    if (!eventSearchText.trim()) return events;
    const searchLower = eventSearchText.toLowerCase().trim();
    return events.filter((event) =>
      event.title.toLowerCase().includes(searchLower)
    );
  }, [events, eventSearchText]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">
          카드팩-던전 이벤트 매핑 관리
        </h1>
        <Link
          href="/dante/dungeon/cardpack"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          카드팩 목록
        </Link>
      </div>

      <div className="space-y-6">
        {/* 카드팩 선택 */}
        <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
          <label className="block text-yellow-300 text-sm font-medium mb-3">
            카드팩 선택
          </label>
          <input
            type="text"
            placeholder="카드팩 검색..."
            value={cardpackSearchText}
            onChange={(e) => setCardpackSearchText(e.target.value)}
            className="w-full px-3 py-2 mb-3 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
          />
          <select
            value={selectedCardpackId || ""}
            onChange={(e) => {
              setSelectedCardpackId(e.target.value ? Number(e.target.value) : null);
            }}
            className="w-full px-4 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
          >
            <option value="">카드팩을 선택하세요</option>
            {filteredCardPacks.map((cardPack) => (
              <option key={cardPack.cardpackId} value={cardPack.cardpackId}>
                {cardPack.title}
              </option>
            ))}
          </select>
          {cardpackSearchText.trim() && filteredCardPacks.length === 0 && (
            <div className="mt-2 text-gray-400 text-sm">
              검색 결과가 없습니다.
            </div>
          )}
        </div>

        {selectedCardpackId && (
          <>
            {/* 던전 이벤트 선택 */}
            <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
              <label className="block text-yellow-300 text-sm font-medium mb-3">
                연결할 던전 이벤트 선택 (다중 선택 가능)
              </label>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="던전 이벤트 검색..."
                  value={eventSearchText}
                  onChange={(e) => setEventSearchText(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400 text-sm"
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {events.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    등록된 던전 이벤트가 없습니다.
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <label
                      key={event.eventId}
                      className="flex items-center gap-2 p-2 hover:bg-[#1c1c1f] rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEventIds.includes(event.eventId)}
                        onChange={() => handleEventToggle(event.eventId)}
                        className="w-4 h-4 text-yellow-400 bg-[#1c1c1f] border-red-700 rounded focus:ring-yellow-400"
                      />
                      <span className="text-gray-300 text-sm">
                        {event.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded disabled:opacity-50"
              >
                {loading ? "저장 중..." : "매핑 저장"}
              </button>
            </div>

            {/* 현재 매핑 목록 */}
            <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6">
              <h2 className="text-yellow-300 text-lg font-semibold mb-4">
                현재 연결된 던전 이벤트 ({selectedCardPack?.title})
              </h2>
              {fetching ? (
                <div className="text-gray-300">로딩 중...</div>
              ) : maps.length === 0 ? (
                <div className="text-gray-400 text-sm">연결된 던전 이벤트가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {maps.map((map) => {
                    const event = events.find((e) => e.eventId === map.eventId);
                    return (
                      <div
                        key={`${map.cardpackId}-${map.eventId}`}
                        className="flex justify-between items-center p-3 bg-[#1c1c1f] border border-red-700/50 rounded"
                      >
                        <span className="text-gray-300 text-sm">
                          {event?.title || `던전 이벤트 ID: ${map.eventId}`}
                        </span>
                        <button
                          onClick={() => handleDelete(map.cardpackId, map.eventId)}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm rounded"
                        >
                          삭제
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


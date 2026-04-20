"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getOrCreateUUID } from "@/lib/uuid";

const MIGRATION_HIDE_COOKIE = "limbus_hide_migration_prompt";
const BANNED_NICKNAME_HIDE_COOKIE = "limbus_hide_banned_nickname_notice";
const DAY_SECONDS = 60 * 60 * 24;
const NICKNAME_ALLOWED_REGEX = /^[\p{L}\p{N} ]+$/u;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(encoded)) {
      return decodeURIComponent(trimmed.substring(encoded.length));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export default function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api",
    []
  );
  
  // 현재 경로에 따라 초기 활성 탭 결정
  const getInitialTab = (): "egogift" | "event" | "cardpack" | "favorites" => {
    if (pathname.startsWith("/event")) {
      return "event";
    } else if (pathname.startsWith("/egogift")) {
      return "egogift";
    } else if (pathname.startsWith("/cardpack")) {
      return "cardpack";
    } else if (pathname.startsWith("/favorites")) {
      return "favorites";
    }
    return "egogift"; // 기본값
  };
  
  const [activeTab, setActiveTab] = useState<"egogift" | "event" | "cardpack" | "favorites">(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFavoritesMenuOpen, setMobileFavoritesMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userNickname, setUserNickname] = useState<string>("");
  const [migrationPromptOpen, setMigrationPromptOpen] = useState(false);
  const [favoriteMigratableCount, setFavoriteMigratableCount] = useState(0);
  const [reportMigratableCount, setReportMigratableCount] = useState(0);
  const [migratingFavorites, setMigratingFavorites] = useState(false);
  const [migrationStatusChecked, setMigrationStatusChecked] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameError, setNicknameError] = useState<string>("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameCheckReason, setNicknameCheckReason] = useState<string>("");
  const [bannedNicknameNoticeOpen, setBannedNicknameNoticeOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const favoritesMenuRef = useRef<HTMLDivElement | null>(null);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const favoritesSubTab = (searchParams.get("tab") || "result").toLowerCase();

  // pathname이 변경될 때마다 activeTab 동기화 (동기적으로 실행하여 깜빡임 방지)
  useLayoutEffect(() => {
    if (pathname.startsWith("/event")) {
      setActiveTab("event");
    } else if (pathname.startsWith("/egogift")) {
      setActiveTab("egogift");
    } else if (pathname.startsWith("/cardpack")) {
      setActiveTab("cardpack");
    } else if (pathname.startsWith("/favorites")) {
      setActiveTab("favorites");
    }
  }, [pathname]);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/google/me`, {
          method: "GET",
          credentials: "include"
        });
        if (!response.ok) {
          setIsAuthenticated(false);
          setUserName("");
          return;
        }
        const data = await response.json();
        const authenticated = Boolean(data?.authenticated);
        setIsAuthenticated(authenticated);
        setUserName(authenticated ? String(data?.user?.name || "") : "");
        setUserNickname("");
        setMigrationStatusChecked(false);
      } catch {
        setIsAuthenticated(false);
        setUserName("");
        setUserNickname("");
        setMigrationStatusChecked(false);
      }
    };

    fetchMe();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNicknameModalOpen(false);
      return;
    }

    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/user/profile/me`, {
          method: "GET",
          credentials: "include"
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.authenticated) return;
        const nickname = String(data?.nickname || "").trim();
        const nicknameBanned = Boolean(data?.nicknameBanned);
        if (nickname) {
          setUserNickname(nickname);
          setUserName(nickname);
          setNicknameModalOpen(false);
          if (nicknameBanned && getCookie(BANNED_NICKNAME_HIDE_COOKIE) !== "1") {
            setBannedNicknameNoticeOpen(true);
          }
          return;
        }
        setNicknameInput("");
        setNicknameAvailable(null);
        setNicknameError("닉네임을 먼저 설정해주세요.");
        setNicknameModalOpen(true);
      } catch {
        // noop
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, isAuthenticated]);

  useEffect(() => {
    if (!nicknameModalOpen) return;
    const trimmed = nicknameInput.trim();
    if (trimmed.length < 2) {
      setNicknameAvailable(null);
      setNicknameCheckReason("");
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setCheckingNickname(true);
      try {
        const res = await fetch(`${apiBaseUrl}/user/profile/check-nickname?nickname=${encodeURIComponent(trimmed)}`, {
          method: "GET",
          credentials: "include"
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setNicknameAvailable(Boolean(data?.available));
          setNicknameCheckReason(String(data?.reason || ""));
        }
      } finally {
        if (!cancelled) {
          setCheckingNickname(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [apiBaseUrl, nicknameInput, nicknameModalOpen]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (favoritesMenuRef.current && !favoritesMenuRef.current.contains(event.target as Node)) {
        setFavoritesMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", onClickOutside);
    }
    if (favoritesMenuOpen) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [userMenuOpen, favoritesMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const checkMigrationStatus = async () => {
      if (!isAuthenticated || migrationStatusChecked || migrationPromptOpen) return;
      if (getCookie(MIGRATION_HIDE_COOKIE) === "1") {
        setMigrationStatusChecked(true);
        return;
      }
      try {
        const uuid = getOrCreateUUID();
        if (!uuid) return;

        const migrationRes = await fetch(`${apiBaseUrl}/user/favorite-search/migration/status`, {
          method: "GET",
          headers: { "X-User-UUID": uuid },
          credentials: "include"
        });
        if (!migrationRes.ok) return;
        const migrationData = await migrationRes.json();
        if (!cancelled && migrationData?.hasMigratable) {
          const favoriteCount = Number(migrationData.favoriteMigratableCount) || 0;
          const reportCount = Number(migrationData.reportMigratableCount) || 0;
          setFavoriteMigratableCount(favoriteCount);
          setReportMigratableCount(reportCount);
          setMigrationPromptOpen(true);
        }
        if (!cancelled) {
          setMigrationStatusChecked(true);
        }
      } catch {
        // 상태 확인 실패는 전체 UI를 막지 않는다.
      }
    };

    checkMigrationStatus();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, isAuthenticated, migrationStatusChecked, migrationPromptOpen, pathname, searchParams]);

  const openMigrationPromptFromMenu = async () => {
    const uuid = getOrCreateUUID();
    if (!uuid) return;
    try {
      const res = await fetch(`${apiBaseUrl}/user/favorite-search/migration/status`, {
        method: "GET",
        headers: { "X-User-UUID": uuid },
        credentials: "include"
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.hasMigratable) {
        setFavoriteMigratableCount(Number(data.favoriteMigratableCount) || 0);
        setReportMigratableCount(Number(data.reportMigratableCount) || 0);
        setMigrationPromptOpen(true);
      } else {
        alert("이관할 데이터가 없습니다.");
      }
    } catch {
      // noop
    }
  };

  const handleConfirmMigration = async () => {
    const uuid = getOrCreateUUID();
    if (!uuid) return;

    setMigratingFavorites(true);
    try {
      const res = await fetch(`${apiBaseUrl}/user/favorite-search/migration/confirm`, {
        method: "POST",
        headers: { "X-User-UUID": uuid },
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      setMigrationPromptOpen(false);
      setFavoriteMigratableCount(0);
      setReportMigratableCount(0);
      setMigrationStatusChecked(true);
      window.location.reload();
    } finally {
      setMigratingFavorites(false);
    }
  };

  const handleHideMigrationForADay = () => {
    setCookie(MIGRATION_HIDE_COOKIE, "1", DAY_SECONDS);
    setMigrationPromptOpen(false);
  };

  const handleOpenNicknameModal = () => {
    setUserMenuOpen(false);
    setNicknameInput(userNickname || "");
    setNicknameAvailable(null);
    setNicknameCheckReason("");
    setNicknameError("");
    setNicknameModalOpen(true);
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setNicknameError("닉네임은 2자 이상 16자 이하로 입력해주세요.");
      return;
    }
    if (!NICKNAME_ALLOWED_REGEX.test(trimmed)) {
      setNicknameError("특수문자는 사용할 수 없습니다. (공백 허용)");
      return;
    }
    setSavingNickname(true);
    setNicknameError("");
    try {
      const res = await fetch(`${apiBaseUrl}/user/profile/nickname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nickname: trimmed })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setNicknameError(String(data?.message || "닉네임 저장에 실패했습니다."));
        return;
      }
      const savedNickname = String(data.nickname || trimmed);
      setUserNickname(savedNickname);
      setUserName(savedNickname);
      setNicknameModalOpen(false);
    } catch {
      setNicknameError("닉네임 저장에 실패했습니다.");
    } finally {
      setSavingNickname(false);
    }
  };

  const handleHideBannedNicknameForADay = () => {
    setCookie(BANNED_NICKNAME_HIDE_COOKIE, "1", DAY_SECONDS);
    setBannedNicknameNoticeOpen(false);
  };

  const handleMenuClick = (tab: "egogift" | "event" | "cardpack" | "favorites") => {
    setActiveTab(tab);
    setMobileMenuOpen(false); // 모바일 메뉴 닫기
    setFavoritesMenuOpen(false);
    setMobileFavoritesMenuOpen(false);
    if (tab === "event") {
      window.location.href = "/event";
    } else if (tab === "cardpack") {
      window.location.href = "/cardpack";
    } else if (tab === "favorites") {
      window.location.href = "/favorites?tab=result";
    } else {
      window.location.href = "/egogift";
    }
  };

  const handleFavoritesSubMenuClick = (subTab: "result" | "share-board") => {
    setActiveTab("favorites");
    setFavoritesMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileFavoritesMenuOpen(false);
    window.location.href = `/favorites?tab=${subTab}`;
  };

  const handleGoogleLogout = async () => {
    try {
      await fetch(`${apiBaseUrl}/auth/google/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      setIsAuthenticated(false);
      setUserName("");
      window.location.reload();
    }
  };

  return (
    <>
      {migrationPromptOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="migration-confirm-modal-title"
        >
          <div
            className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="migration-confirm-modal-title" className="text-lg font-semibold text-yellow-300 mb-3">
              즐겨찾기 및 보고서 이관 확인
            </h2>
            <p className="text-gray-300 text-sm mb-2">
              로그인 전 저장한 즐겨찾기 {favoriteMigratableCount}건 / 보고서 {reportMigratableCount}건을 현재 계정으로 이관하시겠습니까?
            </p>
            <p className="text-gray-400 text-xs mb-4">
              이관 후 해당 데이터는 계정에 이관되며 비 로그인시 사용하던 즐겨찾기/보고서 데이터는 삭제됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleHideMigrationForADay}
                disabled={migratingFavorites}
                className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                하루동안 보지 않기
              </button>
              <button
                type="button"
                onClick={handleConfirmMigration}
                disabled={migratingFavorites}
                className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {migratingFavorites ? "이관 중..." : "이관하기"}
              </button>
            </div>
          </div>
        </div>
      )}
      {nicknameModalOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="nickname-modal-title">
          <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 id="nickname-modal-title" className="text-lg font-semibold text-yellow-300 mb-3">닉네임 설정</h2>
            <p className="text-gray-400 text-sm mb-3">서비스에서 사용할 닉네임을 입력해주세요.</p>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => {
                setNicknameInput(e.target.value);
                setNicknameError("");
              }}
              maxLength={16}
              placeholder="닉네임 (2~16자, 공백 허용)"
              className="w-full px-3 py-2.5 bg-[#2a2a2d] text-white rounded border border-[#b8860b]/30 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-inset"
            />
            <p className="mt-2 text-xs">
              {checkingNickname ? (
                <span className="text-gray-400">중복 확인 중...</span>
              ) : nicknameInput.trim().length < 2 ? (
                <span className="text-gray-400">닉네임은 2자 이상 입력해주세요.</span>
              ) : nicknameInput.trim().length > 16 ? (
                <span className="text-red-400">닉네임은 16자 이하로 입력해주세요.</span>
              ) : !NICKNAME_ALLOWED_REGEX.test(nicknameInput.trim()) ? (
                <span className="text-red-400">특수문자는 사용할 수 없습니다. (공백 허용)</span>
              ) : nicknameAvailable ? (
                <span className="text-green-400">사용 가능한 닉네임입니다.</span>
              ) : nicknameCheckReason === "format" ? (
                <span className="text-red-400">특수문자는 사용할 수 없습니다. (공백 허용)</span>
              ) : nicknameCheckReason === "banned_word" ? (
                <span className="text-red-400">금칙어가 포함되어 사용할 수 없습니다.</span>
              ) : (
                <span className="text-red-400">이미 사용 중인 닉네임입니다.</span>
              )}
            </p>
            {nicknameError && <p className="mt-2 text-sm text-red-400">{nicknameError}</p>}
            <div className="flex gap-2 justify-end mt-4">
              {userNickname && (
                <button
                  type="button"
                  onClick={() => setNicknameModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveNickname}
                disabled={
                  savingNickname ||
                  checkingNickname ||
                  nicknameAvailable === false ||
                  nicknameInput.trim().length < 2 ||
                  nicknameInput.trim().length > 16 ||
                  !NICKNAME_ALLOWED_REGEX.test(nicknameInput.trim())
                }
                className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {savingNickname ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
      {bannedNicknameNoticeOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="banned-nickname-notice-title">
          <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 id="banned-nickname-notice-title" className="text-lg font-semibold text-yellow-300 mb-3">
              닉네임 안내
            </h2>
            <p className="text-gray-300 text-sm mb-4">
              현재 닉네임이 금칙어 정책에 포함되었습니다. 원하시면 닉네임 변경 메뉴에서 새 닉네임으로 변경해주세요.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleHideBannedNicknameForADay}
                className="px-4 py-2 rounded border border-[#b8860b]/40 text-gray-300 hover:bg-white/5 transition-colors"
              >
                하루동안 보지 않기
              </button>
              <button
                type="button"
                onClick={() => setBannedNicknameNoticeOpen(false)}
                className="px-4 py-2 rounded bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="bg-[#131316] border-b border-[#b8860b]/40 sticky top-0 z-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/LunarMemory.png"
              alt="단테의 달의기억"
              className="h-10 w-auto"
            />
            <span className="text-2xl font-bold text-yellow-300">
              단테의 달의기억
            </span>
          </Link>

          {/* 네비게이션 메뉴 */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <button
                onClick={() => handleMenuClick("egogift")}
                className={`px-4 py-2 rounded transition-colors ${
                  activeTab === "egogift"
                    ? "bg-yellow-400 text-black font-semibold"
                    : "text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
                }`}
              >
                에고기프트
              </button>
              <button
                onClick={() => handleMenuClick("event")}
                className={`px-4 py-2 rounded transition-colors ${
                  activeTab === "event"
                    ? "bg-yellow-400 text-black font-semibold"
                    : "text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
                }`}
              >
                던전 이벤트
              </button>
              <button
                onClick={() => handleMenuClick("cardpack")}
                className={`px-4 py-2 rounded transition-colors ${
                  activeTab === "cardpack"
                    ? "bg-yellow-400 text-black font-semibold"
                    : "text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
                }`}
              >
                카드팩
              </button>
              <div className="relative" ref={favoritesMenuRef}>
                <button
                  type="button"
                  onClick={() => setFavoritesMenuOpen((prev) => !prev)}
                  className={`px-4 py-2 rounded transition-colors inline-flex items-center gap-1 ${
                    activeTab === "favorites"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
                  }`}
                >
                  던전 보고서
                  <span className={`text-xs transition-transform ${favoritesMenuOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {favoritesMenuOpen && (
                  <div className="absolute left-0 mt-2 min-w-[190px] rounded-lg border border-[#b8860b]/40 bg-[#1a1a1a] shadow-lg z-50 py-1">
                    <button
                      type="button"
                      onClick={() => handleFavoritesSubMenuClick("result")}
                      className={`w-full text-left px-4 py-2 text-sm ${favoritesSubTab !== "share-board" ? "text-yellow-200 bg-[#2a2a2d]" : "text-gray-200 hover:bg-[#2a2a2d]"}`}
                    >
                      파우스트의 보고서
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFavoritesSubMenuClick("share-board")}
                      className={`w-full text-left px-4 py-2 text-sm ${favoritesSubTab === "share-board" ? "text-yellow-200 bg-[#2a2a2d]" : "text-gray-200 hover:bg-[#2a2a2d]"}`}
                    >
                      공유게시판
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="px-3 py-2 rounded border border-[#b8860b]/50 text-yellow-300 hover:bg-[#1a1a1a] transition-colors inline-flex items-center gap-2"
                  >
                    <span className="text-sm">{userName ? `${userName}님` : "로그인됨"}</span>
                    <span className={`text-xs transition-transform ${userMenuOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 min-w-[210px] rounded-lg border border-[#b8860b]/40 bg-[#1a1a1a] shadow-lg z-50 py-1">
                      <button
                        type="button"
                        onClick={handleOpenNicknameModal}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#2a2a2d]"
                      >
                        닉네임 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void openMigrationPromptFromMenu();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#2a2a2d]"
                      >
                        즐겨찾기/보고서 이관
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleGoogleLogout}
                  className="px-3 py-2 rounded border border-[#b8860b]/50 text-yellow-300 hover:bg-[#1a1a1a] transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="px-3 py-2 rounded border border-[#b8860b]/50 text-yellow-300 hover:bg-[#1a1a1a] transition-colors inline-flex items-center gap-2"
              >
                <img src="/google_login.png" alt="" className="h-4 w-4 object-contain" />
                구글 로그인
              </a>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="md:hidden relative">
            <button
              className="text-gray-300 hover:text-yellow-300 text-2xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>

            {/* 모바일 메뉴 드롭다운 */}
            {mobileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-[#b8860b]/40 rounded-lg shadow-lg z-50">
                <button
                  onClick={() => handleMenuClick("egogift")}
                  className={`w-full text-left px-4 py-3 rounded-t-lg transition-colors ${
                    activeTab === "egogift"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  }`}
                >
                  에고기프트
                </button>
                <button
                  onClick={() => handleMenuClick("event")}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    activeTab === "event"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  }`}
                >
                  던전 이벤트
                </button>
                <button
                  onClick={() => handleMenuClick("cardpack")}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    activeTab === "cardpack"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  }`}
                >
                  카드팩
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFavoritesMenuOpen((prev) => !prev)}
                  className={`w-full text-left px-4 py-3 transition-colors inline-flex items-center justify-between ${
                    activeTab === "favorites"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  }`}
                >
                  <span>던전 보고서</span>
                  <span className={`text-xs transition-transform ${mobileFavoritesMenuOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {mobileFavoritesMenuOpen && (
                  <div className="bg-[#141417] border-t border-[#b8860b]/20 border-b border-[#b8860b]/20">
                    <button
                      type="button"
                      onClick={() => handleFavoritesSubMenuClick("result")}
                      className={`w-full text-left pl-8 pr-4 py-2 text-sm ${favoritesSubTab !== "share-board" ? "text-yellow-200" : "text-gray-300 hover:text-yellow-300"}`}
                    >
                      파우스트의 보고서
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFavoritesSubMenuClick("share-board")}
                      className={`w-full text-left pl-8 pr-4 py-2 text-sm ${favoritesSubTab === "share-board" ? "text-yellow-200" : "text-gray-300 hover:text-yellow-300"}`}
                    >
                      공유게시판
                    </button>
                  </div>
                )}
                {isAuthenticated ? (
                  <>
                    <button
                      onClick={handleOpenNicknameModal}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                    >
                      닉네임 변경
                    </button>
                    <button
                      onClick={() => void openMigrationPromptFromMenu()}
                      className="w-full text-left px-4 py-3 text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                    >
                      즐겨찾기/보고서 이관
                    </button>
                    <button
                      onClick={handleGoogleLogout}
                      className="w-full text-left px-4 py-3 rounded-b-lg text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <a
                    href="/login"
                    className="block w-full text-left px-4 py-3 rounded-b-lg text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  >
                    <span className="inline-flex items-center gap-2">
                      <img src="/google_login.png" alt="" className="h-4 w-4 object-contain" />
                      구글 로그인
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}


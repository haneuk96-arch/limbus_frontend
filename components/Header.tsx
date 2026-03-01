"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  
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

  const handleMenuClick = (tab: "egogift" | "event" | "cardpack" | "favorites") => {
    setActiveTab(tab);
    setMobileMenuOpen(false); // 모바일 메뉴 닫기
    if (tab === "event") {
      window.location.href = "/event";
    } else if (tab === "cardpack") {
      window.location.href = "/cardpack";
    } else if (tab === "favorites") {
      window.location.href = "/favorites";
    } else {
      window.location.href = "/egogift";
    }
  };

  return (
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
          <nav className="hidden md:flex items-center gap-6">
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
            <button
              onClick={() => handleMenuClick("favorites")}
              className={`px-4 py-2 rounded transition-colors ${
                activeTab === "favorites"
                  ? "bg-yellow-400 text-black font-semibold"
                  : "text-gray-300 hover:text-yellow-300 hover:bg-[#1a1a1a]"
              }`}
            >
              던전 보고서
            </button>
          </nav>

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
                  onClick={() => handleMenuClick("favorites")}
                  className={`w-full text-left px-4 py-3 rounded-b-lg transition-colors ${
                    activeTab === "favorites"
                      ? "bg-yellow-400 text-black font-semibold"
                      : "text-gray-300 hover:bg-[#2a2a2d] hover:text-yellow-300"
                  }`}
                >
                  던전 보고서
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}


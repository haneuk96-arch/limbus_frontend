"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

export default function DanteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 🔥 세션 체크(useEffect)
  useEffect(() => {
    console.log("API_BASE_URL : "+API_BASE_URL);
    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/check`, {
          method: "GET",
          credentials: "include",
        });
        console.log("res.status : "+res.status);
        // 인증 실패 → 로그인 페이지로 이동
        if (res.status === 401) {
          router.replace("/dante/login");
        }
      } catch (err) {
        // 요청 자체가 실패해도 로그인 화면으로 이동
        router.replace("/dante/login");
        console.log(err);
      }
    };

    checkSession();
  }, [router]);

  const menus = [
    { name: "대시보드", path: "/dante/dashboard" },
    {
      name: "키워드",
      path: "/dante/keyword",
      subMenus: [
        { name: "카테고리", path: "/dante/keyword/category" },
        { name: "키워드", path: "/dante/keyword/keyword" },
        { name: "해시태그", path: "/dante/keyword/hashtag" },
      ],
    },
    {
      name: "에고기프트 관리",
      path: "/dante/egogift",
      subMenus: [
        { name: "에고기프트 목록", path: "/dante/egogift" },
        { name: "카테고리", path: "/dante/egogift/category" },
        { name: "카테고리 매핑", path: "/dante/egogift/category-map" },
        { name: "조합식", path: "/dante/egogift/recipe" },
      ],
    },
    {
      name: "던전",
      path: "/dante/dungeon",
      subMenus: [
        { name: "카드팩", path: "/dante/dungeon/cardpack" },
        { name: "카드팩-에고기프트 카테고리 매핑", path: "/dante/dungeon/cardpack/egogift-category-map" },
        { name: "카드팩-고유선택지 매핑", path: "/dante/dungeon/cardpack/unique-choice-map" },
        { name: "이벤트", path: "/dante/dungeon/event" },
        { name: "등장 적", path: "/dante/dungeon/enemy" },
      ],
    },
    {
      name: "인격 관리",
      path: "/dante/personality",
      subMenus: [
        { name: "인격 목록", path: "/dante/personality" },
        { name: "E.G.O 목록", path: "/dante/personality/ego" },
      ],
    },
  ];

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {}

    router.replace("/dante/login");
    window.location.reload();
  };

  return (
    <div className="flex h-screen text-white">

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#131316] border-r border-red-700 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 text-2xl font-bold text-yellow-300 flex items-center justify-between">
          <span>Limbus Admin</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <nav className="mt-6 flex flex-col">
          {menus.map((m) => {
            const hasSubMenus = "subMenus" in m && m.subMenus;
            
            // 서브메뉴가 있는 경우: 서브메뉴 중 하나가 활성화되어 있을 때만 부모 메뉴 활성화
            // 서브메뉴가 없는 경우: pathname이 정확히 일치하거나 하위 경로일 때 활성화
            let active = false;
            if (hasSubMenus && m.subMenus) {
              // 각 서브메뉴가 활성화되어 있는지 확인
              const activeSubMenus = m.subMenus.filter((subMenu) => {
                // 정확히 일치하는 경우
                if (pathname === subMenu.path) return true;
                // 하위 경로인지 확인 (예: /dante/egogift/edit/1)
                if (pathname.startsWith(subMenu.path + "/")) return true;
                return false;
              });
              
              // 활성화된 서브메뉴가 있으면 부모 메뉴도 활성화
              if (activeSubMenus.length > 0) {
                active = true;
              } else {
                // 활성화된 서브메뉴가 없지만, pathname이 부모 path와 정확히 일치하는 경우
                // 부모 path와 같은 서브메뉴가 있는지 확인
                if (pathname === m.path) {
                  const hasParentPathSubMenu = m.subMenus.some((subMenu) => subMenu.path === m.path);
                  active = hasParentPathSubMenu;
                }
              }
            } else {
              // 서브메뉴가 없으면 정확히 일치하거나 하위 경로일 때 활성화
              active = pathname === m.path || pathname.startsWith(m.path + "/");
            }

            return (
              <div key={m.path}>
                {hasSubMenus ? (
                  <>
                    <div
                      className={`px-6 py-3 text-sm font-medium border-l-4 
                        ${
                          active
                            ? "border-yellow-400 bg-[#1c1c1f] text-yellow-300"
                            : "border-transparent text-gray-300"
                        }
                      `}
                    >
                      {m.name}
                    </div>
                    {m.subMenus?.map((subMenu) => {
                      // 서브메뉴 활성화
                      let subActive = false;
                      // 서브메뉴의 path가 부모 메뉴의 path와 같으면
                      if (subMenu.path === m.path) {
                        // 정확히 일치하거나 하위 경로일 때 활성화
                        // 단, 다른 서브메뉴의 경로가 아닐 때만
                        if (pathname === subMenu.path) {
                          subActive = true;
                        } else if (pathname.startsWith(subMenu.path + "/")) {
                          // 다른 서브메뉴의 경로인지 확인
                          const isOtherSubMenuPath = m.subMenus?.some((otherSub) => 
                            otherSub.path !== m.path && pathname.startsWith(otherSub.path)
                          );
                          subActive = !isOtherSubMenuPath;
                        }
                      } else {
                        // 서브메뉴의 path가 부모 메뉴의 path와 다르면 정확히 일치하거나 하위 경로일 때 활성화
                        subActive = pathname === subMenu.path || pathname.startsWith(subMenu.path + "/");
                      }
                      return (
                        <Link
                          href={subMenu.path}
                          key={subMenu.path}
                          className={`px-10 py-2 text-sm border-l-4 block
                            ${
                              subActive
                                ? "border-yellow-400 bg-[#1c1c1f] text-yellow-300"
                                : "border-transparent text-gray-400 hover:bg-[#1a1a1d] hover:text-gray-300"
                            }
                          `}
                        >
                          {subMenu.name}
                        </Link>
                      );
                    })}
                  </>
                ) : (
                  <Link
                    href={m.path}
                    className={`px-6 py-3 text-sm font-medium border-l-4 block
                      ${
                        active
                          ? "border-yellow-400 bg-[#1c1c1f] text-yellow-300"
                          : "border-transparent text-gray-300 hover:bg-[#1a1a1d]"
                      }
                    `}
                  >
                    {m.name}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col bg-[#0b0b0c]">

        {/* 헤더 */}
        <header className="h-14 bg-[#131316] flex items-center justify-between px-4 lg:px-6 border-b border-red-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-yellow-300 hover:text-yellow-400"
            >
              ☰
            </button>
            <div className="text-lg text-yellow-300 font-semibold">
              관리자 페이지
            </div>
          </div>

          <button
            onClick={logout}
            className="px-3 lg:px-4 py-1 text-sm bg-red-700 hover:bg-red-800 rounded"
          >
            로그아웃
          </button>
        </header>

        {/* 실제 페이지 컨텐츠 */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>

        {/* 푸터 */}
        <footer className="h-12 bg-[#131316] border-t border-red-700 flex items-center justify-center text-xs text-gray-400">
          © 2025 Limbus Admin. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

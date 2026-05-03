"use client";

import Link from "next/link";

const personalitySections = [
  { order: 1, name: "이상", image: "/images/identities/yi-sang.png" },
  { order: 2, name: "파우스트", image: "/images/identities/faust.png" },
  { order: 3, name: "돈키호테", image: "/images/identities/don-quixote.png" },
  { order: 4, name: "로슈", image: "/images/identities/ryoshu.png" },
  { order: 5, name: "뫼르소", image: "/images/identities/meursault.png" },
  { order: 6, name: "홍루", image: "/images/identities/hong-lu.png" },
  { order: 7, name: "히스클리프", image: "/images/identities/heathcliff.png" },
  { order: 8, name: "이스마엘", image: "/images/identities/ishmael.png" },
  { order: 9, name: "로쟈", image: "/images/identities/rodion.png" },
  { order: 11, name: "싱클레어", image: "/images/identities/sinclair.png" },
  { order: 12, name: "오티스", image: "/images/identities/outis.png" },
  { order: 13, name: "그레고르", image: "/images/identities/gregor.png" },
];

export default function PersonalityAdminPage() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-yellow-300">인격 등록</h1>
        <Link
          href="/dante/personality"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded text-sm sm:text-base"
        >
          새로고침
        </Link>
      </div>

      <div className="bg-[#131316] border border-red-700 rounded p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        {personalitySections.map((section) => (
          <section
            key={section.order}
            className="rounded border border-red-700/70 overflow-hidden bg-[#1c1c1f]"
          >
            <Link href={`/dante/personality/${section.order}`} className="block">
              <div className="px-4 py-2 bg-[#19191c] border-b border-red-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-yellow-400 px-2 text-xs font-bold text-black">
                    {section.order}
                  </span>
                  <span className="text-yellow-300 font-semibold">{section.name}</span>
                </div>
                <span className="text-gray-300 text-sm">목록 페이지 이동</span>
              </div>

              <div className="relative h-28 sm:h-32">
                <div
                  className="absolute inset-0 bg-cover bg-no-repeat opacity-100"
                  style={{
                    backgroundImage: `url(${section.image})`,
                    backgroundPosition: "center 18%",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#131316]/35 via-[#131316]/15 to-[#131316]/35" />
              </div>
            </Link>
          </section>
        ))}

      </div>
    </div>
  );
}

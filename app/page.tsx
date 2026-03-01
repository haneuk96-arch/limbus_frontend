"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div 
      className="min-h-screen text-white relative flex items-center justify-center"
      style={{
        backgroundImage: "url('/Yihongyuan_Yard_BG.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed"
      }}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/70 z-0"></div>
      
      {/* 컨텐츠 영역 */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-12">
        {/* 타이틀 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-yellow-300 mb-4 drop-shadow-[0_0_10px_rgba(255,204,51,0.5)]">
            단테의 달의기억
          </h1>
          <p className="text-lg md:text-xl text-gray-300">
            Limbus Company 정보 사이트
          </p>
        </div>

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {/* 에고기프트 카드 */}
          <Link 
            href="/egogift"
            className="group relative overflow-hidden bg-[#131316] border-2 border-red-600/60 rounded-lg p-8 hover:border-yellow-400/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,51,0.3)] hover:scale-105"
          >
            {/* 카드 배경 효과 */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* 카드 내용 */}
            <div className="relative z-10">
              {/* 아이콘 영역 */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-[#1a1a1a] rounded-full flex items-center justify-center border-2 border-red-600/60 group-hover:border-yellow-400/80 transition-colors duration-300">
                  <img
                    src="/images/egogift/egogift_frame.webp"
                    alt="에고기프트"
                    className="w-16 h-16 object-contain"
                  />
                </div>
              </div>

              {/* 제목 */}
              <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 text-center mb-4 group-hover:text-yellow-400 transition-colors">
                에고기프트
              </h2>

              {/* 설명 */}
              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                다양한 에고기프트를 검색하고 조합식을 확인할 수 있습니다.
              </p>

              {/* 화살표 아이콘 */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-yellow-400/20 group-hover:bg-yellow-400/40 flex items-center justify-center transition-all duration-300 group-hover:translate-x-2">
                  <svg 
                    className="w-6 h-6 text-yellow-300 group-hover:text-yellow-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* 이벤트선택지 카드 */}
          <Link 
            href="/event"
            className="group relative overflow-hidden bg-[#131316] border-2 border-red-600/60 rounded-lg p-8 hover:border-yellow-400/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,51,0.3)] hover:scale-105"
          >
            {/* 카드 배경 효과 */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* 카드 내용 */}
            <div className="relative z-10">
              {/* 아이콘 영역 */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-[#1a1a1a] rounded-full flex items-center justify-center border-2 border-red-600/60 group-hover:border-yellow-400/80 transition-colors duration-300">
                  <svg 
                    className="w-16 h-16 text-red-400 group-hover:text-yellow-400 transition-colors" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                  </svg>
                </div>
              </div>

              {/* 제목 */}
              <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 text-center mb-4 group-hover:text-yellow-400 transition-colors">
                이벤트선택지
              </h2>

              {/* 설명 */}
              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                던전 이벤트와 선택지를 검색하고 확인할 수 있습니다.
              </p>

              {/* 화살표 아이콘 */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-yellow-400/20 group-hover:bg-yellow-400/40 flex items-center justify-center transition-all duration-300 group-hover:translate-x-2">
                  <svg 
                    className="w-6 h-6 text-yellow-300 group-hover:text-yellow-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* 카드팩 카드 */}
          <Link 
            href="/cardpack"
            className="group relative overflow-hidden bg-[#131316] border-2 border-red-600/60 rounded-lg p-8 hover:border-yellow-400/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,51,0.3)] hover:scale-105"
          >
            {/* 카드 배경 효과 */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            {/* 카드 내용 */}
            <div className="relative z-10">
              {/* 아이콘 영역 */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-[#1a1a1a] rounded-full flex items-center justify-center border-2 border-red-600/60 group-hover:border-yellow-400/80 transition-colors duration-300">
                  <svg 
                    className="w-16 h-16 text-red-400 group-hover:text-yellow-400 transition-colors" 
                    viewBox="0 0 64 64" 
                    fill="none"
                  >
                    {/* 왼쪽 카드 (뒤) - 약간 왼쪽으로 기울어짐 */}
                    <g transform="translate(32,32) rotate(-15) translate(-32,-32)">
                      <rect 
                        x="8" 
                        y="10" 
                        width="20" 
                        height="28" 
                        rx="2" 
                        fill="currentColor" 
                        opacity="0.5"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </g>
                    {/* 가운데 카드 - 중심 */}
                    <rect 
                      x="22" 
                      y="8" 
                      width="20" 
                      height="28" 
                      rx="2" 
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    {/* 오른쪽 카드 (앞) - 약간 오른쪽으로 기울어짐 */}
                    <g transform="translate(32,32) rotate(15) translate(-32,-32)">
                      <rect 
                        x="36" 
                        y="10" 
                        width="20" 
                        height="28" 
                        rx="2" 
                        fill="currentColor" 
                        opacity="0.7"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </g>
                  </svg>
                </div>
              </div>

              {/* 제목 */}
              <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 text-center mb-4 group-hover:text-yellow-400 transition-colors">
                카드팩
              </h2>

              {/* 설명 */}
              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                던전 카드팩을 검색하고 출현 에고기프트를 확인할 수 있습니다.
              </p>

              {/* 화살표 아이콘 */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-yellow-400/20 group-hover:bg-yellow-400/40 flex items-center justify-center transition-all duration-300 group-hover:translate-x-2">
                  <svg 
                    className="w-6 h-6 text-yellow-300 group-hover:text-yellow-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* 던전 보고서 카드 */}
          <Link
            href="/favorites"
            className="group relative overflow-hidden bg-[#131316] border-2 border-amber-600/60 rounded-lg p-8 hover:border-yellow-400/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,51,0.3)] hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-[#1a1a1a] rounded-full flex items-center justify-center border-2 border-amber-600/60 group-hover:border-yellow-400/80 transition-colors duration-300">
                  <svg
                    className="w-16 h-16 text-amber-400 group-hover:text-yellow-400 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-yellow-300 text-center mb-4 group-hover:text-yellow-400 transition-colors">
                던전 보고서
              </h2>
              <p className="text-gray-300 text-center mb-6 leading-relaxed">
                저장한 던전 보고서 목록을 확인할 수 있습니다.
              </p>
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-yellow-400/20 group-hover:bg-yellow-400/40 flex items-center justify-center transition-all duration-300 group-hover:translate-x-2">
                  <svg
                    className="w-6 h-6 text-yellow-300 group-hover:text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

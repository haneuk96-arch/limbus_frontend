"use client";

import { useState } from "react";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";

export default function PrivacyPage() {
  const [language, setLanguage] = useState<"ko" | "en">("ko");
  
  return (
    <div 
      className="min-h-screen text-white relative"
      style={{
        backgroundImage: "url('/Yihongyuan_Yard_BG.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed"
      }}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 z-0"></div>
      
      {/* 컨텐츠 영역 */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* 타이틀 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-yellow-300 mb-4 drop-shadow-[0_0_10px_rgba(255,204,51,0.5)]">
              {language === "ko" ? "개인정보처리방침" : "Privacy Policy"}
            </h1>
            <p className="text-lg text-gray-300 mb-6">
              {language === "ko" ? "Privacy Policy" : "개인정보처리방침"}
            </p>
            
            {/* 언어 전환 탭 */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setLanguage("ko")}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  language === "ko"
                    ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/50"
                    : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                  language === "en"
                    ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/50"
                    : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* 내용 영역 */}
          <div className="bg-[#131316] border border-[#b8860b]/40 rounded-lg p-6 md:p-8 lg:p-10">
            <PrivacyPolicyContent 
              language={language} 
              showLanguageToggle={false}
              onLanguageChange={setLanguage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


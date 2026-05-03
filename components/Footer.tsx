"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import PrivacyPolicyContent from "./PrivacyPolicyContent";

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [language, setLanguage] = useState<"ko" | "en">("ko");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isModalOpen]);

  return (
    <>
      <footer className="bg-[#131316] border-t border-red-600 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-gray-400 text-sm">
              <div>© 2025 단테의 달의기억 (Fan Project).</div>
              <div className="text-xs mt-1">
                본 사이트는 Project Moon의 공식 서비스가 아니며, 모든 게임 에셋의 저작권은 Project Moon에 있습니다.
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <a
                href="https://baslimbus.info/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-yellow-300 transition-colors"
              >
                단테의 빵과 수프
              </a>
              <span className="text-red-700">|</span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="hover:text-yellow-300 transition-colors cursor-pointer"
              >
                Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Policy 모달 */}
      {isMounted && isModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-policy-modal-title"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-[#131316] border border-[#b8860b]/60 rounded-lg max-w-4xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto relative">
              <div className="sticky top-0 bg-[#131316] border-b border-[#b8860b]/40 px-4 sm:px-6 py-4 z-50 flex justify-between items-center backdrop-blur-sm">
                <div>
                  <h2 id="privacy-policy-modal-title" className="text-lg sm:text-xl font-bold text-yellow-300">
                    {language === "ko" ? "개인정보처리방침" : "Privacy Policy"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white text-3xl leading-none font-bold"
                  title="닫기"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <PrivacyPolicyContent 
                  language={language} 
                  showLanguageToggle={true}
                  onLanguageChange={setLanguage}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}


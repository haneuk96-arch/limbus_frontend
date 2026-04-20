"use client";

import Link from "next/link";
import { useMemo } from "react";

export default function LoginPage() {
  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api",
    []
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-[#b8860b]/30 bg-[#0f0f10]/95 shadow-[0_0_30px_rgba(184,134,11,0.12)] p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-3xl sm:text-4xl font-bold text-yellow-300">로그인</div>
          <p className="text-sm sm:text-base text-gray-400 mt-2">
            로그인 전 이용약관 및 개인정보 처리 안내를 확인해주세요.
          </p>
        </div>

        <div className="space-y-3">
          <details className="rounded-lg border border-[#b8860b]/25 bg-[#141417] overflow-hidden" open>
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-yellow-200">
              이용약관
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-300 leading-7">
              <p>본 서비스는 비공식 팬 프로젝트이며, 상업적 목적이 아닌 개인 용도로 제공됩니다.</p>
              <p>부적절한 콘텐츠 등록 시 운영 정책에 따라 이용이 제한될 수 있습니다.</p>
            </div>
          </details>

          <details className="rounded-lg border border-[#b8860b]/25 bg-[#141417] overflow-hidden" open>
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-yellow-200">
              개인정보 처리 안내
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-300 leading-7">
              <p>Google OAuth 로그인 시 계정 구분을 위한 고유 사용자 식별자(providerUserId)가 처리될 수 있습니다.</p>
              <p>해당 식별자는 로그인 인증, 닉네임/게시판 기능 운영 목적의 최소 범위 내에서만 사용됩니다.</p>
              <p>자세한 내용은 사이트 하단 Policy를 참고해주세요.</p>
            </div>
          </details>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          로그인 시 위 내용에 동의한 것으로 간주됩니다.
        </p>

        <a
          href={`${apiBaseUrl}/auth/google/login`}
          className="mt-5 w-full h-12 rounded-lg border border-[#b8860b]/45 hover:border-[#b8860b]/80 bg-[#1b1b1f] hover:bg-[#232329] transition-colors inline-flex items-center justify-center gap-2 text-yellow-200 font-semibold"
        >
          <img src="/google_login.png" alt="" className="h-5 w-5 object-contain" />
          Google로 계속하기
        </a>

        <div className="text-center mt-5">
          <Link href="/" className="text-sm text-gray-400 hover:text-yellow-200 transition-colors">
            ← 로그인 없이 둘러보기
          </Link>
        </div>
      </div>
    </div>
  );
}


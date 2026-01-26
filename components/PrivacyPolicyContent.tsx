"use client";

interface PrivacyPolicyContentProps {
  language: "ko" | "en";
  showLanguageToggle?: boolean;
  onLanguageChange?: (lang: "ko" | "en") => void;
}

export default function PrivacyPolicyContent({ 
  language, 
  showLanguageToggle = false,
  onLanguageChange 
}: PrivacyPolicyContentProps) {
  return (
    <div className="prose prose-invert max-w-none">
      <div className="text-gray-200 leading-relaxed space-y-6">
        {showLanguageToggle && onLanguageChange && (
          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => onLanguageChange("ko")}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                language === "ko"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/50"
                  : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
              }`}
            >
              한국어
            </button>
            <button
              onClick={() => onLanguageChange("en")}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                language === "en"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/50"
                  : "bg-[#2a2a2d] text-gray-300 hover:bg-[#3a3a3d]"
              }`}
            >
              English
            </button>
          </div>
        )}

        {language === "ko" ? (
          <>
            <p className="text-gray-400 text-sm mb-8">
              시행일자: 2025년 12월 14일
            </p>
          
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                1. 개요
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  limbus.haneuk.info(이하 "본 사이트")는 개인이 운영하는 비공식 Limbus Company 팬사이트입니다.
                </p>
                <p>
                  본 사이트는 방문자의 개인정보 보호를 중요하게 생각하며, 본 방침은 사이트 이용 과정에서 수집될 수 있는 정보와 그 이용 목적을 설명합니다.
                </p>
                <p>
                  본 사이트를 이용함으로써 본 개인정보처리방침에 동의한 것으로 간주됩니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                2. 수집하는 정보
              </h2>
              <div className="text-gray-300 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-yellow-200 mb-2">2.1. 개인정보</h3>
                  <p>
                    본 사이트는 회원가입, 댓글, 게시판, 입력 폼 등의 기능을 제공하지 않으며,
                    이름, 이메일 주소 등 개인을 직접 식별할 수 있는 정보를 의도적으로 수집하거나 저장하지 않습니다.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-yellow-200 mb-2">2.2. 자동으로 수집되는 정보</h3>
                  <p className="mb-2">
                    본 사이트는 서비스 운영, 통계 분석 및 광고 제공을 위해 다음과 같은 정보가 자동으로 수집될 수 있습니다.
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>IP 주소 (익명화 처리됨)</li>
                    <li>브라우저 종류 및 버전</li>
                    <li>운영체제</li>
                    <li>방문 페이지 및 접속 시간</li>
                    <li>유입 경로(Referrer)</li>
                    <li>쿠키 및 온라인 식별자</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                3. Google Analytics 사용
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  본 사이트는 사이트 이용 현황 분석 및 서비스 개선을 위해 Google Analytics(GA4)를 사용합니다.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google Analytics는 쿠키 및 유사 기술을 사용하여 방문 정보를 수집합니다.</li>
                  <li>IP 주소는 익명화 처리되어 개인을 직접 식별할 수 없습니다.</li>
                  <li>수집된 정보는 통계 분석 목적으로만 사용됩니다.</li>
                </ul>
                <p>
                  Google의 개인정보 처리 방식에 대한 자세한 내용은 아래 링크를 참고하시기 바랍니다.
                </p>
                <p>
                  <a 
                    href="https://policies.google.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-400 underline break-all"
                  >
                    https://policies.google.com/privacy
                  </a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                4. Google AdSense 사용
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  본 사이트는 Google AdSense를 통해 광고를 게재할 수 있습니다.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 사용자의 이전 방문 기록을 기반으로 광고를 제공합니다.</li>
                  <li>Google의 DoubleClick 쿠키를 통해 사용자에게 보다 관련성 높은 광고가 제공될 수 있습니다.</li>
                  <li>광고 제공 및 성과 측정을 위해 온라인 식별자, 쿠키, IP 기반 정보가 사용될 수 있습니다.</li>
                </ul>
                <p>
                  사용자는 Google 광고 설정 페이지를 통해 맞춤형 광고를 비활성화할 수 있습니다.
                </p>
                <p>
                  <a 
                    href="https://adssettings.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-400 underline break-all"
                  >
                    https://adssettings.google.com/
                  </a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                5. 쿠키(Cookie)
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  본 사이트는 다음의 목적을 위해 쿠키를 사용할 수 있습니다.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>사이트 트래픽 분석</li>
                  <li>서비스 품질 개선</li>
                  <li>광고 제공 및 광고 성과 측정</li>
                </ul>
                <p>
                  사용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                6. 제3자 제공
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  본 사이트는 다음과 같은 외부 서비스 제공자와 제한된 정보를 공유할 수 있습니다.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google LLC (Google Analytics, Google AdSense)</li>
                </ul>
                <p>
                  이 과정에서 정보는 대한민국 외 지역(미국 등)으로 이전될 수 있으며,
                  해당 정보는 각 서비스 제공자의 개인정보처리방침에 따라 관리됩니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                7. 아동의 개인정보 보호
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  본 사이트는 만 13세 미만 아동을 대상으로 하지 않으며,
                  아동의 개인정보를 의도적으로 수집하지 않습니다.
                </p>
                <p>
                  만 13세 미만 아동의 개인정보가 수집되었다고 판단될 경우,
                  아래 연락처로 문의 주시면 지체 없이 조치하겠습니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                8. 개인정보처리방침 변경
              </h2>
              <p className="text-gray-300">
                본 방침은 관련 법령 또는 사이트 운영 방식 변경에 따라 수정될 수 있으며,
                변경 사항은 본 페이지를 통해 공지됩니다.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                9. 문의처
              </h2>
              <div className="text-gray-300 space-y-2">
                <p>
                  개인정보처리방침 관련 문의는 아래 이메일로 연락주시기 바랍니다.
                </p>
                <p>
                  이메일: <a 
                    href="mailto:haneuk96@gmail.com" 
                    className="text-yellow-300 hover:text-yellow-400 underline"
                  >
                    haneuk96@gmail.com
                  </a>
                </p>
              </div>
            </section>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-8">
              Effective Date: December 14, 2025
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                1. Introduction
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  limbus.haneuk.info (the "Site") is a non-commercial, unofficial fan site for the game "Limbus Company," operated by an individual.
                </p>
                <p>
                  This Privacy Policy explains how information may be collected and used when you access and use the Site.
                </p>
                <p>
                  By using the Site, you agree to this Privacy Policy.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                2. Information We Collect
              </h2>
              <div className="text-gray-300 space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-yellow-200 mb-2">2.1. Personal Information</h3>
                  <p>
                    The Site does not provide user registration, comment systems, message boards, or input forms.
                    Accordingly, the Site does not intentionally collect or store personally identifiable information such as names or email addresses.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-yellow-200 mb-2">2.2. Automatically Collected Information</h3>
                  <p className="mb-2">
                    When you visit the Site, certain information may be collected automatically for operational, analytical, and advertising purposes, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>IP address (processed in anonymized form)</li>
                    <li>Browser type and version</li>
                    <li>Operating system</li>
                    <li>Pages visited and access time</li>
                    <li>Referring URLs</li>
                    <li>Cookies and online identifiers</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                3. Use of Google Analytics
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  The Site uses Google Analytics (GA4) to analyze traffic and improve site performance.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google Analytics uses cookies and similar technologies to collect usage data.</li>
                  <li>IP addresses are anonymized and are not used to directly identify individuals.</li>
                  <li>Collected data is used solely for statistical purposes.</li>
                </ul>
                <p>
                  For more information on how Google processes data, please visit:
                </p>
                <p>
                  <a 
                    href="https://policies.google.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-400 underline break-all"
                  >
                    https://policies.google.com/privacy
                  </a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                4. Use of Google AdSense
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  The Site may display advertisements through Google AdSense.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google and third-party vendors use cookies to serve ads based on users' prior visits to this and other websites.</li>
                  <li>Google's DoubleClick cookie may be used to show ads that are more relevant to users.</li>
                  <li>Online identifiers, cookies, and IP-based information may be used for ad delivery and measurement.</li>
                </ul>
                <p>
                  Users may manage or disable personalized advertising via Google Ads Settings:
                </p>
                <p>
                  <a 
                    href="https://adssettings.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-400 underline break-all"
                  >
                    https://adssettings.google.com/
                  </a>
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                5. Cookies
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  Cookies may be used for the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Traffic analysis</li>
                  <li>Site performance improvement</li>
                  <li>Advertising and ad performance measurement</li>
                </ul>
                <p>
                  Users can refuse or delete cookies through browser settings.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                6. Third-Party Disclosure
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  The Site may share limited information with third-party service providers, including:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Google LLC (Google Analytics, Google AdSense)</li>
                </ul>
                <p>
                  Information processed by these services may be transferred to and stored in countries outside the user's residence, including the United States.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                7. Children's Information
              </h2>
              <div className="text-gray-300 space-y-3">
                <p>
                  The Site is not intended for children under the age of 13 and does not knowingly collect personal information from children under 13.
                </p>
                <p>
                  If you believe that personal information from a child under 13 has been collected through the Site, please contact us and appropriate action will be taken.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                8. Changes to This Privacy Policy
              </h2>
              <p className="text-gray-300">
                This Privacy Policy may be updated from time to time.
                Any changes will be posted on this page and will become effective upon publication.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-yellow-300 border-b border-[#b8860b]/40 pb-2">
                9. Contact
              </h2>
              <div className="text-gray-300 space-y-2">
                <p>
                  If you have any questions regarding this Privacy Policy, please contact:
                </p>
                <p>
                  Email: <a 
                    href="mailto:haneuk96@gmail.com" 
                    className="text-yellow-300 hover:text-yellow-400 underline"
                  >
                    haneuk96@gmail.com
                  </a>
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


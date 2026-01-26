"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  
  // 관리자 페이지(/dante/*)에서는 푸터를 표시하지 않음
  // pathname이 없거나 아직 로드되지 않은 경우 null 반환 (깜빡임 방지)
  if (!pathname || pathname.startsWith("/dante")) {
    return null;
  }
  
  return <Footer />;
}


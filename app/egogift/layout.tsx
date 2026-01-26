import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "에고기프트 | 단테의 달의기억",
  description: "Limbus Company 에고기프트 목록 및 상세 정보를 확인할 수 있습니다.",
  openGraph: {
    title: "에고기프트 | 단테의 달의기억",
    description: "Limbus Company 에고기프트 목록 및 상세 정보를 확인할 수 있습니다.",
    type: "website",
  },
};

export default function EgoGiftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


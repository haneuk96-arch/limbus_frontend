import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "카드팩 | 단테의 달의기억",
  description: "Limbus Company 카드팩 목록 및 상세 정보를 확인할 수 있습니다.",
  openGraph: {
    title: "카드팩 | 단테의 달의기억",
    description: "Limbus Company 카드팩 목록 및 상세 정보를 확인할 수 있습니다.",
    type: "website",
  },
};

export default function CardPackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


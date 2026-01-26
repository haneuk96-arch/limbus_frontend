import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "던전 이벤트 | 단테의 달의기억",
  description: "Limbus Company 던전 이벤트 및 선택지 정보를 확인할 수 있습니다.",
  openGraph: {
    title: "던전 이벤트 | 단테의 달의기억",
    description: "Limbus Company 던전 이벤트 및 선택지 정보를 확인할 수 있습니다.",
    type: "website",
  },
};

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "던전 보고서 | 단테의 달의기억",
  description: "저장한 던전 보고서 목록을 확인할 수 있습니다.",
  openGraph: {
    title: "던전 보고서 | 단테의 달의기억",
    description: "저장한 던전 보고서 목록을 확인할 수 있습니다.",
    type: "website",
  },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

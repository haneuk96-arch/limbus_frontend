import { API_BASE_URL } from "@/lib/api";

export interface UserPersonalityEgoListItem {
  egoId: number;
  order: number;
  title: string;
  libraryGrade: string;
  wrathCost: number;
  lustCost: number;
  slothCost: number;
  gluttonyCost: number;
  gloomCost: number;
  prideCost: number;
  envyCost: number;
  image?: { path: string } | null;
}

interface ListResponse {
  items: UserPersonalityEgoListItem[];
}

export async function fetchUserPersonalityEgoList(order: number): Promise<UserPersonalityEgoListItem[]> {
  const res = await fetch(`${API_BASE_URL}/user/personality-ego/list?order=${order}&page=1&size=200`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("에고 목록을 불러오지 못했습니다.");
  const data: ListResponse = await res.json();
  return data.items ?? [];
}


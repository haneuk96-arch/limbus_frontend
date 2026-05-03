import { API_BASE_URL } from "@/lib/api";

export interface UserPersonalityListItem {
  personalityId: number;
  order: number;
  name: string;
  grade: number;
  keywords: string[];
  skillAttributes?: string[];
  skillAttackTypes?: string[];
  skillCount: number;
  beforeSyncImage?: { path: string } | null;
  afterSyncImage?: { path: string } | null;
}

interface ListResponse {
  items: UserPersonalityListItem[];
}

export async function fetchUserPersonalityList(order: number): Promise<UserPersonalityListItem[]> {
  const res = await fetch(`${API_BASE_URL}/user/personality/list?order=${order}&page=1&size=200`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("인격 목록을 불러오지 못했습니다.");
  const data: ListResponse = await res.json();
  return data.items ?? [];
}

import { API_BASE_URL } from "@/lib/api";

export interface PersonalitySkillInput {
  skillId?: number;
  name: string;
  attribute: string;
  attackType: string;
}

export interface PersonalityListItem {
  personalityId: number;
  order: number;
  name: string;
  grade: number;
  keywords: string[];
  skillCount: number;
  beforeSyncImage?: { path: string } | null;
  afterSyncImage?: { path: string } | null;
}

export interface PersonalityDetail {
  personalityId: number;
  order: number;
  name: string;
  grade: number;
  keywords: string[];
  skills: Array<{
    skillId: number;
    name: string;
    attribute: string;
    attackType: string;
  }>;
  beforeSyncImage?: { path: string } | null;
  afterSyncImage?: { path: string } | null;
}

interface ListResponse {
  items: PersonalityListItem[];
}

export async function fetchPersonalityList(order: number): Promise<PersonalityListItem[]> {
  const res = await fetch(`${API_BASE_URL}/admin/personality/list?order=${order}&page=1&size=200`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("목록 조회에 실패했습니다.");
  const data: ListResponse = await res.json();
  return data.items ?? [];
}

export async function fetchPersonalityDetail(personalityId: number): Promise<PersonalityDetail> {
  const res = await fetch(`${API_BASE_URL}/admin/personality/${personalityId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("상세 조회에 실패했습니다.");
  return await res.json();
}

async function submitFormData(
  url: string,
  method: "POST" | "PUT",
  data: {
    order: number;
    name: string;
    grade: number;
    keywords: string[];
    skills: PersonalitySkillInput[];
  },
  beforeSyncImage?: File | null,
  afterSyncImage?: File | null
) {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
  if (beforeSyncImage) formData.append("beforeSyncImage", beforeSyncImage);
  if (afterSyncImage) formData.append("afterSyncImage", afterSyncImage);

  const res = await fetch(url, {
    method,
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error("저장에 실패했습니다.");
  return await res.json();
}

export async function createPersonality(
  data: { order: number; name: string; grade: number; keywords: string[]; skills: PersonalitySkillInput[] },
  beforeSyncImage: File | null,
  afterSyncImage: File | null
) {
  return submitFormData(`${API_BASE_URL}/admin/personality`, "POST", data, beforeSyncImage, afterSyncImage);
}

export async function updatePersonality(
  personalityId: number,
  data: { order: number; name: string; grade: number; keywords: string[]; skills: PersonalitySkillInput[] },
  beforeSyncImage?: File | null,
  afterSyncImage?: File | null
) {
  return submitFormData(
    `${API_BASE_URL}/admin/personality/${personalityId}`,
    "PUT",
    data,
    beforeSyncImage ?? null,
    afterSyncImage ?? null
  );
}

export async function deletePersonality(personalityId: number) {
  const res = await fetch(`${API_BASE_URL}/admin/personality/${personalityId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("삭제에 실패했습니다.");
}


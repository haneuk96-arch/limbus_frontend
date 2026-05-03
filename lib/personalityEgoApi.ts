import { API_BASE_URL } from "@/lib/api";

export interface PersonalityEgoUpsertPayload {
  order: number;
  title: string;
  wrathCost: number;
  lustCost: number;
  slothCost: number;
  gluttonyCost: number;
  gloomCost: number;
  prideCost: number;
  envyCost: number;
  libraryGrade: string;
  sinAttribute: string;
  attackType: string;
}

export interface PersonalityEgoListItem {
  egoId: number;
  order: number;
  title: string;
  wrathCost: number;
  lustCost: number;
  slothCost: number;
  gluttonyCost: number;
  gloomCost: number;
  prideCost: number;
  envyCost: number;
  libraryGrade: string;
  sinAttribute: string;
  attackType: string;
  image?: { path: string } | null;
}

export interface PersonalityEgoDetail extends PersonalityEgoListItem {}

interface ListResponse {
  items: PersonalityEgoListItem[];
}

export async function fetchPersonalityEgoList(order: number): Promise<PersonalityEgoListItem[]> {
  const res = await fetch(`${API_BASE_URL}/admin/personality-ego/list?order=${order}&page=1&size=200`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("목록 조회에 실패했습니다.");
  const data: ListResponse = await res.json();
  return data.items ?? [];
}

export async function fetchPersonalityEgoDetail(egoId: number): Promise<PersonalityEgoDetail> {
  const res = await fetch(`${API_BASE_URL}/admin/personality-ego/${egoId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("상세 조회에 실패했습니다.");
  return await res.json();
}

async function submitFormData(url: string, method: "POST" | "PUT", data: PersonalityEgoUpsertPayload, image?: File | null) {
  const formData = new FormData();
  formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
  if (image) formData.append("image", image);

  const res = await fetch(url, {
    method,
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error("저장에 실패했습니다.");
  return await res.json();
}

export async function createPersonalityEgo(data: PersonalityEgoUpsertPayload, image: File | null) {
  return submitFormData(`${API_BASE_URL}/admin/personality-ego`, "POST", data, image ?? undefined);
}

export async function updatePersonalityEgo(egoId: number, data: PersonalityEgoUpsertPayload, image?: File | null) {
  return submitFormData(`${API_BASE_URL}/admin/personality-ego/${egoId}`, "PUT", data, image ?? undefined);
}

export async function deletePersonalityEgo(egoId: number) {
  const res = await fetch(`${API_BASE_URL}/admin/personality-ego/${egoId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("삭제에 실패했습니다.");
}

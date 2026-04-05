/**
 * 에고기프트 등급(티어) 표시용.
 * DB/API에서 gift_tier 가 "0" 또는 0 인 경우는 "등급 없음"으로 취급 (범용 등에서 흔함).
 */
export function formatEgoGiftTierDisplay(tier: unknown): string {
  if (tier == null) return "－";
  const s = String(tier).trim();
  if (s === "" || s === "0" || s === "00") return "－";
  const n = Number(s);
  if (!Number.isNaN(n) && n === 0) return "－";
  const u = s.toUpperCase();
  if (u === "EX") return "EX";
  if (s === "1") return "Ⅰ";
  if (s === "2") return "Ⅱ";
  if (s === "3") return "Ⅲ";
  if (s === "4") return "Ⅳ";
  if (s === "5") return "Ⅴ";
  return "－";
}

/** 목록/저장용: API 값을 문자열 티어로 정규화 (0·빈값 → "") */
export function normalizeGiftTierFromApi(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (s === "" || s === "0" || s === "00") return "";
  const n = Number(s);
  if (!Number.isNaN(n) && n === 0) return "";
  return s;
}

/** DB/API: CURSE=저주, BLESS=축복, 미선택은 null */
export type EgoGiftCurseBlessCd = "CURSE" | "BLESS";

export function normalizeCurseBlessCd(raw: unknown): EgoGiftCurseBlessCd | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toUpperCase();
  if (s === "CURSE") return "CURSE";
  if (s === "BLESS") return "BLESS";
  return null;
}

/** 폼 상태 → API 전송값 (미선택은 null) */
export function curseBlessToApi(curseBlessCd: "" | EgoGiftCurseBlessCd): EgoGiftCurseBlessCd | null {
  return curseBlessCd === "" ? null : curseBlessCd;
}

/**
 * 에고기프트 조회 응답에서 저주/축복 코드 추출 (camelCase / snake_case 모두 대응)
 */
export function readCurseBlessFromResponse(eg: Record<string, unknown> | null | undefined): EgoGiftCurseBlessCd | null {
  if (!eg || typeof eg !== "object") return null;
  return normalizeCurseBlessCd(eg.curseBlessCd ?? eg.curse_bless_cd);
}

/**
 * multipart JSON `data`에 넣을 필드 (Jackson snake_case / camelCase 바인딩 호환)
 */
export function curseBlessFieldsForMultipartJson(curseBlessCd: "" | EgoGiftCurseBlessCd): {
  curseBlessCd: EgoGiftCurseBlessCd | null;
  curse_bless_cd: EgoGiftCurseBlessCd | null;
} {
  const v = curseBlessToApi(curseBlessCd);
  return { curseBlessCd: v, curse_bless_cd: v };
}

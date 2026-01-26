// 해시태그 카테고리 코드 (고정값)
export const HASHTAG_CATEGORIES = [
  { code: "CORE_KEYWORD", name: "키워드" },
  { code: "SUB_KEYWORD", name: "추가 키워드" },
  { code: "POWER_MOD_UP", name: "합위력 (증가)" },
  { code: "POWER_MOD_DOWN", name: "합위력 (감소)" },
  { code: "BASE_DAMAGE", name: "피해량" },
  { code: "BONUS_DAMAGE", name: "추가 피해" },
  { code: "UTILITY_EFFECT", name: "유틸" },
  { code: "FORMATION_EFFECT", name: "편성순서 효과적용" },
  { code: "FACTION", name: "소속" },
  { code: "ETC", name: "기타" },
] as const;

export type HashtagCategoryCode = typeof HASHTAG_CATEGORIES[number]["code"];

export const getCategoryName = (code: string | undefined | null): string => {
  if (!code) return "-";
  const category = HASHTAG_CATEGORIES.find((cat) => cat.code === code);
  return category ? category.name : code;
};


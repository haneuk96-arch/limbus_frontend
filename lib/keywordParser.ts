/**
 * 키워드 파싱 및 렌더링 유틸리티
 * 
 * 입력 형식: [[키워드명]] (예: [[화상]], [[출혈]])
 * 렌더링: 아이콘 + 텍스트 + 툴팁
 */

export interface KeywordData {
  keywordId: number;
  keywordName: string;
  keywordDesc?: string;
  iconPath?: string;
  color?: string;
}

export interface TextSegment {
  type: 'text' | 'keyword';
  content: string;
  keywordData?: KeywordData;
}

/**
 * 텍스트에서 [[키워드명]] 형식의 키워드를 찾아서 파싱
 * @param text 입력 텍스트
 * @param keywords 키워드 데이터 배열
 * @returns 파싱된 텍스트 세그먼트 배열
 */
export function parseKeywords(text: string, keywords: KeywordData[]): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  // [[키워드명]] 형식의 정규식 (이중 대괄호)
  const keywordPattern = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = keywordPattern.exec(text)) !== null) {
    // 키워드 이전의 일반 텍스트
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // 키워드 이름 추출
    const keywordName = match[1];
    const keywordData = keywords.find((k) => k.keywordName === keywordName);

    if (keywordData) {
      segments.push({
        type: 'keyword',
        content: keywordName,
        keywordData,
      });
    } else {
      // 매칭되는 키워드가 없으면 일반 텍스트로 처리
      segments.push({
        type: 'text',
        content: match[0], // [키워드명] 전체
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // 마지막 키워드 이후의 일반 텍스트
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  // 키워드가 하나도 없으면 전체를 일반 텍스트로
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text,
    });
  }

  return segments;
}

/**
 * 키워드 아이콘 경로 매핑
 */
export const keywordIconMap: Record<string, string> = {
  화상: "/images/keyword/Burn.webp",
  출혈: "/images/keyword/Bleed.webp",
  진동: "/images/keyword/Tremor.webp",
  파열: "/images/keyword/Rupture.webp",
  침잠: "/images/keyword/Sinking.webp",
  호흡: "/images/keyword/Poise.webp",
  충전: "/images/keyword/Charge.webp",
  참격: "/images/keyword/slash.webp",
  관통: "/images/keyword/penetration.webp",
  타격: "/images/keyword/blow.webp",
};

/**
 * 키워드 색상 매핑
 */
export const keywordColorMap: Record<string, string> = {
  /** 순서: 빨강 → 주황 → 노랑 → 초록 → 하늘 → 남색 → 보라 */
  화상: "text-red-400",
  출혈: "text-orange-400",
  진동: "text-yellow-400",
  파열: "text-green-400",
  침잠: "text-sky-400",
  호흡: "text-blue-600",
  충전: "text-purple-400",
  참격: "text-cyan-400",
  관통: "text-pink-400",
  타격: "text-yellow-300",
};

/**
 * 키워드 데이터에 아이콘 경로와 색상 추가
 */
export function enrichKeywordData(keyword: {
  keywordId: number;
  keywordName: string;
  keywordDesc?: string;
  files?: Array<{ path: string }>;
}): KeywordData {
  const iconPath = keyword.files && keyword.files.length > 0
    ? keyword.files[0].path
    : keywordIconMap[keyword.keywordName] || null;

  return {
    keywordId: keyword.keywordId,
    keywordName: keyword.keywordName,
    keywordDesc: keyword.keywordDesc,
    iconPath: iconPath || undefined,
    color: keywordColorMap[keyword.keywordName] || "text-yellow-400",
  };
}


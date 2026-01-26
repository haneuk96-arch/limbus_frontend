"use client";

import { useState, useRef, useEffect } from "react";
import { parseKeywords, TextSegment, KeywordData } from "@/lib/keywordParser";
import { API_BASE_URL } from "@/lib/api";

interface EgoGiftData {
  egogiftId: number;
  giftName: string;
  giftTier?: string;
  desc1?: string;
  desc2?: string;
  desc3?: string;
  thumbnailPath?: string;
}

interface KeywordHighlightProps {
  text: string;
  keywords: KeywordData[];
  egogifts?: EgoGiftData[];
  onEgoGiftClick?: (giftName: string) => void;
}

/**
 * 키워드 하이라이팅 컴포넌트 (공통 컴포넌트)
 * [[키워드명]] 형식을 아이콘+텍스트로 변환하고, 마우스오버 시 설명 표시
 * {변경내용} 형식으로 감싼 부분을 노란색으로 표시
 */
export default function KeywordHighlight({ text, keywords, egogifts = [], onEgoGiftClick }: KeywordHighlightProps) {
  const [hoveredKeywordId, setHoveredKeywordId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const keywordRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const segments = parseKeywords(text, keywords);
  
  useEffect(() => {
    if (hoveredKeywordId) {
      const element = keywordRefs.current.get(hoveredKeywordId);
      if (element) {
        const rect = element.getBoundingClientRect();
        const tooltipWidth = 256; // w-64 = 16rem = 256px
        const tooltipHeight = 150; // 예상 높이
        const padding = 16; // 화면 경계 여백
        
        let left = rect.left + rect.width / 2;
        let top = rect.top - 8; // 키워드 위에 표시
        
        // 화면 경계 체크 및 위치 조정
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
        
        // 좌우 경계 체크 (키워드 위에 표시하되, 좌우만 조정)
        if (left - tooltipWidth / 2 < padding) {
          left = padding + tooltipWidth / 2;
        } else if (left + tooltipWidth / 2 > viewportWidth - padding) {
          left = viewportWidth - padding - tooltipWidth / 2;
        }
        
        // 상하 경계 체크 (우선적으로 키워드 위에 표시)
        if (top - tooltipHeight < padding) {
          // 위쪽 공간이 부족하면 아래쪽에 표시
          top = rect.bottom + 8;
        }
        
        setTooltipPosition({
          top: top,
          left: left,
        });
      }
    } else {
      setTooltipPosition(null);
    }
  }, [hoveredKeywordId]);

  // 아이콘 URL 생성 (API 경로 처리)
  const getIconUrl = (iconPath?: string) => {
    if (!iconPath) return null;
    // 이미 전체 URL인 경우
    if (iconPath.startsWith("http")) return iconPath;
    
    // 백엔드 서버의 베이스 URL 추출
    // 개발: http://localhost:8080
    // 운영: https://limbus.haneuk.info (같은 도메인 사용 시)
    const baseUrl = API_BASE_URL.replace("/api", "");
    
    // /uploads 또는 /로 시작하는 경로는 백엔드 서버 URL과 결합
    if (iconPath.startsWith("/")) {
      return `${baseUrl}${iconPath}`;
    }
    
    // 그 외의 경우도 백엔드 서버 URL과 결합
    return `${baseUrl}/${iconPath}`;
  };

  // ((에고기프트명)) 형식으로 감싼 부분을 파싱하는 함수
  const parseEgoGiftMarkers = (text: string): Array<{ text: string; egogiftData?: EgoGiftData }> => {
    const parts: Array<{ text: string; egogiftData?: EgoGiftData }> = [];
    // ((에고기프트명)) 형식의 정규식
    const egogiftPattern = /\(\(([^)]+)\)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = egogiftPattern.exec(text)) !== null) {
      // 에고기프트 표시 이전의 일반 텍스트
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
        });
      }

      // 에고기프트 이름 추출
      const giftName = match[1];
      const egogiftData = egogifts.find((e) => e.giftName === giftName);

      if (egogiftData) {
        parts.push({
          text: giftName,
          egogiftData: egogiftData,
        });
      } else {
        // 매칭되는 에고기프트가 없으면 일반 텍스트로 처리
        parts.push({
          text: match[0], // ((에고기프트명)) 전체
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // 마지막 에고기프트 표시 이후의 일반 텍스트
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
      });
    }

    // 매칭이 없으면 전체를 일반 텍스트로
    if (parts.length === 0) {
      parts.push({
        text: text,
      });
    }

    return parts;
  };

  // {color:text} 또는 {text} 형식으로 감싼 부분을 파싱하는 함수
  const parseEnhancementMarkers = (text: string): Array<{ text: string; color?: string }> => {
    const parts: Array<{ text: string; color?: string }> = [];
    // {color:text} 또는 {text} 형식의 정규식
    const enhancementPattern = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = enhancementPattern.exec(text)) !== null) {
      // 강화 표시 이전의 일반 텍스트
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
        });
      }

      // 강화 표시 내용 파싱
      const content = match[1];
      // color:text 형식인지 확인
      const colorMatch = content.match(/^([a-z]+):(.+)$/);
      
      if (colorMatch) {
        // {color:text} 형식
        const color = colorMatch[1];
        const text = colorMatch[2];
        parts.push({
          text: text,
          color: color,
        });
      } else {
        // {text} 형식 (기본 노란색)
        parts.push({
          text: content,
          color: "yellow", // 기본값
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // 마지막 강화 표시 이후의 일반 텍스트
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
      });
    }

    // 매칭이 없으면 전체를 일반 텍스트로
    if (parts.length === 0) {
      parts.push({
        text: text,
      });
    }

    return parts;
  };

  // 색상별 Tailwind CSS 클래스 매핑
  const getColorClass = (color?: string): string => {
    if (!color) return "";
    const colorMap: Record<string, string> = {
      red: "text-red-400",
      orange: "text-orange-400",
      yellow: "text-yellow-400",
      green: "text-green-400",
      blue: "text-blue-400",
      indigo: "text-indigo-400",
      purple: "text-purple-400",
      violet: "text-violet-400",
    };
    return colorMap[color.toLowerCase()] || "text-yellow-400";
  };

  return (
    <span className="inline">
      {segments.map((segment, index) => {
        if (segment.type === "keyword") {
          // 키워드 세그먼트
          const keyword = segment.keywordData!;
          const iconUrl = getIconUrl(keyword.iconPath);
          const uniqueId = `keyword-${index}-${keyword.keywordId}`;

          return (
            <>
              <span
                key={uniqueId}
                ref={(el) => {
                  if (el) {
                    keywordRefs.current.set(uniqueId, el);
                  } else {
                    keywordRefs.current.delete(uniqueId);
                  }
                }}
                className="relative inline-flex items-center gap-1 group"
                onMouseEnter={() => setHoveredKeywordId(uniqueId)}
                onMouseLeave={() => setHoveredKeywordId(null)}
              >
                <span className="inline-flex items-baseline gap-0.5 text-yellow-500 font-medium cursor-help">
                  {iconUrl && (
                    <img
                      src={iconUrl}
                      alt={keyword.keywordName}
                      className="w-3 h-3 object-contain align-middle"
                      style={{ verticalAlign: 'middle' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span>{keyword.keywordName}</span>
                </span>
              </span>
              {hoveredKeywordId === uniqueId && keyword.keywordDesc && tooltipPosition && (() => {
                const element = keywordRefs.current.get(uniqueId);
                const rect = element?.getBoundingClientRect();
                const padding = 16;
                const tooltipWidth = 256;
                const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
                const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
                
                // 키워드 위에 표시할지 아래에 표시할지 결정 (위쪽 공간이 부족하면 아래)
                const isAbove = rect && (rect.top - 8) > 150;
                
                // 좌우 경계 체크
                let adjustedLeft = tooltipPosition.left;
                if (adjustedLeft - tooltipWidth / 2 < padding) {
                  adjustedLeft = padding + tooltipWidth / 2;
                } else if (adjustedLeft + tooltipWidth / 2 > viewportWidth - padding) {
                  adjustedLeft = viewportWidth - padding - tooltipWidth / 2;
                }
                
                // 키워드의 실제 중앙 위치 계산
                const keywordCenterX = rect ? rect.left + rect.width / 2 : adjustedLeft;
                // 말풍선과 키워드의 위치 차이
                const arrowOffset = keywordCenterX - adjustedLeft;
                
                return (
                  <div 
                    className="fixed z-[10000] w-64 max-w-[calc(100vw-32px)] p-3 bg-[#1a1a1a] border border-[#b8860b]/60 rounded-lg shadow-xl pointer-events-none"
                    style={{
                      top: isAbove ? `${tooltipPosition.top}px` : `${rect ? rect.bottom + 8 : tooltipPosition.top}px`,
                      left: `${adjustedLeft}px`,
                      transform: isAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
                    }}
                  >
                    <div className="text-xs font-semibold text-[#ffcc33] mb-1">
                      {keyword.keywordName}
                    </div>
                    <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {keyword.keywordDesc}
                    </div>
                    {isAbove && (
                      <div 
                        className="absolute top-full -mt-1"
                        style={{
                          left: `calc(50% + ${arrowOffset}px)`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-[#b8860b]/60 rotate-45"></div>
                      </div>
                    )}
                    {!isAbove && (
                      <div 
                        className="absolute bottom-full -mb-1"
                        style={{
                          left: `calc(50% + ${arrowOffset}px)`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <div className="w-2 h-2 bg-[#1a1a1a] border-l border-t border-[#b8860b]/60 rotate-45"></div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          );
        } else {
          // 일반 텍스트 세그먼트 - ((에고기프트명)) 및 {변경내용} 형식 파싱
          // 먼저 에고기프트 파싱
          const egogiftParts = parseEgoGiftMarkers(segment.content);
          
          return (
            <span key={`text-${index}`}>
              {egogiftParts.map((egogiftPart, egogiftIdx) => {
                if (egogiftPart.egogiftData) {
                  // 에고기프트 세그먼트
                  const egogift = egogiftPart.egogiftData;
                  const uniqueId = `egogift-${index}-${egogiftIdx}-${egogift.egogiftId}`;
                  const thumbnailUrl = egogift.thumbnailPath 
                    ? getIconUrl(egogift.thumbnailPath)
                    : null;

                  return (
                    <span
                      key={uniqueId}
                      className="inline-flex items-center gap-1"
                    >
                      <span 
                        className="inline-flex items-baseline gap-0.5 text-yellow-400 font-bold cursor-pointer hover:text-yellow-300"
                        style={{ fontSize: 'calc(1em + 1px)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEgoGiftClick) {
                            onEgoGiftClick(egogift.giftName);
                          }
                        }}
                      >
                        {thumbnailUrl && (
                          <img
                            src={thumbnailUrl}
                            alt={egogift.giftName}
                            className="w-4 h-4 object-contain align-middle"
                            style={{ verticalAlign: 'middle' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span>{egogift.giftName}</span>
                      </span>
                    </span>
                  );
                } else {
                  // 일반 텍스트 - {변경내용} 형식 파싱
                  const enhancementParts = parseEnhancementMarkers(egogiftPart.text);
                  
                  return (
                    <span key={egogiftIdx}>
                      {enhancementParts.map((part, idx) =>
                        part.color ? (
                          <span key={idx} className={`${getColorClass(part.color)} font-semibold`}>
                            {part.text}
                          </span>
                        ) : (
                          <span key={idx}>{part.text}</span>
                        )
                      )}
                    </span>
                  );
                }
              })}
            </span>
          );
        }
      })}
    </span>
  );
}


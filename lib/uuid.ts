const UUID_STORAGE_KEY = "limbus_user_uuid";

/**
 * 로컬스토리지에서 UUID를 가져오거나, 없으면 새로 생성하여 저장
 */
export function getOrCreateUUID(): string {
  if (typeof window === "undefined") {
    // SSR 환경에서는 임시 UUID 반환
    return "";
  }

  try {
    let uuid = localStorage.getItem(UUID_STORAGE_KEY);
    
    if (!uuid) {
      // UUID v4 생성
      uuid = generateUUID();
      localStorage.setItem(UUID_STORAGE_KEY, uuid);
    }
    
    return uuid;
  } catch (error) {
    console.error("UUID 관리 오류:", error);
    // 오류 발생 시 임시 UUID 반환
    return generateUUID();
  }
}

/**
 * UUID v4 생성
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * UUID 가져오기 (없으면 null 반환)
 */
export function getUUID(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(UUID_STORAGE_KEY);
  } catch (error) {
    console.error("UUID 조회 오류:", error);
    return null;
  }
}

/**
 * UUID 삭제
 */
export function removeUUID(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(UUID_STORAGE_KEY);
  } catch (error) {
    console.error("UUID 삭제 오류:", error);
  }
}


const STORAGE_KEY = "mimo_nickname";

function hashCode(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getNickname(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setNickname(nickname: string): void {
  localStorage.setItem(STORAGE_KEY, nickname.trim());
}

export function getUserId(): number | null {
  const nickname = getNickname();
  if (!nickname) return null;
  return hashCode(nickname);
}

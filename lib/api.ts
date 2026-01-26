import axios from "axios";

// API 베이스 URL 상수 (환경변수가 없을 때 fallback)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

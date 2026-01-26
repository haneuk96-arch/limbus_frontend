"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/login`,
        { adminId, adminPw },
        { withCredentials: true }
      );

      // 백엔드 응답 아래 기준이라고 가정
      // { success: true }
      if (res.data?.success === true) {
        router.push("/dante/dashboard");
        return;
      }

      setError("로그인에 실패했습니다.");
    } catch (err: any) {
      setError("로그인에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] p-4">
      <div className="w-full max-w-[420px] px-6 sm:px-8 py-8 sm:py-10 bg-[#131316] border border-red-700 rounded shadow-lg">

        <h1 className="text-center text-3xl font-bold text-yellow-300 mb-8 tracking-wide">
          Limbus Admin
        </h1>

        {error && (
          <div className="text-red-400 text-sm mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-6">

          {/* Admin ID */}
          <div>
            <label className="text-yellow-300 text-sm">Admin ID</label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-yellow-300 text-sm">Password</label>
            <input
              type="password"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[#1c1c1f] text-white border border-red-700 rounded focus:outline-none focus:border-yellow-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded transition-colors"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}

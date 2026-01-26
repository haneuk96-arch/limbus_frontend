import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 정적 파일을 상대 경로로 서빙 (모든 IP/도메인에서 작동)
  // assetPrefix를 설정하지 않으면 기본적으로 상대 경로 사용
  // output: 'standalone', // 필요시 활성화
};

export default nextConfig;

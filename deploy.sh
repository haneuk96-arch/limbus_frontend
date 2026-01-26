#!/bin/bash

# Limbus Frontend 배포 스크립트
# 사용법: ./deploy.sh

set -e

echo "=== Limbus Frontend 배포 시작 ==="

# 1. 환경 변수 확인
if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then
    echo "경고: NEXT_PUBLIC_API_BASE_URL 환경 변수가 설정되지 않았습니다."
    echo "기본값(http://localhost:8080/api)을 사용합니다."
fi

# 2. 의존성 설치
echo "1. 의존성 설치 중..."
npm install

# 3. 프로덕션 빌드
echo "2. 프로덕션 빌드 중..."
npm run build

# 4. 빌드 결과 확인
if [ ! -d ".next" ]; then
    echo "오류: 빌드가 실패했습니다."
    exit 1
fi

echo "3. 빌드 완료"
echo "빌드 크기:"
du -sh .next

# 5. 배포 전 확인
read -p "배포를 계속하시겠습니까? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "배포가 취소되었습니다."
    exit 1
fi

echo "=== 배포 준비 완료 ==="
echo "다음 단계:"
echo "1. .next 디렉토리를 서버로 복사"
echo "2. 서버에서 다음 명령어로 실행:"
echo "   npm start"
echo "   또는"
echo "   pm2 start npm --name 'limbus-frontend' -- start"


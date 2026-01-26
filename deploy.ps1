# Limbus Frontend 배포 스크립트 (PowerShell)
# 사용법: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Limbus Frontend 배포 시작 ===" -ForegroundColor Green

# 1. 환경 변수 확인
if (-not $env:NEXT_PUBLIC_API_BASE_URL) {
    Write-Host "경고: NEXT_PUBLIC_API_BASE_URL 환경 변수가 설정되지 않았습니다." -ForegroundColor Yellow
    Write-Host "기본값(http://localhost:8080/api)을 사용합니다." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "환경 변수를 설정하려면:" -ForegroundColor Cyan
    Write-Host '  $env:NEXT_PUBLIC_API_BASE_URL="https://api.limbus.haneuk.info/api"' -ForegroundColor Cyan
    Write-Host ""
}

# 2. 의존성 설치
Write-Host "1. 의존성 설치 중..." -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "오류: npm install이 실패했습니다." -ForegroundColor Red
    exit 1
}

# 3. 프로덕션 빌드
Write-Host "2. 프로덕션 빌드 중..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "오류: 빌드가 실패했습니다." -ForegroundColor Red
    exit 1
}

# 4. 빌드 결과 확인
if (-not (Test-Path ".next")) {
    Write-Host "오류: 빌드가 실패했습니다." -ForegroundColor Red
    exit 1
}

Write-Host "3. 빌드 완료" -ForegroundColor Green
Write-Host "빌드 크기:" -ForegroundColor Cyan
$size = (Get-ChildItem .next -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  $([math]::Round($size, 2)) MB" -ForegroundColor Cyan

# 5. 배포 전 확인
$response = Read-Host "배포를 계속하시겠습니까? (y/n)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "배포가 취소되었습니다." -ForegroundColor Yellow
    exit 0
}

Write-Host "=== 배포 준비 완료 ===" -ForegroundColor Green
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "1. .next 디렉토리를 서버로 복사"
Write-Host "2. 서버에서 다음 명령어로 실행:"
Write-Host "   npm start"
Write-Host "   또는"
Write-Host "   pm2 start npm --name 'limbus-frontend' -- start"


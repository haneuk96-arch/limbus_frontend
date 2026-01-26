# 프론트엔드 CSS 문제 해결 가이드

## 문제: 특정 IP에서만 CSS가 적용되지 않음

### 원인 분석

특정 IP(61.98.181.159)에서는 정상 작동하지만 다른 IP에서는 CSS가 적용되지 않는 경우, 다음과 같은 원인이 있을 수 있습니다:

1. **프록시/리버스 프록시 설정 문제**
   - Nginx나 Apache가 특정 IP에서만 정적 파일을 제대로 서빙하지 않음
   - 프록시 설정이 IP별로 다르게 구성됨

2. **정적 파일 경로 문제**
   - Next.js가 정적 파일을 절대 경로로 참조하는 경우
   - `assetPrefix` 설정이 잘못된 경우

3. **방화벽/보안 설정**
   - 특정 IP에서만 정적 파일 접근이 차단됨
   - CORS 설정 문제

### 해결 방법

#### 1. 브라우저 개발자 도구 확인

다른 IP에서 접속 시 브라우저 개발자 도구(F12)를 열고:

1. **Network 탭**에서 CSS 파일 요청 확인
   - `/_next/static/css/...` 경로의 파일들이 로드되는지 확인
   - 404, 403, 또는 CORS 오류가 있는지 확인

2. **Console 탭**에서 오류 메시지 확인
   - 정적 파일 로드 실패 관련 오류 확인

#### 2. Next.js 설정 확인

`next.config.ts`에서 `assetPrefix`가 설정되어 있지 않은지 확인:

```typescript
// ❌ 잘못된 설정 (절대 경로 사용)
const nextConfig = {
  assetPrefix: 'https://limbus.haneuk.info', // 이렇게 설정하면 안 됨
};

// ✅ 올바른 설정 (상대 경로 사용 - 기본값)
const nextConfig = {
  reactCompiler: true,
  // assetPrefix를 설정하지 않으면 상대 경로 사용
};
```

#### 3. 서버 프록시 설정 확인

가비아 서버에서 Nginx나 Apache 설정을 확인:

**Nginx 예시:**
```nginx
server {
    listen 80;
    server_name limbus.haneuk.info;

    # 모든 IP에서 정적 파일 접근 허용
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
        # IP 제한이 있는지 확인
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**확인 사항:**
- `allow`/`deny` 지시어로 IP 제한이 있는지 확인
- 방화벽 설정에서 특정 IP만 허용하는지 확인

#### 4. Next.js 서버 직접 접근 테스트

프록시를 거치지 않고 Next.js 서버에 직접 접근:

```bash
# 서버에서 Next.js가 실행 중인 포트 확인 (기본: 3000)
curl http://localhost:3000/_next/static/css/app/layout.css

# 또는 브라우저에서 직접 접근
http://서버IP:3000
```

이렇게 접근했을 때 CSS가 정상 작동한다면, 프록시 설정 문제입니다.

#### 5. 빌드 재생성

문제가 계속되면 빌드를 다시 생성:

```bash
cd frontend
rm -rf .next
npm run build
```

그리고 서버에 다시 배포:

```bash
# .next 디렉토리 전체를 다시 업로드
scp -r .next user@server:/path/to/frontend/
```

#### 6. 서버 로그 확인

서버에서 Next.js와 프록시 로그 확인:

```bash
# Next.js 로그 (PM2 사용 시)
pm2 logs limbus-frontend

# Nginx 로그
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 빠른 해결책

1. **서버에서 Next.js 재시작**
   ```bash
   pm2 restart limbus-frontend
   ```

2. **프록시 재시작**
   ```bash
   sudo systemctl restart nginx
   # 또는
   sudo service nginx restart
   ```

3. **브라우저 캐시 삭제**
   - Ctrl + Shift + Delete (Windows/Linux)
   - Cmd + Shift + Delete (Mac)
   - 또는 시크릿 모드로 테스트

## 문제: 폰트 파일 404 오류 (`/_next/static/media/...`)

### 원인

Next.js의 `next/font/google`는 빌드 시 폰트 파일을 다운로드하여 `.next/static/media/` 디렉토리에 저장합니다.
이 파일들이 서버에 제대로 업로드되지 않았을 가능성이 높습니다.

### 해결 방법

#### 1. 로컬 빌드 확인

로컬에서 빌드 후 폰트 파일이 생성되었는지 확인:

```bash
cd frontend
npm run build

# 폰트 파일 확인
ls -la .next/static/media/
```

#### 2. 서버에 전체 `.next` 디렉토리 업로드

**중요**: `.next` 디렉토리 전체를 업로드해야 합니다:

```bash
# 올바른 방법: 전체 디렉토리 업로드
scp -r .next user@server:/path/to/frontend/

# 잘못된 방법: 일부만 업로드하면 폰트 파일이 누락됨
# scp -r .next/standalone user@server:/path/to/frontend/  # ❌
```

#### 3. 서버에서 파일 확인

서버에 접속하여 폰트 파일이 있는지 확인:

```bash
ssh user@server
cd /path/to/frontend
ls -la .next/static/media/
```

파일이 없다면 다시 업로드:

```bash
# 로컬에서
scp -r .next/static/media user@server:/path/to/frontend/.next/static/
```

#### 4. Nginx 설정 확인

Nginx에서 `/_next/static` 경로가 제대로 프록시되는지 확인:

```nginx
location /_next/static {
    proxy_pass http://localhost:3000;
    proxy_cache_valid 200 60m;
    add_header Cache-Control "public, immutable";
    # media 폴더도 포함됨
}
```

#### 5. Next.js 재시작

파일 업로드 후 Next.js 재시작:

```bash
pm2 restart limbus-frontend
# 또는
pm2 reload limbus-frontend
```

#### 6. 대안: 폰트 최적화 비활성화 (임시)

폰트 파일 문제가 계속되면, 임시로 시스템 폰트 사용:

```typescript
// layout.tsx에서 폰트 import 제거하고 시스템 폰트 사용
// const geistSans = Geist({ ... }); // 주석 처리
```

하지만 이는 권장하지 않으며, 정상적인 배포가 목표입니다.

### 추가 확인 사항

- **도메인 vs IP 접근**: `https://limbus.haneuk.info`로 접근할 때와 IP로 직접 접근할 때 차이가 있는지 확인
- **HTTPS 설정**: SSL 인증서가 특정 IP에서만 작동하는지 확인
- **CDN 사용 여부**: CDN을 사용하는 경우, CDN 설정 확인


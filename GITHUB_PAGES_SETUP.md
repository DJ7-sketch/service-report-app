# GitHub Pages 배포 방법

이 폴더는 GitHub Pages에 바로 배포할 수 있는 정적 웹앱입니다.

## 중요한 제한

GitHub Pages는 정적 파일만 호스팅합니다. 따라서 `server.js`는 GitHub Pages에서 실행되지 않습니다.

- GitHub Pages 배포: 여러 직원이 같은 URL로 웹앱 접속 가능
- 공용 리포트 DB: `server.js`를 Render/Railway/사내 서버에서 실행하고 `config.js`에 API 주소를 넣어야 함
- API 서버가 없으면 각 직원 브라우저의 localStorage fallback으로 동작함

## 공용 DB와 비밀번호 로그인을 쓰려면

1. `server.js`를 Render, Railway, 사내 서버, NAS, VPS 중 하나에 배포합니다.
2. 배포된 API 주소를 확인합니다. 예: `https://service-report-api.onrender.com`
3. GitHub repository의 `config.js`를 다음처럼 수정합니다.

```js
window.SERVICE_REPORT_API_BASE = "https://service-report-api.onrender.com";
```

4. GitHub Pages가 다시 배포되면 홈페이지 로그인과 공용 리포트 누적이 활성화됩니다.

### Render 배포 예시

1. Render.com에서 `New` > `Web Service` 선택
2. GitHub의 `service-report-app` repository 연결
3. Runtime은 `Node`
4. Build Command는 비워둠
5. Start Command는 `node server.js`
6. Environment Variables에 아래 비밀번호를 설정
7. 배포 후 나온 URL을 `config.js`의 `SERVICE_REPORT_API_BASE`에 입력

주의: Render 무료 플랜은 재시작 시 파일 저장소가 유지되지 않을 수 있습니다. 운영에서는 Render Disk, Railway Volume, Supabase, Firebase, PostgreSQL 등 영구 저장소를 사용하세요.

기본 비밀번호는 아래와 같습니다. 운영 전에 서버 환경변수로 꼭 변경하세요.

| User | Default password | Environment variable |
| --- | --- | --- |
| Donghyeok Jung | `DJ2026!` | `PASSWORD_DONGHYEOK` |
| Sangmin Lee | `SL2026!` | `PASSWORD_SANGMIN` |
| Minhyuk Lee | `ML2026!` | `PASSWORD_MINHYUK` |
| Service Manager | `admin2026!` | `PASSWORD_ADMIN` |

선택 환경변수:

```text
PORT=4173
CORS_ORIGIN=https://DJ7-sketch.github.io
PASSWORD_DONGHYEOK=원하는비밀번호
PASSWORD_SANGMIN=원하는비밀번호
PASSWORD_MINHYUK=원하는비밀번호
PASSWORD_ADMIN=원하는비밀번호
```

## GitHub 웹사이트에서 직접 배포

1. GitHub에서 새 repository를 만듭니다.
2. 이 `service-report-app` 폴더 안의 파일을 repository 루트에 업로드합니다.
3. repository의 `Settings` > `Pages`로 이동합니다.
4. `Build and deployment`에서 `GitHub Actions`를 선택합니다.
5. `Actions` 탭에서 `Deploy GitHub Pages` workflow가 성공할 때까지 기다립니다.
6. 배포 URL은 `https://계정명.github.io/저장소명/` 형식입니다.

## Git 명령으로 배포

PC에 Git이 설치되어 있다면:

```bash
cd service-report-app
git init
git add .
git commit -m "Deploy service report app"
git branch -M main
git remote add origin https://github.com/계정명/저장소명.git
git push -u origin main
```

그 다음 GitHub repository의 `Settings` > `Pages`에서 `GitHub Actions`를 선택합니다.

## 사내 직원들이 같은 데이터를 공유해야 하는 경우

GitHub Pages만으로는 공용 DB가 되지 않습니다. 다음 중 하나를 사용해야 합니다.

- 사내 PC/서버에서 `node server.js` 실행 후 `http://서버IP:4173/` 공유
- Supabase 또는 Firebase 연결
- 회사 내부 API 서버와 DB 연결

현재 포함된 `server.js`는 사내 MVP용 JSON 파일 DB 서버입니다.

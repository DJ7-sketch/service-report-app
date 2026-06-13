# GitHub Pages 배포 방법

이 폴더는 GitHub Pages에 바로 배포할 수 있는 정적 웹앱입니다.

## 중요한 제한

GitHub Pages는 정적 파일만 호스팅합니다. 따라서 `server.js`는 GitHub Pages에서 실행되지 않습니다.

- GitHub Pages 배포: 여러 직원이 같은 URL로 웹앱 접속 가능
- 데이터 저장: 각 직원 브라우저의 localStorage에 저장
- 공용 리포트 DB: `server.js`를 사내 서버에서 실행하거나 Supabase/Firebase/API 서버가 필요

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

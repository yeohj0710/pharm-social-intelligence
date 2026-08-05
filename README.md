# Pharm Social Intelligence

약사·메디컬 Instagram 공개 데이터를 팀 업무용으로 탐색하는 정적 대시보드입니다.

## 포함 데이터

- 계정 레이더: 329개
- 콘텐츠 원장: 92개
- 포맷 카드: 60개
- 주제 카드: 84개

데이터는 `public/data/`의 CSV를 정적 자산으로 읽습니다. 계정과 콘텐츠의 상세 화면에서 공개 Instagram 페이지로 이동할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

## 데이터 갱신

원장 CSV를 `public/data/`에 덮어쓴 뒤 다시 배포합니다.

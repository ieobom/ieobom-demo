# 이어봄 데모

공모전 시연용 데모 웹. 39차 UI 시안 확정판(10/29)에서 시작한다.
같은 웹을 아이패드(사파리)에서 열고, Capacitor로 감싸 안드로이드 APK로도 만든다.

## 구조

- `index.html` — 데모 앱 (시안 번들에서 시작)
- `api/stt.js` — 말 → 글. 브라우저에서 녹음한 소리를 OpenAI 음성 인식으로 보낸다
- `api/ai.js` — 글 만들기. 근황 → 물어볼 이야기(`newsAsk`), 받아쓴 통화 → 통화 메모 초안(`callDraft`), 메모 → 다음 통화 이야기(`memoAsks`)
- `api/_lib.js` — 공통 (요청 막기 · 호출 횟수 제한 · OpenAI 호출)

AI나 인터넷이 안 되면 앱은 정해 둔 문장으로 넘어간다.

## 환경 변수 (Vercel)

- `OPENAI_API_KEY` — 필수. Vercel 프로젝트 설정에서 넣는다. 코드와 저장소에는 두지 않는다.
- `OPENAI_TEXT_MODEL` — 선택. 글 만들기 모델 (없으면 `gpt-4o-mini`)
- `OPENAI_STT_MODEL` — 선택. 음성 인식 모델 (없으면 `gpt-4o-mini-transcribe`)

데모 주소는 누구나 열 수 있으니 OpenAI 대시보드에서 이 키의 사용 한도도 걸어 둔다.

## 배포

Vercel에서 이 저장소를 가져오면 `main`에 푸시할 때마다 다시 배포된다.

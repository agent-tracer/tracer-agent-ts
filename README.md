# tracer-agent-ts

에이전트 서비스의 TypeScript 구현이다. Claude Agent SDK로 대화와 작업을 실행하고, 접수와
취소와 스트림을 제공하는 API와 큐를 소비하는 워커로 이루어진다.

계약 저장소가 정한 HTTP 표면과 스키마와 큐를 만족한다. 같은 계약을 만족하는 Python 구현이
따로 있고, 배포에서 어느 이미지를 올리느냐로 둘 중 하나가 선택된다.

실행에 필요한 기록은 추적 API를 HTTP로 읽고, 산출물도 같은 경로로 되돌려 보낸다.

`MONITOR_PROFILE=local`로 API와 chat/jobs/generate 워커를 실행하면 사용자별 Anthropic API key 없이
사용자의 로컬 Claude CLI 인증으로 Claude Agent SDK를 실행한다. `prd` 프로파일은 설정 API의
암호화된 Anthropic API key를 사용한다. 이 로컬 CLI 인증 경로는 TypeScript 구현에만 해당하며
Python 구현은 API key/envelope 경로를 사용한다.

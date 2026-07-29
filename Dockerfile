# TypeScript 소스를 @swc-node/register로 그대로 실행하는 이미지이며 산출물을 내지 않는다.
FROM node:24-slim

WORKDIR /app

# 워크스페이스 매니페스트가 먼저 있어야 npm ci가 전체 워크스페이스 의존을 설치한다.
COPY package.json package-lock.json ./
COPY libs/platform/package.json libs/platform/package.json
COPY libs/llm/package.json libs/llm/package.json
COPY libs/tracer-client/package.json libs/tracer-client/package.json
COPY services/agent-api/package.json services/agent-api/package.json
COPY services/agent-worker/package.json services/agent-worker/package.json

RUN npm ci

# 계약은 submodule이라 스키마 로더와 도구 계약이 서려면 빌드 컨텍스트 안에 실제로 있어야 한다.
COPY . .

ENV NODE_ENV=production

# tsconfig 별칭과 데코레이터 해석이 실행 디렉터리를 기준으로 삼으므로 각 진입점의 작업 디렉터리에서 띄운다.
# 이미지 안에서 실행할 명령은 다음 중 하나를 그대로 골라 CMD로 덮어쓴다:
#   cd services/agent-api && node --import @swc-node/register/esm-register src/agent.main.ts
#   cd services/agent-worker && node --import @swc-node/register/esm-register src/chat.main.ts
#   cd services/agent-worker && node --import @swc-node/register/esm-register src/jobs.main.ts
#   cd services/agent-worker && node --import @swc-node/register/esm-register src/generate.main.ts
CMD ["sh", "-c", "cd services/agent-api && exec node --import @swc-node/register/esm-register src/agent.main.ts"]

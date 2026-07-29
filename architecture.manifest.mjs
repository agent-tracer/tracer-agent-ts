// 구조 규칙의 유일한 서술이며 의존 그래프 검사기와 린터와 경로 별칭 생성기가 모두 이것을 읽는다.

/** 워크스페이스 패키지 이름의 접두사. */
export const SCOPE = "@tracer-agent";

/** 슬라이스 안에서 각 계층이 import할 수 있는 계층. */
export const LAYERS = Object.freeze({
  inbound: ["application", "model"],
  application: ["port", "model"],
  port: ["model"],
  adapter: ["port", "model"],
  model: [],
});

/** 기술의 차이를 디렉터리 대신 말하는 파일 접미사이며 의존 그래프 검사기가 이것으로 규칙을 만든다. */
export const ROLES = Object.freeze({
  entrypoint: [".controller.ts", ".consumer.ts", ".workflow.ts", ".activity.ts"],
  queryEntrypoint: [".query.controller.ts"],
  usecase: [".usecase.ts"],
  commandUsecase: [".command.usecase.ts"],
  step: [".projection.ts"],
  workflow: [".workflow.ts"],
  activity: [".activity.ts"],
  port: [".port.ts"],
  adapter: [".adapter.ts"],
});

/** 배포 단위이며 shape가 그 단위에 적용할 규칙 집합을 고르고 importable이 남이 부를 수 있는지를 정한다. */
export const UNITS = Object.freeze([
  { name: "platform", dir: "libs/platform", alias: "~platform", shape: "lib", importable: true },
  { name: "llm", dir: "libs/llm", alias: "~llm", shape: "lib", importable: true },
  { name: "tracer-client", dir: "libs/tracer-client", alias: "~tracer-client", shape: "lib", importable: true },
  { name: "agent-api", dir: "services/agent-api", alias: "~agent-api", shape: "sliced", importable: false },
  { name: "agent-worker", dir: "services/agent-worker", alias: "~agent-worker", shape: "sliced", importable: false },
]);

/** 배포 단위가 사는 최상위 디렉터리이며 경로 규칙의 뿌리다. */
export const ROOTS = Object.freeze(["libs", "services"]);

/** 기술이 새지 않는 경계이며 allow는 경로 조각을, denyLayers는 계층 이름을 받는다. */
export const SEALS = Object.freeze([
  { pkg: "typeorm", denyLayers: ["inbound", "application", "port", "model"] },
  { pkg: "@nestjs", denyLayers: ["model", "port"] },
  { pkg: "@temporalio/worker", allow: ["/config/"] },
  { pkg: "zod", allowFileSuffix: ".schema.ts" },
]);

/** 포트 없이 새어 들어오는 주변이며 layers에 적힌 계층은 이것들을 직접 만지지 못한다. */
export const AMBIENT = Object.freeze({
  layers: ["application"],
  banned: Object.freeze([
    { name: "clock", syntax: "NewExpression[callee.name='Date'][arguments.length=0]" },
    { name: "clock", syntax: "CallExpression[callee.object.name='Date'][callee.property.name='now']" },
    { name: "random", syntax: "CallExpression[callee.object.name='Math'][callee.property.name='random']" },
    { name: "random", syntax: "CallExpression[callee.property.name='randomUUID']" },
    { name: "env", syntax: "MemberExpression[object.name='process'][property.name='env']" },
    { name: "scheduler", syntax: "CallExpression[callee.name=/^(setInterval|setTimeout)$/]" },
  ]),
  message: "포트 뒤에 둔다",
});

/** 운영 로그 이름이 도메인 자리에 쓰지 못하는 서비스 이름. */
export const SERVICE_LOG_DOMAINS = Object.freeze(["agent_api", "agent_worker"]);

/** 소유 포트를 거치지 않고 식별자를 직접 만드는지 보는 단위. */
export const ID_GENERATION_GUARDED = Object.freeze(["agent-api"]);

/** 예산 없이 지키는 상한. */
export const BUDGETS = Object.freeze({
  maxFileLines: 300,
  oversizedFiles: 0,
  untestedUsecases: 0,
  invalidLogNames: 0,
  directIdGeneration: 0,
});

/** shape가 sliced인 배포 단위. */
export const SLICED = Object.freeze(UNITS.filter((unit) => unit.shape === "sliced"));

/** 슬라이스 축을 쓰는 배포 단위. */
export const DOMAIN_UNITS = SLICED;

/** 다른 배포 단위가 import하지 못하는 단위. */
export const ISOLATED = Object.freeze(UNITS.filter((unit) => !unit.importable));

/** 린터와 경로 별칭 생성기가 함께 쓰는 별칭 표. */
export const ALIASES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [unit.alias, `${unit.dir}/src`])),
);

/** 워크스페이스 패키지 이름에서 소스 디렉터리로 가는 표. */
export const PACKAGES = Object.freeze(
  Object.fromEntries(UNITS.map((unit) => [`${SCOPE}/${unit.name}`, `${unit.dir}/src`])),
);

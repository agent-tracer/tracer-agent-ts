import { DOMAIN_UNITS, ISOLATED, LAYERS, ROLES, ROOTS, SEALS, SLICED } from "./architecture.manifest.mjs";

// 규칙의 피연산자는 디렉터리 역할과 파일 접미사뿐이며 슬라이스 이름은 정규식 역참조가 센다.

// 접미사는 매니페스트가 소유하므로 여기서는 정규식으로 옮기기만 한다.
const suffixOf = (role) => ROLES[role].map((suffix) => `${suffix.replaceAll(".", "\\.")}$`).join("|");
const dirsOf = (units) => units.map((unit) => unit.dir).join("|");

const ANY_UNIT = `^(?:${ROOTS.join("|")})/`;
const SLICE = `^(?:${dirsOf(SLICED)})/src/domain`;
const DOMAIN = `^(?:${dirsOf(DOMAIN_UNITS)})/src`;
const SLICED_LAYERS = Object.keys(LAYERS);

// 슬라이스 안의 계층 방향이며 LAYERS의 항목 하나가 규칙 하나가 된다.
const layerRules = Object.entries(LAYERS).map(([layer, allowed]) => {
  const forbidden = SLICED_LAYERS.filter((name) => name !== layer && !allowed.includes(name));
  return {
    name: `layer-${layer}`,
    comment: `${layer}는 ${allowed.join("과 ") || "다른 계층"}만 부른다`,
    severity: "error",
    from: { path: `${SLICE}/[^/]+/${layer}/` },
    to: { path: `${SLICE}/[^/]+/(?:${forbidden.join("|")})/` },
  };
});

// 배포 단위는 서로를 직접 import하지 않고 importable인 라이브러리로만 연결된다.
const isolationRules = ISOLATED.map((unit) => ({
  name: `unit-isolated-${unit.name}`,
  comment: `${unit.name}는 다른 배포 단위가 import하지 않는다`,
  severity: "error",
  from: { path: ANY_UNIT, pathNot: `^${unit.dir}/` },
  to: { path: `^${unit.dir}/` },
}));

// 기술 봉인이며 SEALS의 항목 하나가 규칙 하나가 된다.
const sealRules = SEALS.map((seal) => {
  const to = { path: `node_modules/${seal.pkg}` };
  if (seal.allowFileSuffix) {
    return {
      name: `seal-${seal.pkg}`,
      comment: `${seal.pkg}는 ${seal.allowFileSuffix} 안에만 있는다`,
      severity: "error",
      from: { path: ANY_UNIT, pathNot: `\\${seal.allowFileSuffix}$` },
      to,
    };
  }
  if (seal.allow) {
    return {
      name: `seal-${seal.pkg}`,
      comment: `${seal.pkg}는 ${seal.allow.join(", ")} 밖으로 새지 않는다`,
      severity: "error",
      from: { path: ANY_UNIT, pathNot: seal.allow.join("|") },
      to,
    };
  }
  return {
    name: `seal-${seal.pkg}`,
    comment: `${seal.pkg}는 ${seal.denyLayers.join("과 ")}에 없다`,
    severity: "error",
    from: { path: `/src/domain/[^/]+/(?:${seal.denyLayers.join("|")})/` },
    to,
  };
});

export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      comment: "해석할 수 없는 import는 통과한 것이 아니라 검사되지 않은 것이다",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },

    ...layerRules,

    {
      name: "slice-independent",
      comment: "슬라이스는 형제 슬라이스를 부르지 않는다",
      severity: "error",
      from: { path: `${SLICE}/([^/]+)/` },
      to: { path: `${SLICE}/[^/]+/`, pathNot: `${SLICE}/$1/` },
    },
    {
      name: "domain-not-to-config",
      comment: "도메인은 앱 전역 배선을 모른다. 어댑터만 config를 안다",
      severity: "error",
      from: { path: `${DOMAIN}/domain/[^/]+/(?!adapter/)` },
      to: { path: `${DOMAIN}/config/` },
    },
    {
      name: "config-not-to-domain",
      comment: "config는 앱 전역 기술 기반이다. 도메인을 모른다. 조립 근원만 슬라이스를 안다",
      severity: "error",
      from: { path: `${DOMAIN}/config/` },
      to: { path: `${DOMAIN}/domain/` },
    },
    {
      name: "support-knows-nothing",
      comment: "support는 순수 유틸이다. config와 도메인을 모른다",
      severity: "error",
      from: { path: "/src/support/" },
      to: { path: "/src/(?:config|domain)/" },
    },

    {
      name: "usecase-not-to-usecase",
      comment: "유스케이스는 다른 유스케이스를 부르지 않는다",
      severity: "error",
      from: { path: suffixOf("usecase") },
      to: { path: suffixOf("usecase") },
    },
    {
      name: "query-not-to-command",
      comment: "조회 진입점은 명령 유스케이스를 부르지 않는다",
      severity: "error",
      from: { path: suffixOf("queryEntrypoint") },
      to: { path: suffixOf("commandUsecase") },
    },
    {
      name: "workflow-is-deterministic",
      comment: "워크플로는 활동 구현과 어댑터와 배선을 모른다",
      severity: "error",
      from: { path: suffixOf("workflow") },
      to: { path: `${suffixOf("activity")}|/(?:adapter|config)/` },
    },
    {
      name: "workflow-has-no-node-api",
      comment: "워크플로는 결정적 샌드박스에서 실행되므로 Node 내장 모듈을 부르지 않는다",
      severity: "error",
      from: { path: suffixOf("workflow") },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "inbound-not-to-projection",
      comment: "투영 단계는 진입점이 아니라 유스케이스가 밟는 단계다",
      severity: "error",
      from: { path: `${SLICE}/[^/]+/inbound/` },
      to: { path: suffixOf("step") },
    },

    ...sealRules,
    ...isolationRules,
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    exclude: { path: "\\.test\\.tsx?$|/__fakes__/|/dist/|/build/" },
  },
};

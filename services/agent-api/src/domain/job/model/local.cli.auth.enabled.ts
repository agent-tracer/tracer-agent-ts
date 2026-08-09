export const LOCAL_CLI_AUTH_ENABLED = Symbol("LocalCliAuthEnabled");

/** 이 이미지가 API 키 대신 로그인된 로컬 CLI 자격으로 실행되는지 여부이며 협력자가 아니라 값 하나다. */
export type LocalCliAuthEnabled = boolean;

import { z } from "zod";

/** 계약의 길이 상한은 JSON Schema 의 문자 수이므로 UTF-16 코드 유닛이 아니라 코드포인트로 센다. */
export function codePointLength(value: string): number {
    let count = 0;
    for (const _character of value) count += 1;
    return count;
}

/** 상한을 넘긴 글을 코드포인트 경계에서 잘라 짝 없는 서로게이트를 남기지 않는다. */
export function clampCodePoints(value: string, max: number): string {
    if (codePointLength(value) <= max) return value;
    return [...value].slice(0, max).join("");
}

/** 모델이 상한을 읽을 수 있도록 스키마가 지우는 제약을 설명에 싣는 문장이다. */
export function lengthNotice(max: number): string {
    return `At most ${max} characters.`;
}

export interface BoundedTextOptions {
    readonly min?: number;
    readonly describe?: string;
}

/** 계약이 정한 코드포인트 상한을 갖는 문자열이며 모델이 읽도록 그 상한을 설명에도 싣는다. */
export function boundedText(max: number, options: BoundedTextOptions = {}): z.ZodType<string> {
    const min = options.min ?? 1;
    const notice = lengthNotice(max);
    const description = options.describe === undefined ? notice : `${options.describe} ${notice}`;
    return z
        .string()
        .trim()
        .min(min)
        .describe(description)
        .refine((value) => codePointLength(value) <= max, {
            message: `String must contain at most ${max} character(s)`,
        });
}

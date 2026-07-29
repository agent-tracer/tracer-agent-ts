// 원문 JSON을 파싱하고 실패하면 코드펜스 안의 JSON을 다시 시도한다.
export function parseJsonStrict(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const fenced = /```(?:json)?\s*([\s\S]+?)\s*```/.exec(trimmed);
        if (fenced?.[1] === undefined) return null;
        try {
            return JSON.parse(fenced[1]);
        } catch {
            return null;
        }
    }
}

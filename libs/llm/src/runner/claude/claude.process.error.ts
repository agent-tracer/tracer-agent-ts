import { logWarn } from "@tracer-agent/platform";
import { redactText } from "~llm/support/redaction.js";

/** 진단에 필요한 것은 꼬리이므로 이만큼만 들고 있고 앞쪽은 흘려보낸다. */
const MAX_CHARS = 4000;

/** 하위 Claude 프로세스의 오류 출력을 모아 두었다가 실행이 그 프로세스 탓으로 끝났을 때만 남긴다. */
export class ProcessErrorOutput {
    private buffered = "";

    append(chunk: string): void {
        this.buffered = (this.buffered + chunk).slice(-MAX_CHARS);
    }

    report(label: string, jobId: string | null, errorSubtype: string | null): void {
        const text = this.buffered.trim();
        if (errorSubtype === null || text.length === 0) return;
        logWarn({
            msg: "agent.query.process_stderr",
            label,
            jobId,
            errorSubtype,
            stderr: redactText(text),
        });
    }
}

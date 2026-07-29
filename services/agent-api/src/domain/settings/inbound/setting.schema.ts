import { z } from "zod";
import { SETTING_KEYS } from "~agent-api/domain/settings/model/setting.model.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";

export const settingKeySchema = z.enum(SETTING_KEYS);
export const putSettingBodySchema = z.object({ value: z.string().min(1) });

export type PutSettingBody = z.infer<typeof putSettingBodySchema>;

export const settingKeyPipe = new SchemaValidationPipe(settingKeySchema);
export const putSettingBodyPipe = new SchemaValidationPipe(putSettingBodySchema);

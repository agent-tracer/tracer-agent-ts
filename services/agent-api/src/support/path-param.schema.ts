import { z } from "zod";

export const pathParamSchema = z.string().refine((value) => value.trim().length > 0, {
    message: "Path parameter cannot be blank",
});

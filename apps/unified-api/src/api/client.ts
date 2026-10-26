import { createApi } from "@opusprojects/unified-client";
import type { components, paths } from "./schema";

export { unwrap } from "@opusprojects/unified-client";

export type Schemas = components["schemas"];

export const api = createApi<paths>();

import createClient from "openapi-fetch";
import { session } from "@opusprojects/unified-client";
import type { components, paths } from "./schema";

export { unwrap } from "@opusprojects/unified-client";

export type Schemas = components["schemas"];

// Same origin as the page: in production the binary serves both, and in
// development Vite's proxy (or the demo container's nginx) forwards /api.
export const api = createClient<paths>({ baseUrl: "" });

// CSRF on writes, retried once if the session changed under the page.
api.use(session);

import type { HealthState } from "@opusprojects/unified-client";
import type { Schemas } from "../../api/client";

// How endpoints are judged, shared by their list and their own page so a
// card and the page it opens never disagree.

type Endpoint = Schemas["EndpointInfo"];

// An endpoint answers only when every source it combines has data: one
// missing source makes every call fail (503), not return part of the
// inventory. So there is no "partial" state, only ready or not.
export const ENDPOINT_LABELS = {
  fresh: "Ready",
  failing: "Unavailable",
};

export const endpointState = (endpoint: Endpoint): HealthState =>
  endpoint.sources_missing.length === 0 ? "fresh" : "failing";

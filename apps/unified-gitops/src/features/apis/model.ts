import type { Schemas } from "../../api/client";
import { labelsText } from "../../shared/runs";

type Api = Schemas["ApiSummary"];

// "PUT https://portainer.example": what it sends, where. The API gives the
// scheme and host only: a path or query can carry a secret.
export const callText = (a: Api) => `${a.method} ${a.destination}`;

// What it does besides sending: asks first, creates or updates, deletes.
export function flowWords(a: Api) {
  const words: string[] = [];
  if (a.compare) words.push("Compares first, sends only a difference");
  if (a.upsert) words.push("Creates or updates, as the object exists");
  if (a.deletes) words.push("Deletes when the file is removed");
  return words;
}

export const PER_WORDS: Record<Schemas["Per"], string> = {
  file: "One request per changed file",
  commit: "One request per commit",
};

export const searchText = (a: Api) =>
  `${a.name} ${a.description ?? ""} ${a.project} ${a.method} ${a.destination} ${a.paths.join(" ")} ${labelsText(a.labels).join(" ")}`;

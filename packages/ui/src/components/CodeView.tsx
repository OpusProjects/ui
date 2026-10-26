import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./Page";
import styles from "./CodeView.module.css";

export type Format = "yaml" | "json";

type Kind = "key" | "string" | "number" | "literal" | "punct";

// One run of text and what it is. The view colours each run; the copied text
// is the same runs joined, so what is copied is exactly what is shown.
interface Token {
  text: string;
  kind?: Kind;
}

const PAD = "  ";

function scalarJson(value: unknown): Token {
  if (value === null || typeof value === "boolean")
    return { text: String(value), kind: "literal" };
  if (typeof value === "number") return { text: String(value), kind: "number" };
  return { text: JSON.stringify(value), kind: "string" };
}

function json(value: unknown, depth: number, out: Token[]) {
  const pad = PAD.repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return out.push({ text: "[]", kind: "punct" });
    out.push({ text: "[\n", kind: "punct" });
    value.forEach((item, index) => {
      out.push({ text: pad + PAD });
      json(item, depth + 1, out);
      out.push({
        text: index < value.length - 1 ? ",\n" : "\n",
        kind: "punct",
      });
    });
    return out.push({ text: `${pad}]`, kind: "punct" });
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return out.push({ text: "{}", kind: "punct" });
    out.push({ text: "{\n", kind: "punct" });
    entries.forEach(([key, item], index) => {
      out.push({ text: pad + PAD });
      out.push({ text: JSON.stringify(key), kind: "key" });
      out.push({ text: ": ", kind: "punct" });
      json(item, depth + 1, out);
      out.push({
        text: index < entries.length - 1 ? ",\n" : "\n",
        kind: "punct",
      });
    });
    return out.push({ text: `${pad}}`, kind: "punct" });
  }
  out.push(scalarJson(value));
}

// What PyYAML (YAML 1.1, which Ansible reads) turns into something other
// than a string when it is written plain: its own implicit resolvers, copied
// from resolver.py so the two cannot disagree. A string matching any of them
// is quoted, or "yes", "010", "0b101" or "2024-1-5 10:00:00" would come back
// as a boolean, a number or a date. "y"/"n" and "1e3" are quoted too: not
// PyYAML's, but other YAML readers take them as a boolean and a float.
const RESERVED = /^(true|false|yes|no|on|off|y|n|null|~|=|<<)$/i;
const PYYAML_INT =
  /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
const PYYAML_FLOAT =
  /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const PYYAML_TIMESTAMP =
  /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/;
const OTHER_NUMBERS =
  /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$|^[-+]?0[xob][0-9a-f_]+$|^\d{4}-\d\d?-\d\d?/i;
// Characters YAML will not take as they are: control characters, and the
// line breaks other than \n that it would fold away (NEL, LS, PS), and the
// byte-order mark. A string with any of them is quoted, with them escaped.
const UNPRINTABLE =
  /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]/;

function plainString(text: string) {
  return (
    text !== "" &&
    text.trim() === text &&
    !/[\n\t\r]/.test(text) &&
    !UNPRINTABLE.test(text) &&
    !/^[-?:,[\]{}#&*!|>'"%@`]/.test(text) &&
    !/: |:$| #/.test(text) &&
    !RESERVED.test(text) &&
    !PYYAML_INT.test(text) &&
    !PYYAML_FLOAT.test(text) &&
    !PYYAML_TIMESTAMP.test(text) &&
    !OTHER_NUMBERS.test(text)
  );
}

// Double-quoted, in JSON's spelling (valid YAML, escapes included), plus
// the characters JSON leaves raw but YAML cannot read raw: C1 controls, LS,
// PS and the BOM become \u escapes, which both read the same.
function quoted(text: string) {
  return JSON.stringify(text).replace(
    /[\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function scalarYaml(value: unknown): Token {
  if (typeof value === "string" && plainString(value))
    return { text: value, kind: "string" };
  // JavaScript spells large numbers "1e+21"; PyYAML only reads a float
  // with a dot in it, and would load that back as a string.
  if (
    typeof value === "number" &&
    /e/i.test(String(value)) &&
    !String(value).includes(".")
  )
    return { text: String(value).replace(/e/i, ".0e"), kind: "number" };
  if (typeof value === "string") return { text: quoted(value), kind: "string" };
  return scalarJson(value);
}

const yamlKey = (key: string) =>
  /^[A-Za-z_][\w.-]*$/.test(key) && !RESERVED.test(key) ? key : quoted(key);

// PyYAML takes a key written in place ("key: value") only when it is under
// 1024 characters; a longer one is written as an explicit key ("? key"
// then ": value" on the next line), which has no limit.
const LONG_KEY = 1000;

// A value that takes lines of its own (a non-empty list or mapping), as
// opposed to one that sits after its key on the same line.
const isBlock = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);

function emptyYaml(value: unknown): Token {
  return { text: Array.isArray(value) ? "[]" : "{}", kind: "punct" };
}

// Every line starts with its own indentation token, so a block that opens on
// a list item's "- " line can drop its first one.
function yaml(value: unknown, depth: number, out: Token[]) {
  const pad = PAD.repeat(depth);
  if (Array.isArray(value)) {
    for (const item of value) {
      out.push({ text: pad }, { text: "- ", kind: "punct" });
      if (isBlock(item)) {
        const inner: Token[] = [];
        yaml(item, depth + 1, inner);
        out.push(...inner.slice(1));
      } else {
        out.push(
          typeof item === "object" && item !== null
            ? emptyYaml(item)
            : scalarYaml(item),
          { text: "\n" },
        );
      }
    }
    return;
  }
  for (const [key, item] of Object.entries(value as object)) {
    const keyText = yamlKey(key);
    if (keyText.length > LONG_KEY) {
      out.push(
        { text: pad },
        { text: "? ", kind: "punct" },
        { text: keyText, kind: "key" },
        { text: "\n" },
        { text: pad },
      );
    } else {
      out.push({ text: pad }, { text: keyText, kind: "key" });
    }
    if (isBlock(item)) {
      out.push({ text: ":\n", kind: "punct" });
      yaml(item, depth + 1, out);
    } else {
      out.push(
        { text: ": ", kind: "punct" },
        typeof item === "object" && item !== null
          ? emptyYaml(item)
          : scalarYaml(item),
        { text: "\n" },
      );
    }
  }
}

export function tokens(
  value: Record<string, unknown>,
  format: Format,
): Token[] {
  const out: Token[] = [];
  if (format === "json") {
    json(value, 0, out);
    out.push({ text: "\n" });
  } else if (Object.keys(value).length === 0) {
    out.push({ text: "{}", kind: "punct" }, { text: "\n" });
  } else {
    yaml(value, 0, out);
  }
  return out;
}

export const serialize = (value: Record<string, unknown>, format: Format) =>
  tokens(value, format)
    .map((t) => t.text)
    .join("");

// Read-only and selectable as one block of text. Not a <textarea>: a
// textarea cannot colour its content.
export function CodeView({
  value,
  format,
  label = "Variables",
}: {
  value: Record<string, unknown>;
  format: Format;
  // What the document is, for screen readers: "Variables as YAML".
  label?: string;
}) {
  return (
    <pre
      className={styles.code}
      aria-label={`${label} as ${format.toUpperCase()}`}
    >
      {tokens(value, format).map((token, index) =>
        token.kind ? (
          <span key={index} className={styles[token.kind]}>
            {token.text}
          </span>
        ) : (
          token.text
        ),
      )}
    </pre>
  );
}

// Plain lines in the same box as the document view: a list of names, one
// per line, ready to select or copy as it is.
export function LinesView({
  lines,
  label,
}: {
  lines: string[];
  // What the lines are, for screen readers: "Hosts".
  label: string;
}) {
  return (
    <pre className={styles.code} aria-label={label}>
      {lines.join("\n")}
    </pre>
  );
}

// A choice between a few views of the same thing, side by side, the chosen
// one lit: YAML | JSON, Hosts | Groups.
export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // What is being chosen, for assistive technology: "Format".
  label: string;
  // Shown but not usable where the choice does not apply, so the controls
  // beside it keep their places.
  disabled?: boolean;
}) {
  return (
    <div className={styles.switch} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FormatSwitch({
  value,
  onChange,
  disabled,
}: {
  value: Format;
  onChange: (format: Format) => void;
  disabled?: boolean;
}) {
  return (
    <SegmentedSwitch
      label="Format"
      disabled={disabled}
      value={value}
      onChange={onChange}
      options={[
        { value: "yaml", label: "YAML" },
        { value: "json", label: "JSON" },
      ]}
    />
  );
}

// Copies what the view shows, in the format it shows; says "Copied" for a
// moment in place of its label.
// The clipboard API exists only on secure pages (https, or localhost): on
// a plain-http address it is missing, and it can also refuse. The older way,
// a hidden text box selected and copied, still works there.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused: try the older way below.
  }
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.append(box);
  box.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    box.remove();
  }
}

export function CopyButton({ text }: { text: string | undefined }) {
  // Says how the last copy went, for a moment, in place of its label.
  const [outcome, setOutcome] = useState<"copied" | "failed" | null>(null);
  useEffect(() => {
    if (!outcome) return;
    const timer = window.setTimeout(() => setOutcome(null), 1500);
    return () => window.clearTimeout(timer);
  }, [outcome]);
  return (
    <Button
      icon={outcome === "copied" ? <Check /> : <Copy />}
      disabled={text === undefined}
      // As wide as "Copied" from the start, so the search beside it does not
      // shrink and grow back on every copy.
      style={{ minWidth: 88, justifyContent: "center" }}
      onClick={() => {
        if (text === undefined) return;
        void copyText(text).then((ok) => setOutcome(ok ? "copied" : "failed"));
      }}
    >
      {outcome === "copied"
        ? "Copied"
        : outcome === "failed"
          ? "Copy failed"
          : "Copy"}
    </Button>
  );
}

// The chosen format, remembered in this browser. Storage can be missing or
// refuse (a private window): YAML, the inventory's own language, then.
const FORMAT_KEY = "unified-ui:vars-format";

export function useFormat(): [Format, (format: Format) => void] {
  const [format, setFormat] = useState<Format>(() => {
    try {
      return localStorage.getItem(FORMAT_KEY) === "json" ? "json" : "yaml";
    } catch {
      return "yaml";
    }
  });
  const choose = (next: Format) => {
    setFormat(next);
    try {
      localStorage.setItem(FORMAT_KEY, next);
    } catch {
      // Remembering is a convenience; the choice still applies now.
    }
  };
  return [format, choose];
}

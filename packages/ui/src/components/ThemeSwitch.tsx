import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  chooseTheme,
  storedTheme,
  type Theme,
} from "@opusprojects/unified-client";
import styles from "./ThemeSwitch.module.css";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Same as the system", icon: Monitor },
];

// Three icons side by side, the chosen one filled. What a choice does, and
// where it is remembered, lives with the stored theme in unified-client.
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const choose = (next: Theme) => {
    setTheme(next);
    chooseTheme(next);
  };
  return (
    // Set apart from the links above it by a rule like the one over them:
    // a preference, not a place to go.
    <div className={styles.wrap}>
      <div className={styles.switch} role="group" aria-label="Theme">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
          >
            <Icon aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

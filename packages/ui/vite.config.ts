import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Library mode: one ESM bundle plus one stylesheet. React, the fonts and the
// icons stay external so the consuming app owns (and deduplicates) them.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "unified-ui",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "lucide-react",
        "@tanstack/react-query",
        "@opusprojects/unified-client",
        /^@fontsource\//,
      ],
    },
  },
});

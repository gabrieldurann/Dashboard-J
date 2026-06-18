import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the static build works from any deploy path (idea: showcase link).
export default defineConfig({
  base: "./",
  plugins: [react()],
});

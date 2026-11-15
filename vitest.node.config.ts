import path from "node:path";
import { defineConfig } from "vitest/config";
import packageJson from "./package.json";
import { routedFirstSegmentsPlugin } from "./scripts/vite-routed-segments.ts";
import { themeFixturePlugin } from "./scripts/vite-theme-fixture.ts";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_ID__: JSON.stringify("test"),
    __THEME_NAME__: JSON.stringify("fuwari"),
  },
  // The fixture Theme stays out of the registry here too; tests inject it.
  plugins: [routedFirstSegmentsPlugin(), themeFixturePlugin(false)],
  resolve: {
    tsconfigPaths: true,
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    // A Theme's stylesheet URL names its file (themes.test.ts reads it).
    css: { include: [/\/(features\/theme|tests\/theme-fixture)\/.+\.css/] },
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
  },
});

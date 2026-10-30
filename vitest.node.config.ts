import { defineConfig } from "vitest/config";
import packageJson from "./package.json";
import { routedFirstSegmentsPlugin } from "./scripts/vite-routed-segments.ts";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_ID__: JSON.stringify("test"),
  },
  plugins: [routedFirstSegmentsPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
  },
});

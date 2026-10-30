import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { z } from "zod";
import packageJson from "./package.json";
import { routedFirstSegmentsPlugin } from "./scripts/vite-routed-segments.ts";
import { themeNames, themes } from "./src/features/theme/registry";

const buildEnvSchema = z.object({
  THEME: z.enum(themeNames).catch("default"),
});

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const buildEnv = buildEnvSchema.parse(env);

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      // Unique per build, so cached pages never outlive the assets they name.
      __BUILD_ID__: JSON.stringify(
        process.env.WORKERS_CI_BUILD_UUID || Date.now().toString(36),
      ),
      __THEME_NAME__: JSON.stringify(buildEnv.THEME),
      __THEME_CONFIG__: JSON.stringify(themes[buildEnv.THEME]),
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@theme": path.resolve(
          __dirname,
          `src/features/theme/themes/${buildEnv.THEME}`,
        ),
      },
    },
    plugins: [
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        strategy: ["cookie", "preferredLanguage", "baseLocale"],
        cookieName: "LOCALE",
      }),
      cloudflare({
        viteEnvironment: {
          name: "ssr",
        },
        // Read the Worker from cloudflare.config.ts instead of wrangler.jsonc.
        experimental: { newConfig: true },
      }),
      routedFirstSegmentsPlugin(),
      tailwindcss(),
      devtools(),
      tanstackStart(),
      viteReact(),
    ],
  };
});

export default config;

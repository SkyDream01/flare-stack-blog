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
import { paraglideOptions } from "./scripts/paraglide-options.ts";
import { agentSkillZipPlugin } from "./scripts/vite-agent-skill-zip.ts";
import { routedFirstSegmentsPlugin } from "./scripts/vite-routed-segments.ts";
import { themeFixturePlugin } from "./scripts/vite-theme-fixture.ts";

import { themeNames, themes } from "./src/features/theme/registry";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const selectedTheme = z.enum(themeNames).catch("default").parse(env.THEME);
  return {
    // For `bun scripts/bundle-report.ts --sources`; never set in a deploy.
    build: { sourcemap: process.env.BUNDLE_SOURCEMAP === "1" },
    define: {
      __THEME_NAME__: JSON.stringify(selectedTheme),
      __THEME_CONFIG__: JSON.stringify(themes[selectedTheme]),
      __APP_VERSION__: JSON.stringify(packageJson.version),
      // Unique per build, so cached pages never outlive the assets they name.
      __BUILD_ID__: JSON.stringify(
        process.env.WORKERS_CI_BUILD_UUID || Date.now().toString(36),
      ),
    },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // Automatic splitting leaves a chunk for every small module that
                // two entries share. Gathering the small ones that the first load
                // reaches anyway (with their dependencies) cuts the file count
                // and compresses better as one file.
                groups: [
                  {
                    name: "small",
                    minShareCount: 2,
                    maxModuleSize: 4 * 1024,
                    tags: ["$initial"],
                  },
                ],
              },
            },
          },
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@theme": path.resolve(
          __dirname,
          `src/features/theme/themes/${selectedTheme}`,
        ),
      },
    },
    plugins: [
      paraglideVitePlugin(paraglideOptions),
      cloudflare({
        viteEnvironment: {
          name: "ssr",
        },
        // Read the Worker from cloudflare.config.ts instead of wrangler.jsonc.
        experimental: { newConfig: true },
      }),
      routedFirstSegmentsPlugin(),
      themeFixturePlugin(),
      agentSkillZipPlugin(),
      tailwindcss(),
      devtools(),
      tanstackStart(),
      viteReact(),
    ],
  };
});

export default config;

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import {build as bundle} from 'esbuild';
import {localScenePlugin} from './tools/local-scene-plugin.mjs';
import {experiencePlugin} from './tools/experience-plugin.mjs';
import { sites } from "@openai/sites-vite-plugin";

const hostingConfigured = existsSync(resolve(process.cwd(), ".openai", "hosting.json"));

function sitesStaticWorker() {
  return {
    name: "sites-static-worker",
    async closeBundle() {
      const output = resolve(process.cwd(), "dist", "server", "index.js");
      mkdirSync(resolve(output, ".."), { recursive: true });
      await bundle({entryPoints:['server/index.js'],outfile:output,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
    },
  };
}

export default defineConfig({
  plugins: [...(hostingConfigured ? [sites()] : []),localScenePlugin(process.env.STATION_SOURCE_WORKSPACE),experiencePlugin(),sitesStaticWorker()],
  publicDir: "public",
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        home: resolve(process.cwd(), "index.html"),
        seoul: resolve(process.cwd(), "seoul", "index.html"),
        commons: resolve(process.cwd(), "commons", "index.html"),
        catalog: resolve(process.cwd(), "catalog", "index.html"),
        routes: resolve(process.cwd(), "routes", "index.html"),
        station: resolve(process.cwd(), "app", "index.html"),
      },
    },
  },
});

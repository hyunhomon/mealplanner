import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      "@/*": "./src/lib/*",
      "$lib/*": "./src/lib/*",
    },
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "200.html",
    }),
  },
};

export default config;

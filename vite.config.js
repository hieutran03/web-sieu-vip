import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Serves the Vercel functions in api/ during `npm run dev`.
 * The handlers take (req, res) Node objects, which is exactly what Vite's middleware gives us,
 * so the same code runs locally and on Vercel — no `vercel dev` required for day-to-day work.
 */
function apiDevServer(env) {
  return {
    name: "v-tnf-api-dev",
    apply: "serve",
    configureServer(server) {
      // Server-only secrets: available to the handlers, never exposed to the client bundle.
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith("VITE_") && process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();

        const route = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
        const candidates = [
          path.resolve(`api/${route}.js`),
          path.resolve(`api/${route}.mjs`),
          path.resolve(`api/${route}/index.js`)
        ];
        const file = candidates.find((candidate) => fs.existsSync(candidate));
        if (!file) {
          response.statusCode = 404;
          response.setHeader("Content-Type", "application/json");
          return response.end(JSON.stringify({ error: `No API route for ${url.pathname}` }));
        }

        try {
          const module = await server.ssrLoadModule(file);
          request.query = Object.fromEntries(url.searchParams.entries());
          await module.default(request, response);
        } catch (error) {
          server.config.logger.error(`[api] ${url.pathname}: ${error.stack ?? error}`);
          if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ error: String(error.message ?? error) }));
          }
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), apiDevServer(env)],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // The catalog + province geometry are large and rarely change: keep them cacheable.
            if (id.includes("/src/data/")) return "catalog";
            if (id.includes("chart.js") || id.includes("react-chartjs-2")) return "charts";
            if (id.includes("@vis.gl/react-google-maps")) return "maps";
            return undefined;
          }
        }
      }
    }
  };
});

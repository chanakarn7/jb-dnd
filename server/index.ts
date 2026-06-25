import { createServer } from "node:http";
import next from "next";
import { createIoServer } from "./io";
import { rehydrateOnBoot } from "./state/persist";
import { OllamaProvider } from "../lib/ai/ollama";
import { setLLMProvider } from "../lib/llm/registry";

// Single Node process serving BOTH the Next.js app AND Socket.io on one HTTP server,
// bound to 0.0.0.0 so players on the LAN can reach it (docs/program/ARCHITECTURE.md).

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(async () => {
    const httpServer = createServer((req, res) => handle(req, res));

    // Attach the realtime layer to the same HTTP server.
    createIoServer(httpServer);

    // AI DM Assistant (Sprint 7): probe Ollama once at boot; register it as the
    // active LLM provider only if reachable. App runs fully without it (graceful
    // degrade) — the AI panel shows a banner and Import still works.
    const ollama = new OllamaProvider();
    ollama
      .isAvailable()
      .then((okAvail) => {
        if (okAvail) {
          setLLMProvider(ollama);
          console.log("✦ AI: Ollama connected — generation enabled");
        } else {
          console.warn("✦ AI: Ollama not reachable — generation disabled (Import still works)");
        }
      })
      .catch(() => {
        console.warn("✦ AI: Ollama probe failed — generation disabled (Import still works)");
      });

    // Rebuild live state for any active campaigns after a restart.
    let rehydrated = 0;
    try {
      rehydrated = await rehydrateOnBoot();
    } catch (err) {
      console.warn("⚠ rehydrate skipped (run `npm run db:migrate` if the DB is missing):", err);
    }

    httpServer.listen(port, hostname, () => {
      console.log(
        `▶ D&D Campaign Manager ready on http://${hostname}:${port}` +
          ` — players join at http://<dm-ip>:${port}` +
          ` (rehydrated ${rehydrated} active campaign${rehydrated === 1 ? "" : "s"})`,
      );
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

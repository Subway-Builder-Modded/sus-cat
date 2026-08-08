import { createServer, type Server } from "node:http";

import type { BotClient } from "../bot/bot-client.js";
import { logger } from "../shared/logger.js";

export class HealthServer {
  private server: Server | undefined;
  private databaseHealthyUntil = 0;

  constructor(private readonly client: BotClient, private readonly port: number) {}

  async start(): Promise<void> {
    if (this.server) return;
    this.server = createServer(async (request, response) => {
      if (request.url !== "/healthz") {
        response.writeHead(404).end("Not found");
        return;
      }

      const healthy = await this.isReady();
      response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: healthy ? "ready" : "starting" }));
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, "0.0.0.0", () => resolve());
    });
    logger.info("Health server listening", { port: this.port, path: "/healthz" });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  private async isReady(): Promise<boolean> {
    if (!this.client.isReady() || !this.client.runtime) return false;
    if (this.databaseHealthyUntil > Date.now()) return true;
    try {
      await this.client.runtime.database.ping();
      this.databaseHealthyUntil = Date.now() + 5_000;
      return true;
    } catch {
      return false;
    }
  }
}

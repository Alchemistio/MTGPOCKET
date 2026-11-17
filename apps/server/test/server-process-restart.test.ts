import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

const players = [
  { id: "p1", name: "Alice", seat: 0 },
  { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloe", seat: 2 },
  { id: "p4", name: "David", seat: 3 }
];

function messageQueue(socket: WebSocket) {
  const buffered: Record<string, unknown>[] = [];
  const waiters: Array<(message: Record<string, unknown>) => void> = [];
  socket.on("message", raw => {
    const message = JSON.parse(raw.toString()) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else buffered.push(message);
  });
  return {
    next(): Promise<Record<string, unknown>> {
      const message = buffered.shift();
      if (message) return Promise.resolve(message);
      return new Promise(resolve => waiters.push(resolve));
    }
  };
}

async function reservePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

function startServer(port: number, directory: string): { child: ChildProcess; ready: Promise<void> } {
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), CPOCKET_ROOM_DATA_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SERVER_START_TIMEOUT: " + output)), 8_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Commander Pocket server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", chunk => { output += chunk.toString(); });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", code => {
      if (!output.includes("Commander Pocket server listening")) {
        clearTimeout(timeout);
        reject(new Error("SERVER_EXITED_BEFORE_READY (" + code + "): " + output));
      }
    });
  });
  return { child, ready };
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await once(child, "exit");
}

describe("server process restart", () => {
  it("restores the authoritative room and idempotency cache after an OS process restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "commander-pocket-process-restart-"));
    const port = await reservePort();
    let first: ChildProcess | null = null;
    let second: ChildProcess | null = null;
    let client: WebSocket | null = null;
    try {
      const firstServer = startServer(port, directory);
      first = firstServer.child;
      await firstServer.ready;

      client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const firstQueue = messageQueue(client);
      await once(client, "open");
      client.send(JSON.stringify({ type: "create-room", gameId: "process-restart-game", players }));
      const created = await firstQueue.next();
      expect(created.type).toBe("room-created");
      const credentials = created.credentials as Array<{ playerId: string; token: string }>;
      const alice = credentials.find(item => item.playerId === "p1")!;
      const initialView = created.view as { revision: number };

      const command = {
        protocolVersion: 1,
        gameId: "process-restart-game",
        commandId: "persisted-command",
        playerId: "p1",
        expectedRevision: initialView.revision,
        type: "pass-priority",
        payload: {}
      };
      client.send(JSON.stringify({ type: "command", command }));
      const accepted = await firstQueue.next();
      expect(accepted).toMatchObject({ type: "command-result", result: { accepted: true, outcome: "passed" } });
      const firstUpdatedView = await firstQueue.next();
      expect(firstUpdatedView).toMatchObject({ type: "game-view", view: { revision: initialView.revision + 1, priorityPlayerId: "p2" } });

      client.close();
      await once(client, "close");
      client = null;
      await stopServer(first);
      first = null;

      const secondServer = startServer(port, directory);
      second = secondServer.child;
      await secondServer.ready;
      client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const secondQueue = messageQueue(client);
      await once(client, "open");
      client.send(JSON.stringify({
        type: "join-room", gameId: "process-restart-game", playerId: alice.playerId, token: alice.token
      }));
      const joined = await secondQueue.next();
      expect(joined).toMatchObject({
        type: "room-joined",
        view: { revision: initialView.revision + 1, priorityPlayerId: "p2" }
      });

      // Retrying the same command after restart returns its original result without a second mutation.
      client.send(JSON.stringify({ type: "command", command }));
      expect(await secondQueue.next()).toEqual(accepted);
      const duplicateView = await secondQueue.next();
      expect(duplicateView).toMatchObject({
        type: "game-view",
        view: { revision: initialView.revision + 1, priorityPlayerId: "p2" }
      });
    } finally {
      if (client && client.readyState !== WebSocket.CLOSED) {
        client.close();
        await once(client, "close");
      }
      if (first) await stopServer(first);
      if (second) await stopServer(second);
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);
});

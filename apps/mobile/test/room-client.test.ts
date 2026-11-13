import { describe, expect, it } from "vitest";
import { RoomClient } from "../src/network/room-client.js";

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(listener);
    this.listeners.set(type, group);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string) { this.sent.push(payload); }
  close() {
    this.readyState = 3;
    this.dispatch("close", { reason: "test close" });
  }
  open() {
    this.readyState = 1;
    this.dispatch("open", {});
  }
  message(payload: unknown) {
    this.dispatch("message", { data: JSON.stringify(payload) });
  }
  private dispatch(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("RoomClient", () => {
  it("connects, creates a room, validates the response and sends versioned commands", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket);
    const events: string[] = [];
    client.onEvent(event => events.push(event.type));

    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.open();
    await connected;

    const createdPromise = client.createRoom("local-game", players);
    expect(JSON.parse(socket.sent[0] ?? "{}").type).toBe("create-room");
    socket.message({
      type: "room-created", gameId: "local-game",
      credentials: [{ playerId: "p1", token: "seat-token" }],
      view: { revision: 0 }
    });
    const created = await createdPromise;
    expect(created.credentials[0]?.token).toBe("seat-token");

    client.sendCommand({
      protocolVersion: 1, gameId: "local-game", commandId: "cmd-1",
      playerId: "p1", expectedRevision: 0, type: "pass-priority", payload: {}
    });
    expect(JSON.parse(socket.sent[1] ?? "{}").type).toBe("command");

    socket.message({ type: "game-view", view: { revision: 1 } });
    expect(events).toContain("room-created");
    expect(events).toContain("game-view");
  });

  it("rejects malformed server messages instead of trusting their shape", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket);
    const events: string[] = [];
    client.onEvent(event => events.push(event.type));
    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.open();
    await connected;
    socket.message({ type: "room-created", gameId: 123, credentials: "bad" });
    expect(events).toContain("protocol-error");
  });
});

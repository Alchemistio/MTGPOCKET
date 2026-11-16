import { describe, expect, it } from "vitest";
import { RoomClient } from "../src/network/room-client.js";

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onSend?: (payload: string) => void;
  private listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(type: string, listener: (event: any) => void) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(listener);
    this.listeners.set(type, group);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string) { this.sent.push(payload); this.onSend?.(payload); }
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
  it("rejects a connection that closes before opening", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket, 50);
    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.close();
    await expect(connected).rejects.toThrow("Connexion fermée avant son ouverture");
  });

  it("times out a connection attempt that never opens", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket, 5);
    await expect(client.connect("ws://127.0.0.1:3000/ws")).rejects.toThrow("Délai dépassé");
    expect(socket.readyState).toBe(3);
  });

  it("times out a room handshake when the server never replies", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket, 5);
    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.open();
    await connected;
    await expect(client.createRoom("local-game", players)).rejects.toThrow("Délai dépassé");
  });

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

  it("sends all authenticated pregame operations and parses the private result", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket);
    const events: string[] = [];
    client.onEvent(event => events.push(event.type));
    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.open();
    await connected;

    client.submitPregameDeck({
      commanderIds: ["commander-id"],
      cards: [{ cardId: "commander-id", quantity: 1 }, { cardId: "land-id", quantity: 99 }]
    });
    socket.message({ type: "pregame-result", accepted: true });
    client.declareMulligan("keep");
    socket.message({ type: "pregame-result", accepted: true });
    client.chooseBottomCards(["instance-1"]);
    socket.message({ type: "pregame-result", accepted: true });
    client.startPregame();

    expect(socket.sent.map(payload => JSON.parse(payload).type)).toEqual([
      "pregame-submit-deck", "pregame-mulligan", "pregame-bottom", "pregame-start"
    ]);
    socket.message({
      type: "pregame-result", accepted: true, revision: 4,
      view: { revision: 4, step: "main1" }
    });
    expect(events).toContain("pregame-result");
  });

  it("rejects an in-flight room handshake when explicitly disconnected", async () => {
    const socket = new FakeSocket();
    const client = new RoomClient(() => socket as unknown as WebSocket, 100);
    const events: string[] = [];
    client.onEvent(event => events.push(event.type));
    const connected = client.connect("ws://127.0.0.1:3000/ws");
    socket.open();
    await connected;
    const handshake = client.createRoom("local-game", players);
    client.disconnect();
    await expect(handshake).rejects.toThrow("Connexion fermée avant la fin de l’opération");
    expect(events).toContain("disconnected");
  });

  it("times out a pregame action and requires a new connection before retrying", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const client = new RoomClient(() => sockets.shift() as unknown as WebSocket, 10);
    let timeouts = 0;
    let pregameResults = 0;
    client.onEvent(event => {
      if (event.type === "pregame-timeout") timeouts += 1;
      if (event.type === "pregame-result") pregameResults += 1;
    });

    const firstConnection = client.connect("ws://127.0.0.1:3000/ws");
    firstSocket.open();
    await firstConnection;
    client.submitPregameDeck({
      commanderIds: ["commander-id"],
      cards: [{ cardId: "commander-id", quantity: 1 }, { cardId: "land-id", quantity: 99 }]
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(timeouts).toBe(1);
    firstSocket.message({ type: "pregame-result", accepted: true });
    expect(pregameResults).toBe(0);
    expect(() => client.declareMulligan("keep")).toThrow("Reconnectez-vous");

    client.disconnect();
    const secondConnection = client.connect("ws://127.0.0.1:3000/ws");
    secondSocket.open();
    await secondConnection;
    client.declareMulligan("keep");
    client.disconnect();
  });

  it("reconnects with the stored seat token and receives the authoritative room view", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    secondSocket.onSend = payload => {
      const message = JSON.parse(payload) as { type?: string };
      if (message.type === "join-room") {
        queueMicrotask(() => secondSocket.message({ type: "room-joined", view: { revision: 9, status: "active" } }));
      }
    };
    let socketCount = 0;
    const client = new RoomClient(() => {
      socketCount += 1;
      if (socketCount === 1) return firstSocket as unknown as WebSocket;
      queueMicrotask(() => secondSocket.open());
      return secondSocket as unknown as WebSocket;
    }, 100, 1, 3);
    const events: string[] = [];
    client.onEvent(event => events.push(event.type));

    const connected = client.connect("ws://127.0.0.1:3000/ws");
    firstSocket.open();
    await connected;
    const joined = client.joinRoom("restartable-room", "p2", "seat-secret");
    firstSocket.message({ type: "room-joined", view: { revision: 4, status: "pregame" } });
    await joined;

    const reconnected = new Promise<void>(resolve => {
      const unsubscribe = client.onEvent(event => {
        if (event.type === "reconnected") {
          unsubscribe();
          resolve();
        }
      });
    });
    firstSocket.close();
    await reconnected;

    const reconnectMessage = secondSocket.sent.map(payload => JSON.parse(payload) as Record<string, unknown>)
      .find(message => message.type === "join-room");
    expect(reconnectMessage).toMatchObject({
      type: "join-room", gameId: "restartable-room", playerId: "p2", token: "seat-secret"
    });
    expect(events.filter(type => type === "room-joined")).toHaveLength(2);
    expect(events).toContain("reconnecting");
    expect(events).toContain("reconnected");
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
    socket.message({ type: "pregame-result", accepted: "yes" });
    expect(events.filter(type => type === "protocol-error")).toHaveLength(2);
  });
});

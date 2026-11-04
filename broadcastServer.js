import { WebSocketServer } from "ws";

/**
 * A tiny broadcast hub: the avatar front-end (an HTML page you load as an
 * OBS Browser Source) connects here over WebSocket and receives every
 * avatar-control JSON as it's produced, in real time.
 *
 * Multiple front-ends can connect (e.g. a preview window + the real OBS
 * source) - all get the same messages.
 */
export function startBroadcastServer(port) {
  const wss = new WebSocketServer({ port });
  const clients = new Set();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[broadcast] avatar client connected (${clients.size} total)`);
    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[broadcast] avatar client disconnected (${clients.size} total)`);
    });
  });

  function broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  }

  console.log(`[broadcast] WebSocket hub listening on ws://localhost:${port}`);
  return { broadcast, wss };
}

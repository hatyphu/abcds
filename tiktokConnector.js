import "dotenv/config";
import { WebcastPushConnection } from "tiktok-live-connector";
import { processEvent, pickEventToRespond } from "./kolBrain.js";
import { synthesizeSpeech } from "./tts.js";
import { startBroadcastServer } from "./broadcastServer.js";

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;
const WS_PORT = Number(process.env.WS_PORT) || 8081;
const BATCH_INTERVAL_MS = Number(process.env.BATCH_INTERVAL_MS) || 1500;

if (!TIKTOK_USERNAME) {
  console.error("Set TIKTOK_USERNAME in your .env (the account that is currently live).");
  process.exit(1);
}

// Single-session short-term memory for this stream. Reset per stream start.
const recentContext = {
  last_topic: null,
  last_viewer_name: null,
  last_gift: null,
  recent_turns: [],
};

function updateContext(event, result) {
  recentContext.last_viewer_name = event.viewer_name;
  if (event.type === "gift") recentContext.last_gift = event.gift_name;
  if (result.speech) {
    recentContext.recent_turns.push(`${event.viewer_name}: ${event.text || "[gift]"}`);
    recentContext.recent_turns.push(`KOL: ${result.speech}`);
    recentContext.recent_turns = recentContext.recent_turns.slice(-10);
  }
}

// Incoming events are buffered here and flushed on a fixed interval, so a
// burst of comments only triggers one Claude call + one avatar reaction -
// same "chọn priority cao nhất" behavior as pickEventToRespond().
let buffer = [];

const { broadcast } = startBroadcastServer(WS_PORT);

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  const chosen = pickEventToRespond(batch);
  const result = await processEvent(chosen, recentContext);
  updateContext(chosen, result);

  let audio = null;
  if (result.response_needed && result.speech) {
    audio = await synthesizeSpeech(result.speech);
  }

  broadcast({
    type: "avatar_update",
    payload: result,
    audioUrl: audio?.audioUrl || null,
    // NOTE: raw audioBuffer isn't sent over this JSON channel - if your TTS
    // provider returns a Buffer instead of a URL, either upload it
    // somewhere and pass a URL, or extend broadcastServer to send binary
    // frames to the avatar client.
  });

  console.log(
    `[live] ${chosen.viewer_name} -> ${result.response_needed ? result.speech : "(bỏ qua)"}`
  );
}

setInterval(flushBuffer, BATCH_INTERVAL_MS);

const connection = new WebcastPushConnection(TIKTOK_USERNAME);

connection
  .connect()
  .then((state) => {
    console.log(`[live] Connected to @${TIKTOK_USERNAME}'s room (id: ${state.roomId})`);
  })
  .catch((err) => {
    console.error("[live] Failed to connect - is the account live right now?", err.message);
    process.exit(1);
  });

connection.on("chat", (data) => {
  buffer.push({
    type: "comment",
    viewer_name: data.nickname || data.uniqueId,
    text: data.comment,
  });
});

connection.on("gift", (data) => {
  // tiktok-live-connector fires repeated events while a gift streak is in
  // progress - only react once the streak ends (repeatEnd true), or
  // immediately for non-streakable gifts.
  if (data.giftType === 1 && !data.repeatEnd) return;

  buffer.push({
    type: "gift",
    viewer_name: data.nickname || data.uniqueId,
    gift_name: data.giftName,
    gift_value: data.diamondCount * (data.repeatCount || 1),
  });
});

connection.on("streamEnd", () => {
  console.log("[live] Stream ended.");
  process.exit(0);
});

connection.on("disconnected", () => {
  console.log("[live] Disconnected from TikTok LIVE.");
});

# KOL Livestream Brain

A small Node.js service that takes livestream comment/gift events and calls
Claude to produce an "avatar control" JSON object (emotion, eyes, gesture,
voice, and the Vietnamese speech line) for a virtual KOL avatar.

## Setup

```bash
cd kol-livestream
npm install
cp .env.example .env
# then edit .env and add your ANTHROPIC_API_KEY
```

## Try it standalone

```bash
npm run demo
```

This runs `src/demo.js`, which simulates a small burst of comments, a
follow-up that relies on short-term memory, a gift event, and someone
directly asking if the KOL is AI.

## Run as a webhook server

```bash
npm start
```

Then send events to it (e.g. from whatever service connects to TikTok Live):

```bash
curl -X POST http://localhost:3000/event \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "stream-1",
    "event": { "type": "comment", "viewer_name": "Lan", "text": "Chị ơi hôm nay chị xinh quá" }
  }'
```

For a burst of comments arriving at once, use `/event-batch` with an
`events` array — it picks the single highest-priority one to respond to,
same as `pickEventToRespond()` does internally.

## Kết nối TikTok LIVE thật (real-time)

**Quan trọng cần hiểu trước:** TikTok không có API chính thức để "tự động phát live"
hay "tự động trả lời trong chat live" - live vẫn phải là một video/audio stream
thật đẩy qua RTMP (giống hệt bạn stream game bằng OBS). Những gì phần này làm được:

1. Nghe **comment & gift real-time** từ phòng live đang chạy (qua thư viện cộng
   đồng `tiktok-live-connector` - không official, có thể cần cập nhật khi TikTok
   đổi hạ tầng).
2. Gửi vào `kolBrain` để lấy JSON phản ứng (cảm xúc, ánh mắt, gesture, câu nói).
3. Bắn JSON đó real-time qua WebSocket tới một trang avatar (`public/avatar-preview.html`)
   - bạn load trang này làm **Browser Source trong OBS**, rồi OBS đẩy RTMP vào
   TikTok LIVE Studio như một buổi live bình thường.

```
TikTok LIVE room  →  tiktokConnector.js  →  kolBrain (Claude)  →  WebSocket
                                                                       ↓
                                          public/avatar-preview.html (OBS Browser Source)
                                                                       ↓
                                                    OBS  →  RTMP  →  TikTok LIVE Studio
```

### Chạy thử

```bash
npm install
cp .env.example .env
# điền ANTHROPIC_API_KEY và TIKTOK_USERNAME (tài khoản đang live, không có @)

npm run live
```

Sau đó mở `public/avatar-preview.html` bằng trình duyệt (hoặc load nó làm Browser
Source trong OBS) - nó sẽ tự kết nối tới `ws://localhost:8081` và hiện câu nói +
cảm xúc mỗi khi có comment/gift mới trong phòng live thật.

### Việc bạn cần tự làm thêm

- **Avatar thật (2D/3D):** `avatar-preview.html` chỉ là một vòng tròn placeholder
  + speech bubble để demo pipeline. Thay bằng avatar rig thật của bạn (Live2D,
  VTube Studio qua WebSocket plugin, Unity/Unreal render ra Browser Source, hoặc
  dịch vụ avatar AI có sẵn) - map các field `emotion`, `eye_direction`,
  `facial_expression`, `gesture` từ JSON vào rig đó.
- **Giọng nói (TTS):** `src/tts.js` là interface rỗng, chưa gọi provider nào.
  Điền API key của Azure Speech / ElevenLabs / Google TTS / FPT.AI (có ví dụ code
  mẫu cho Azure ngay trong file) để avatar thực sự phát ra tiếng Việt.
- **OBS setup:** thêm Browser Source trỏ tới file `avatar-preview.html` (hoặc host
  nó qua một static server nhỏ), rồi cấu hình Stream key TikTok LIVE Studio vào
  OBS như stream bình thường.
- **Batch timing:** `BATCH_INTERVAL_MS` trong `.env` quyết định bao lâu gom 1 đợt
  comment để chọn ra 1 cái trả lời - stream càng đông càng nên tăng số này để đỡ
  gọi API liên tục.

## Files

- `src/systemPrompt.js` — the condensed persona/behavior prompt sent to Claude
  as the system message.
- `src/kolBrain.js` — core logic: builds the request, calls Claude, parses
  and validates the JSON response, falls back to an idle response on error.
- `src/server.js` — Express server exposing `/event` and `/event-batch`,
  with simple in-memory per-session short-term context (swap for
  Redis/DB for production/multi-instance use).
- `src/demo.js` — runnable example with no server needed.
- `src/tiktokConnector.js` — connects to a real TikTok LIVE room, batches
  comments/gifts on a timer, calls `kolBrain`, broadcasts results over WebSocket.
- `src/broadcastServer.js` — the WebSocket hub the avatar front-end connects to.
- `src/tts.js` — pluggable text-to-speech interface (no provider wired up by
  default - see comments inside for an Azure Speech example).
- `public/avatar-preview.html` — placeholder avatar page to load as an OBS
  Browser Source; replace the visuals with your real avatar rig.

## Notes / things to adapt for production

- **Session memory** is in-memory (a `Map`) here for simplicity. If you run
  more than one server process, back it with Redis or a DB instead.
- **Rate/burst control**: TikTok Live comment volume can spike. The
  `/event-batch` endpoint + `pickEventToRespond` heuristic keeps you from
  calling the API once per comment; you may want to batch on a short timer
  (e.g. every 1–2s) rather than per HTTP request.
- **AI disclosure**: the prompt is written so the character stays natural
  and human-like, but plainly admits to being AI if asked directly. Keep
  that behavior — several platforms (including TikTok) require disclosure
  for AI-generated hosts, and it avoids backlash from viewers who send gifts
  believing they're talking to a real person.
- **Latency**: for real-time feel, consider streaming the Claude response
  and having the avatar start the pre-speech animation as soon as the JSON
  fields (except `speech`) are available, if your avatar pipeline supports
  partial JSON parsing.

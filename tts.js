/**
 * Pluggable TTS interface. Vietnamese female-voice TTS options worth
 * evaluating: ElevenLabs, Azure Speech (has good vi-VN voices), Google
 * Cloud TTS (vi-VN-Wavenet voices), or FPT.AI's TTS (Vietnamese-focused).
 *
 * This stub does NOT call any provider - wire up the one you have an
 * account/API key for, then the rest of the pipeline (tiktokConnector.js)
 * will pick it up automatically.
 *
 * Expected contract: given Vietnamese text, return a Buffer of audio
 * (e.g. mp3/wav) or a URL the avatar front-end can play.
 */

/**
 * @param {string} text - the "speech" field from kolBrain's output
 * @returns {Promise<{ audioUrl?: string, audioBuffer?: Buffer } | null>}
 */
export async function synthesizeSpeech(text) {
  if (!text) return null;

  // --- Example wiring for Azure Speech (vi-VN-HoaiMyNeural voice) ---
  // const resp = await fetch(
  //   `https://${process.env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
  //   {
  //     method: "POST",
  //     headers: {
  //       "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
  //       "Content-Type": "application/ssml+xml",
  //       "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",
  //     },
  //     body: `<speak version='1.0' xml:lang='vi-VN'>
  //       <voice xml:lang='vi-VN' xml:gender='Female' name='vi-VN-HoaiMyNeural'>
  //         ${text}
  //       </voice>
  //     </speak>`,
  //   }
  // );
  // const audioBuffer = Buffer.from(await resp.arrayBuffer());
  // return { audioBuffer };

  console.warn(
    "[tts] synthesizeSpeech() is a stub - no audio provider wired up yet. " +
      "See comments in src/tts.js. Returning null (text-only mode)."
  );
  return null;
}

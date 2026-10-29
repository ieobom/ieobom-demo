// 말 → 글: 브라우저에서 녹음한 소리(base64)를 OpenAI 음성 인식으로 보낸다
import { guard, openai } from "./_lib.js";

// 소리가 거의 없을 때 음성 인식이 지어내는 흔한 문장
const JUNK = [/시청해\s*주셔서\s*감사/, /구독과\s*좋아요/, /MBC\s*뉴스/, /다음\s*영상에서/, /자막\s*(제공|by)/i];

export default async function handler(req, res) {
  if (!guard(req, res, { limit: 150 })) return;
  const { audio, mime } = req.body || {};
  if (typeof audio !== "string" || audio.length < 100) return res.status(400).json({ error: "audio" });
  if (audio.length > 4000000) return res.status(413).json({ error: "too_long" });
  const type = typeof mime === "string" && /^audio\//.test(mime) ? mime.split(";")[0] : "audio/webm";
  const ext = /mp4|aac|m4a/.test(type) ? "m4a" : /ogg/.test(type) ? "ogg" : /wav/.test(type) ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(audio, "base64")], { type }), "voice." + ext);
  form.append("model", process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "ko");
  const out = await openai("/audio/transcriptions", { method: "POST", body: form }, 25000);
  if (!out) return res.status(502).json({ error: "stt" });
  let text = String(out.text || "").trim();
  if (JUNK.some((re) => re.test(text))) text = "";
  res.status(200).json({ text: text.slice(0, 1000) });
}

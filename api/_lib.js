// 공통: 요청 막기(방법 · 키 · 호출 횟수)와 OpenAI 호출
const HITS = new Map();

export function guard(req, res, { limit = 60, windowMs = 10 * 60 * 1000 } = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return false;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return false;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "no_key" });
    return false;
  }
  // 같은 주소에서 너무 자주 부르면 막는다 (서버 함수 하나 안에서만 세는 간단한 제한 · OpenAI 사용 한도와 함께 쓴다)
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  const now = Date.now();
  const list = (HITS.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    res.status(429).json({ error: "busy" });
    return false;
  }
  list.push(now);
  HITS.set(ip, list);
  return true;
}

const base = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

export async function openai(path, init, ms = 20000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(base() + path, { ...init, headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, ...(init.headers || {}) }, signal: ac.signal });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      console.error("openai", path, r.status, body && body.error && body.error.message);
      return null;
    }
    return body;
  } catch (e) {
    console.error("openai", path, e.name);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

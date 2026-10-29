// 글 만들기: 근황 → 물어볼 이야기 · 받아쓴 통화 → 통화 메모 초안 · 메모 → 다음 통화 이야기
import { guard, openai } from "./_lib.js";

const TOPICS = ["일·학교", "건강", "취미·운동", "먹은 것", "다녀온 곳", "가족·친구", "그 밖"];
const RULES = "걱정 · 훈계 · 조언 · 건강 진단은 하지 않는다. 따뜻하고 가볍게 쓰고, 없는 내용은 지어내지 않는다.";
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const tone = (asker) => asker === "parent"
  ? "묻는 사람은 부모님이다. 자녀에게 하는 다정한 반말로 쓴다(예: '발표는 잘 끝났어?')."
  : "묻는 사람은 자녀다. 부모님께 드리는 존댓말로 쓴다(예: '꽃길 산책은 어디로 가셨어요?').";

const TASKS = {
  // to = 근황을 받아 다음 통화 때 물어볼 사람 (parent | child)
  newsAsk: ({ text, to }) => ({
    need: clip(text, 400),
    system: [
      "너는 가족 소통 앱 '이어봄'의 도우미다. 한 가족이 올린 짧은 근황을 보고, 근황을 받은 가족이 다음 통화 때 꺼낼 질문 한 문장을 만든다.",
      "- 근황 속 구체적인 내용(장소 · 사람 · 일 · 음식)을 짚어 묻는다.",
      "- 한 문장, 25자 안팎, 물음표로 끝난다.",
      "- " + tone(to === "child" ? "child" : "parent"),
      "- " + RULES,
      "- 근황의 주제를 다음 중 하나로 고른다: " + TOPICS.join(", ") + ".",
      'JSON으로만 답한다: {"q": "질문", "topic": "주제"}'
    ].join("\n"),
    user: "근황: " + clip(text, 400),
    pick: (o) => ({ q: clip(o.q, 60), topic: TOPICS.includes(o.topic) ? o.topic : "" })
  }),
  // who = 메모를 쓰는 사람 (parent | child) · partner = 통화 상대 이름
  callDraft: ({ transcript, who, partner }) => ({
    need: clip(transcript, 2000),
    system: [
      "너는 통화를 마친 사람이 남길 '통화 메모 초안'을 쓴다. 받아쓴 통화 글을 보고, 다음 통화 때 기억해 둘 사실만 1~3줄로 줄인다.",
      "- 받아쓴 글에는 " + (who === "parent" ? "부모님" : "자녀") + "(메모를 쓰는 사람)의 목소리만 있고, 받아쓰기가 틀린 곳이 있을 수 있다.",
      "- 한 줄에 한 가지. 짧은 메모 말투(예: '무릎 검사 결과 괜찮으시대.', '주말에 김장하러 가신대.').",
      "- 받아쓴 글에 없는 내용은 지어내지 않는다. 인사말 · 감정 평가는 뺀다.",
      "- 기억할 만한 내용이 없으면 받아쓴 글의 요점을 한 줄로 쓴다.",
      'JSON으로만 답한다: {"draft": "줄1\\n줄2"}'
    ].join("\n"),
    user: "통화 상대: " + clip(partner || "가족", 20) + "\n받아쓴 글: " + clip(transcript, 2000),
    pick: (o) => ({ draft: String(o.draft || "").split(/\n+/).map((x) => clip(x, 80)).filter(Boolean).slice(0, 3).join("\n") })
  }),
  memoAsks: ({ memo, who }) => ({
    need: clip(memo, 600),
    system: [
      "너는 가족 소통 앱 '이어봄'의 도우미다. 통화 메모를 보고 다음 통화 때 상대에게 꺼낼 질문을 1~2개 만든다.",
      "- 메모 속 구체적인 일의 결과 · 그 뒤 · 느낌을 이어서 묻는다.",
      "- " + tone(who === "parent" ? "parent" : "child"),
      "- 한 문장, 25자 안팎, 물음표로 끝난다. " + RULES,
      'JSON으로만 답한다: {"asks": ["질문1", "질문2"]}'
    ].join("\n"),
    user: "메모: " + clip(memo, 600),
    pick: (o) => ({ asks: (Array.isArray(o.asks) ? o.asks : []).map((x) => clip(x, 60)).filter(Boolean).slice(0, 2) })
  })
};

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  const body = req.body || {};
  const make = TASKS[body.task];
  if (!make) return res.status(400).json({ error: "task" });
  const p = make(body);
  if (!p.need) return res.status(400).json({ error: "empty" });
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-6-luna";
  const out = await openai("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }],
      response_format: { type: "json_object" },
      max_completion_tokens: 600,
      // 추론 모델(gpt-5 이후 · o 계열)은 추론을 꺼서 빠르고 싸게
      ...(/^(gpt-([5-9]|\d\d)|o\d)/.test(model) ? { reasoning_effort: "none" } : {})
    })
  });
  const content = out && out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content;
  let obj = null;
  try {
    obj = JSON.parse(content);
  } catch {}
  if (!obj) return res.status(502).json({ error: "ai" });
  res.status(200).json(p.pick(obj));
}

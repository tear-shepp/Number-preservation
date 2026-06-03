import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function loadWorker() {
  const source = await readFile(new URL("../worker/worker.js", import.meta.url), "utf8");
  const factory = new Function(`${source.replace("export default", "return")}`);
  return factory();
}

function createKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key, options) {
      const value = store.get(key);
      if (value === undefined) return null;
      if (options && options.type === "json") return JSON.parse(value);
      return value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function createEnv(initial = {}) {
  return {
    TG_BOT_TOKEN: "token",
    TG_CHAT_ID: "12345",
    ESIM_DB: createKv(initial),
  };
}

function captureTelegramMessages() {
  const messages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    messages.push(JSON.parse(init.body).text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return {
    messages,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function telegramUpdate(text, chatId = 12345) {
  return new Request("https://example.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: Date.now(),
      message: {
        message_id: 1,
        text,
        chat: { id: chatId },
      },
    }),
  });
}

test("忽略非授权 Telegram chat，不回复也不写入 KV", async () => {
  const worker = await loadWorker();
  const env = createEnv();
  const sentMessages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sentMessages.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const response = await worker.fetch(telegramUpdate("/add", 99999), env, {});

    assert.equal(response.status, 200);
    assert.equal(sentMessages.length, 0);
    assert.equal(env.ESIM_DB.store.has("tg_session_99999"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("/add 完整流程保存记录到 esim_list", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

  try {
    for (const text of [
      "/add",
      "KnowRoaming",
      "+1 234 567 8900",
      "180",
      "2026-12-31",
      "Telegram Google OpenAI",
      "半年发一次短信",
      "确认",
    ]) {
      const response = await worker.fetch(telegramUpdate(text), env, {});
      assert.equal(response.status, 200);
    }

    const esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims.length, 1);
    assert.equal(esims[0].name, "KnowRoaming");
    assert.equal(esims[0].number, "+1 234 567 8900");
    assert.equal(esims[0].cycle, 180);
    assert.equal(esims[0].expireDate, "2026-12-31");
    assert.equal(esims[0].platforms, "Telegram Google OpenAI");
    assert.equal(esims[0].remark, "半年发一次短信");
    assert.ok(esims[0].id);
    assert.equal(env.ESIM_DB.store.has("tg_session_12345"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("/skip 跳过手机号、平台和备注", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]" });
  const capture = captureTelegramMessages();

  try {
    for (const text of [
      "/add",
      "KnowRoaming",
      "/skip",
      "180",
      "2026-12-31",
      "/skip",
      "/skip",
      "确认",
    ]) {
      const response = await worker.fetch(telegramUpdate(text), env, {});
      assert.equal(response.status, 200);
    }

    const esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims.length, 1);
    assert.equal(esims[0].number, "");
    assert.equal(esims[0].platforms, "");
    assert.equal(esims[0].remark, "");
    assert.match(capture.messages.join("\n"), /发送 \/skip 跳过/);
  } finally {
    capture.restore();
  }
});

test("/start 返回欢迎说明和添加流程，/help 只返回可用命令", async () => {
  const worker = await loadWorker();
  const env = createEnv();
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/start"), env, {});
    await worker.fetch(telegramUpdate("/help"), env, {});

    assert.match(capture.messages[0], /欢迎使用/);
    assert.match(capture.messages[0], /发送 \/help 查看可用命令/);
    assert.match(capture.messages[0], /添加号码流程/);
    assert.match(capture.messages[0], /发送 \/add 后，我会按 6 步询问/);
    assert.match(capture.messages[0], /可发送 \/skip 跳过/);
    assert.match(capture.messages[1], /<b>可用命令<\/b>/);
    assert.match(capture.messages[1], /\/site - 显示网站访问链接/);
    assert.doesNotMatch(capture.messages[1], /添加号码流程/);
  } finally {
    capture.restore();
  }
});

test("/site 返回网站访问链接", async () => {
  const worker = await loadWorker();
  const env = createEnv();
  const capture = captureTelegramMessages();

  try {
    const response = await worker.fetch(telegramUpdate("/site"), env, {});

    assert.equal(response.status, 200);
    assert.match(capture.messages.at(-1), /https:\/\/phone\.betony\.cc\.cd/);
  } finally {
    capture.restore();
  }
});

test("周期格式错误时不推进添加步骤", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]" });
  const sentMessages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sentMessages.push(JSON.parse(init.body).text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    for (const text of ["/add", "KnowRoaming", "-", "abc"]) {
      const response = await worker.fetch(telegramUpdate(text), env, {});
      assert.equal(response.status, 200);
    }

    const session = JSON.parse(env.ESIM_DB.store.get("tg_session_12345"));
    assert.equal(session.step, "cycle");
    assert.match(sentMessages.at(-1), /周期格式不正确/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("/cancel 清理当前 Telegram 添加会话", async () => {
  const worker = await loadWorker();
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

  try {
    await worker.fetch(telegramUpdate("/add"), env, {});
    assert.equal(env.ESIM_DB.store.has("tg_session_12345"), true);

    const response = await worker.fetch(telegramUpdate("/cancel"), env, {});

    assert.equal(response.status, 200);
    assert.equal(env.ESIM_DB.store.has("tg_session_12345"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

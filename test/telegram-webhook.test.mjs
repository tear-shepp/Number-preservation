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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function startKeyboardKey(chatId = 12345) {
  return `tg_start_keyboard_${chatId}`;
}

function captureTelegramMessages() {
  const messages = [];
  const payloads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const payload = JSON.parse(init.body);
    payloads.push(payload);
    if (typeof payload.text === "string") messages.push(payload.text);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return {
    messages,
    payloads,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function telegramCallbackUpdate(data, chatId = 12345) {
  return new Request("https://example.test/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: Date.now(),
      callback_query: {
        id: "callback-1",
        data,
        message: {
          message_id: 1,
          chat: { id: chatId },
        },
      },
    }),
  });
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

test("/add 完整流程保存记录到 esim_list，所有步骤回复常驻导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]", [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

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

    const keyboardPayloads = capture.payloads.filter(p => p.reply_markup && p.reply_markup.inline_keyboard);
    assert.equal(keyboardPayloads.length, 8, "/add 的 8 条回复都应带导航键盘");
    for (const p of keyboardPayloads) {
      assert.deepEqual(p.reply_markup.inline_keyboard[0][0], { text: "添加号码", callback_data: "cmd:add" });
    }
  } finally {
    capture.restore();
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
    assert.match(capture.messages.join("\n"), /多个平台请用空格或英文逗号分隔/);
    assert.match(capture.messages.join("\n"), /Telegram, Google, OpenAI/);
    assert.match(capture.messages.join("\n"), /发送 \/skip 跳过/);
  } finally {
    capture.restore();
  }
});

test("/start 返回欢迎说明和添加流程，/help 只返回可用命令", async () => {
  const worker = await loadWorker();
  const env = createEnv({ [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/start"), env, {});
    await worker.fetch(telegramUpdate("/help"), env, {});

    assert.match(capture.messages[0], /欢迎使用/);
    assert.match(capture.messages[0], /发送 \/help 查看可用命令/);
    assert.match(capture.messages[0], /添加号码流程/);
    assert.match(capture.messages[0], /发送 \/add 后，我会按 6 步询问/);
    assert.match(capture.messages[0], /多个平台请用空格或英文逗号分隔/);
    assert.match(capture.messages[0], /可发送 \/skip 跳过/);
    assert.match(capture.messages[1], /<b>可用命令<\/b>/);
    assert.match(capture.messages[1], /\/site - 显示网站访问链接/);
    assert.doesNotMatch(capture.messages[1], /添加号码流程/);

    const startKeyboardPayloads = capture.payloads.filter(p => p.reply_markup && p.reply_markup.inline_keyboard);
    assert.equal(startKeyboardPayloads.length, 2, "/start 和 /help 回复都应带导航键盘");
    assert.deepEqual(capture.payloads[1].reply_markup.inline_keyboard, [
      [
        { text: "添加号码", callback_data: "cmd:add" },
        { text: "查看列表", callback_data: "cmd:list" },
      ],
      [
        { text: "打开网站", callback_data: "cmd:site" },
        { text: "帮助", callback_data: "cmd:help" },
      ],
      [
        { text: "一键续期", callback_data: "cmd:renew" },
        { text: "修改平台", callback_data: "cmd:platform" },
      ],
    ]);
  } finally {
    capture.restore();
  }
});

test("/help 按钮回调复用现有命令", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      {
        id: "1",
        name: "KnowRoaming",
        number: "+1 234 567 8900",
        cycle: 180,
        expireDate: "2026-12-31",
        platforms: "Telegram",
        remark: "半年发一次短信",
      },
    ]),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramCallbackUpdate("cmd:list"), env, {});
    await worker.fetch(telegramCallbackUpdate("cmd:site"), env, {});
    await worker.fetch(telegramCallbackUpdate("cmd:add"), env, {});
    await worker.fetch(telegramCallbackUpdate("cmd:help"), env, {});
    await worker.fetch(telegramCallbackUpdate("cmd:renew"), env, {});

    assert.match(capture.messages[0], /当前号码列表/);
    assert.match(capture.messages[0], /KnowRoaming/);
    assert.match(capture.messages[1], /https:\/\/phone\.betony\.cc\.cd/);
    assert.match(capture.messages[2], /第 1\/6 步：卡片名称/);
    assert.match(capture.messages[3], /<b>可用命令<\/b>/);

    assert.match(capture.messages[4], /回复序号/);
    assert.match(capture.messages[4], /KnowRoaming/);

    const keyboardPayloads = capture.payloads.filter(p => p.reply_markup && p.reply_markup.inline_keyboard);
    assert.equal(keyboardPayloads.length, 5, "/list /site /add /help /renew 回调回复都应带导航键盘");
    assert.deepEqual(keyboardPayloads.at(-1).reply_markup.inline_keyboard[1][1], { text: "帮助", callback_data: "cmd:help" });
    assert.deepEqual(keyboardPayloads.at(-1).reply_markup.inline_keyboard[2][1], { text: "修改平台", callback_data: "cmd:platform" });

    const session = JSON.parse(env.ESIM_DB.store.get("tg_session_12345"));
    assert.equal(session.action, "add");
    assert.equal(session.step, "name");
  } finally {
    capture.restore();
  }
});

test("/platform 显示号码列表和按钮化引导", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", platforms: "Telegram Google" },
      { id: "2", name: "Firsty", platforms: "" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/platform"), env, {});

    assert.match(capture.messages.at(-1), /请选择要管理已注册平台的号码/);
    assert.match(capture.messages.at(-1), /点击下面的号码进入平台管理页/);
    assert.deepEqual(capture.payloads.at(-1).reply_markup.inline_keyboard, [
      [{ text: "1. KnowRoaming", callback_data: "platform:view:0" }],
      [{ text: "2. Firsty", callback_data: "platform:view:1" }],
      [{ text: "返回帮助", callback_data: "cmd:help" }],
    ]);
  } finally {
    capture.restore();
  }
});

test("平台管理页显示新增、删除、重命名、清空和返回按钮", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", platforms: "Telegram Google OpenAI" },
    ]),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramCallbackUpdate("platform:view:0"), env, {});

    assert.match(capture.messages.at(-1), /KnowRoaming 当前已注册平台/);
    assert.match(capture.messages.at(-1), /1\. Telegram/);
    assert.match(capture.messages.at(-1), /2\. Google/);
    assert.match(capture.messages.at(-1), /3\. OpenAI/);
    assert.deepEqual(capture.payloads.at(-1).reply_markup.inline_keyboard, [
      [{ text: "新增平台", callback_data: "platform:add:0" }],
      [
        { text: "删除 Telegram", callback_data: "platform:del:0:0" },
        { text: "删除 Google", callback_data: "platform:del:0:1" },
      ],
      [{ text: "删除 OpenAI", callback_data: "platform:del:0:2" }],
      [{ text: "重命名平台", callback_data: "platform:rename:0" }],
      [{ text: "清空平台", callback_data: "platform:clear:0" }],
      [{ text: "返回号码列表", callback_data: "cmd:platform" }],
    ]);
  } finally {
    capture.restore();
  }
});

test("按钮化新增平台后写回 esim_list 并刷新管理页", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", platforms: "Telegram Google" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramCallbackUpdate("platform:add:0"), env, {});
    assert.match(capture.messages.at(-1), /请输入要新增的平台名称/);

    await worker.fetch(telegramUpdate("Claude, GitHub"), env, {});
    const esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims[0].platforms, "Telegram Google Claude GitHub");
    assert.match(capture.messages.at(-1), /已更新 KnowRoaming 的已注册平台/);
    assert.match(capture.messages.at(-1), /3\. Claude/);
    assert.match(capture.messages.at(-1), /4\. GitHub/);
    assert.deepEqual(capture.payloads.at(-1).reply_markup.inline_keyboard[2][0], { text: "删除 Claude", callback_data: "platform:del:0:2" });
  } finally {
    capture.restore();
  }
});

test("按钮化删除、重命名和清空平台", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", platforms: "Telegram Google OpenAI" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramCallbackUpdate("platform:del:0:1"), env, {});
    let esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims[0].platforms, "Telegram OpenAI");
    assert.match(capture.messages.at(-1), /已删除 Google/);

    await worker.fetch(telegramCallbackUpdate("platform:rename:0"), env, {});
    assert.match(capture.messages.at(-1), /请选择要重命名的平台/);
    await worker.fetch(telegramCallbackUpdate("platform:rename-target:0:1"), env, {});
    assert.match(capture.messages.at(-1), /请输入新的平台名称/);
    await worker.fetch(telegramUpdate("ChatGPT"), env, {});
    esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims[0].platforms, "Telegram ChatGPT");
    assert.match(capture.messages.at(-1), /已将 OpenAI 修改为 ChatGPT/);

    await worker.fetch(telegramCallbackUpdate("platform:clear:0"), env, {});
    assert.match(capture.messages.at(-1), /确认清空 KnowRoaming/);
    await worker.fetch(telegramCallbackUpdate("platform:clear-confirm:0"), env, {});
    esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims[0].platforms, "");
    assert.match(capture.messages.at(-1), /已清空 KnowRoaming/);
  } finally {
    capture.restore();
  }
});

test("/platform 备用命令不执行修改，只提示按钮操作", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", platforms: "Telegram" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/platform 1 add Claude"), env, {});

    const esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims[0].platforms, "Telegram");
    assert.match(capture.messages.at(-1), /平台管理已改为按钮操作/);
    assert.ok(capture.payloads.at(-1).reply_markup && capture.payloads.at(-1).reply_markup.inline_keyboard);
  } finally {
    capture.restore();
  }
});

test("/renew N 一键续期更新 expireDate，无导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", number: "+1 234", cycle: 180, expireDate: "2026-12-31", platforms: "Telegram", remark: "test" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/renew 1"), env, {});
    const esims = JSON.parse(env.ESIM_DB.store.get("esim_list"));
    assert.equal(esims.length, 1);
    assert.equal(esims[0].name, "KnowRoaming");
    assert.equal(esims[0].number, "+1 234");
    assert.equal(esims[0].cycle, 180);
    assert.equal(esims[0].platforms, "Telegram");
    assert.equal(esims[0].remark, "test");

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 180);
    const expectedStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    assert.equal(esims[0].expireDate, expectedStr);
    assert.match(capture.messages.at(-1), /已续期/);
    const lastPayload = capture.payloads.at(-1);
    assert.ok(!lastPayload.reply_markup || !lastPayload.reply_markup.inline_keyboard, "/renew N 续期结果不应带导航键盘");
  } finally {
    capture.restore();
  }
});

test("/renew 无参数显示号码列表、续期提示和导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", cycle: 180, expireDate: "2026-12-31" },
      { id: "2", name: "Firsty", cycle: 90, expireDate: "2026-09-30" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/renew"), env, {});
    assert.match(capture.messages.at(-1), /回复序号直接续期/);
    assert.match(capture.messages.at(-1), /1\. KnowRoaming/);
    assert.match(capture.messages.at(-1), /2\. Firsty/);
    assert.ok(capture.payloads.at(-1).reply_markup && capture.payloads.at(-1).reply_markup.inline_keyboard, "/renew 无参数回复应带导航键盘");
  } finally {
    capture.restore();
  }
});

test("/renew 空列表提示没有号码，带导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]", [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/renew"), env, {});
    assert.match(capture.messages.at(-1), /还没有号码/);
    assert.ok(capture.payloads.at(-1).reply_markup && capture.payloads.at(-1).reply_markup.inline_keyboard, "/renew 空列表提示应带导航键盘");
  } finally {
    capture.restore();
  }
});

test("/renew 序号越界提示错误，无导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({
    esim_list: JSON.stringify([
      { id: "1", name: "KnowRoaming", cycle: 180, expireDate: "2026-12-31" },
    ]),
    [startKeyboardKey()]: todayString(),
  });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/renew 999"), env, {});
    assert.match(capture.messages.at(-1), /序号不正确/);
  } finally {
    capture.restore();
  }
});

test("授权用户每天首次交互时只显示一次底部 /start 一次性按钮", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]" });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/site"), env, {});
    await worker.fetch(telegramUpdate("/list"), env, {});

    const startKeyboardPayloads = capture.payloads.filter((payload) => payload.reply_markup && payload.reply_markup.keyboard);
    assert.equal(startKeyboardPayloads.length, 1);
    assert.deepEqual(startKeyboardPayloads[0].reply_markup, {
      keyboard: [[{ text: "/start" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
    assert.match(startKeyboardPayloads[0].text, /今天可使用底部按钮快速发送 \/start/);
    assert.equal(env.ESIM_DB.store.get(startKeyboardKey()), todayString());
  } finally {
    capture.restore();
  }
});

test("/site 返回网站访问链接并常驻导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({ [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

  try {
    const response = await worker.fetch(telegramUpdate("/site"), env, {});

    assert.equal(response.status, 200);
    assert.match(capture.messages.at(-1), /https:\/\/phone\.betony\.cc\.cd/);
    assert.ok(capture.payloads.at(-1).reply_markup && capture.payloads.at(-1).reply_markup.inline_keyboard, "/site 回复应带导航键盘");
  } finally {
    capture.restore();
  }
});

test("/add 流程中周期格式错误时不推进步骤，错误提示带导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({ esim_list: "[]", [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

  try {
    for (const text of ["/add", "KnowRoaming", "/skip", "abc"]) {
      const response = await worker.fetch(telegramUpdate(text), env, {});
      assert.equal(response.status, 200);
    }

    const session = JSON.parse(env.ESIM_DB.store.get("tg_session_12345"));
    assert.equal(session.step, "cycle");
    assert.match(capture.messages.at(-1), /周期格式不正确/);
    assert.ok(capture.payloads.at(-1).reply_markup && capture.payloads.at(-1).reply_markup.inline_keyboard, "/add 错误提示应带导航键盘");
  } finally {
    capture.restore();
  }
});

test("/cancel 清理当前 Telegram 添加会话，回复无导航键盘", async () => {
  const worker = await loadWorker();
  const env = createEnv({ [startKeyboardKey()]: todayString() });
  const capture = captureTelegramMessages();

  try {
    await worker.fetch(telegramUpdate("/add"), env, {});
    assert.equal(env.ESIM_DB.store.has("tg_session_12345"), true);

    const response = await worker.fetch(telegramUpdate("/cancel"), env, {});

    assert.equal(response.status, 200);
    assert.equal(env.ESIM_DB.store.has("tg_session_12345"), false);
    const lastPayload = capture.payloads.at(-1);
    assert.ok(!lastPayload.reply_markup || !lastPayload.reply_markup.inline_keyboard, "/cancel 回复不应带导航键盘");
  } finally {
    capture.restore();
  }
});

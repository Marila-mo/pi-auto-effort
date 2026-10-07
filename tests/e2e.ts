// Real Pi SDK + native provider conversion/streaming + loopback HTTP fixture.
// Synthetic vendor protocol responses are NOT live cache-hit evidence.
// @ts-nocheck
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { zstdDecompressSync } from "node:zlib";
import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const requests = [];
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let bytes = Buffer.concat(chunks);
  if (req.headers["content-encoding"] === "zstd")
    bytes = zstdDecompressSync(bytes);
  const body = JSON.parse(bytes.toString());
  requests.push({
    path: req.url,
    body,
    fixtureHeader: req.headers["x-fixture"],
  });
  if (body.model === "jev-latest") {
    const choices = Object.keys(body.questions.effort.criteria);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        model: "jev-latest",
        answers: {
          effort: {
            type: "choice",
            choice: "high",
            confidence: 0.95,
            probabilities: Object.fromEntries(
              choices.map((c) => [c, c === "high" ? 1 : 0]),
            ),
          },
        },
        usage: { input_tokens: 200, output_tokens: 0 },
      }),
    );
    return;
  }
  const judge = JSON.stringify(body).includes("EFFORT_SELECTOR_ONLY");
  const latestUser = (body.messages ?? body.input ?? []).findLast(
    (m) => m.role === "user",
  );
  const stateText =
    typeof latestUser?.content === "string"
      ? latestUser.content
      : (latestUser?.content ?? []).map((b) => b.text ?? "").join("");
  const judgeState = judge ? JSON.parse(stateText) : {};
  if (
    judge &&
    /cancel-selector|timeout-selector/u.test(String(judgeState.request))
  )
    await new Promise((resolve) => setTimeout(resolve, 1000));
  const text = judge
    ? String(judgeState.request).includes("bad-answer")
      ? "invalid JSON"
      : JSON.stringify({
          effort:
            String(judgeState.request).includes("complex") ||
            judgeState.phase === "execution"
              ? "high"
              : "medium",
          confidence: 0.95,
        })
    : "OK";
  const id = "m_" + requests.length;
  res.setHeader("content-type", "text/event-stream");
  if (body.messages) {
    const message = {
      id,
      type: "message",
      role: "assistant",
      model: body.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 200000,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    };
    const events = [["message_start", { type: "message_start", message }]];
    if (judge)
      events.push(
        [
          "content_block_start",
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
          },
        ],
        [
          "content_block_delta",
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "Fixture reasoning." },
          },
        ],
        [
          "content_block_delta",
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "signature_delta", signature: "fixture-signature" },
          },
        ],
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
      );
    const index = judge ? 1 : 0;
    events.push(
      [
        "content_block_start",
        {
          type: "content_block_start",
          index,
          content_block: { type: "text", text: "" },
        },
      ],
      [
        "content_block_delta",
        {
          type: "content_block_delta",
          index,
          delta: { type: "text_delta", text },
        },
      ],
      ["content_block_stop", { type: "content_block_stop", index }],
      [
        "message_delta",
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: 10 },
        },
      ],
      ["message_stop", { type: "message_stop" }],
    );
    for (const [event, data] of events)
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } else {
    if (judge)
      res.write(
        `data: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: { id: "thought_" + id, type: "reasoning", summary: [{ type: "summary_text", text: "Fixture reasoning." }] } })}\n\n`,
      );
    const item = {
      id,
      type: "message",
      role: "assistant",
      phase: "final_answer",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    };
    for (const event of [
      { type: "response.created", response: { id: "r_" + id } },
      { type: "response.output_item.done", output_index: 0, item },
      {
        type: "response.completed",
        response: {
          id: "r_" + id,
          model: body.model,
          status: "completed",
          output: [item],
          usage: {
            input_tokens: 200000,
            input_tokens_details: { cached_tokens: 180000 },
            output_tokens: 10,
          },
        },
      },
    ])
      res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const originalFetch = globalThis.fetch;
const originalDir = process.env.PI_CODING_AGENT_DIR;
const dir = await mkdtemp(join(tmpdir(), "pi-auto-effort-e2e-"));
const results = [];
const warmReceipts = [];
let session;
try {
  process.env.PI_CODING_AGENT_DIR = dir;
  globalThis.fetch = (url, init) => {
    const parsed = new URL(
      typeof url === "string" ? url : url instanceof URL ? url.href : url.url,
    );
    if (
      ![
        "chatgpt.com",
        "api.openai.com",
        "api.anthropic.com",
        "api.typesafe.ai",
      ].includes(parsed.hostname)
    )
      throw new Error("External traffic blocked");
    return originalFetch(`http://127.0.0.1:${port}${parsed.pathname}`, init);
  };
  await writeFile(
    join(dir, "pi-auto-effort.json"),
    JSON.stringify({ minEffort: "medium", timeoutMs: 500 }),
  );
  const claim = {
    "https://api.openai.com/auth": { chatgpt_account_id: "isolated_fixture" },
  };
  const jwt = `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(claim)).toString("base64url")}.fixture`;
  await writeFile(
    join(dir, "auth.json"),
    JSON.stringify({
      "openai-codex": {
        type: "oauth",
        access: jwt,
        refresh: "fixture",
        expires: Date.now() + 3600000,
        accountId: "isolated_fixture",
      },
      anthropic: { type: "api_key", key: "sk-ant-fixture-not-a-real-secret" },
      typesafe: { type: "api_key", key: "fixture-typesafe-key" },
      openai: { type: "api_key", key: "sk-fixture-openai-not-real" },
    }),
  );
  const gptIds = ["gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol"];
  const overrides = Object.fromEntries(
    gptIds.map((id) => [
      id,
      {
        promptCache: { short: 12, long: 12 },
        cost: { input: 10, output: 10, cacheRead: 0.1, cacheWrite: 0 },
      },
    ]),
  );
  await writeFile(
    join(dir, "models.json"),
    JSON.stringify({
      providers: {
        "openai-codex": { modelOverrides: overrides },
        openai: { modelOverrides: overrides },
        anthropic: {
          modelOverrides: Object.fromEntries(
            ["claude-opus-5", "claude-opus-5-5", "claude-sonnet-5-5"].map(
              (id) => [
                id,
                {
                  promptCache: { short: 12, long: 12 },
                  cost: {
                    input: 10,
                    output: 10,
                    cacheRead: 0.1,
                    cacheWrite: 0,
                  },
                },
              ],
            ),
          ),
        },
      },
    }),
  );
  await writeFile(
    join(dir, "preceding.ts"),
    `export default function(pi) { pi.on('message_end', event => event.message.role === 'assistant' ? {message:{...event.message,content:[...event.message.content]}} : undefined); pi.on('before_provider_request', event => { const p=event.payload; const latest=(p.messages??p.input??[]).findLast(m=>m.role==='user'); const part=Array.isArray(latest?.content)?latest.content.filter(c=>c.type==='text'||c.type==='input_text').at(-1)?.text:latest?.content; const text=String(part??''); if(p.messages && text.endsWith('invalid-header')) p.betas=[]; if(text.endsWith('foreign-model')) p.model='foreign-model-id'; if(p.input && text.endsWith('foreign-update')) p.input.push({type:'configuration_update',reasoning:{effort:'high'}}); }); }`,
  );
  const models = await ModelRuntime.create({
    authPath: join(dir, "auth.json"),
    modelsPath: join(dir, "models.json"),
    modelsStorePath: join(dir, "models-store.json"),
  });
  const nativeStream = models.streamSimple.bind(models);
  models.streamSimple = (model, context, options) => {
    const stream = nativeStream(model, context, options);
    if (options?.maxTokens === 1)
      void stream.result().then((message) =>
        warmReceipts.push({
          model: model.id,
          stopReason: message.stopReason,
          error: message.errorMessage,
        }),
      );
    return stream;
  };
  for (const [provider, id] of [
    ...gptIds.map((id) => ["openai-codex", id]),
    ...gptIds.map((id) => ["openai", id]),
    ["anthropic", "claude-opus-5"],
    ["anthropic", "claude-opus-5-5"],
    ["anthropic", "claude-sonnet-5-5"],
  ]) {
    const settings = SettingsManager.inMemory({
      transport: "sse",
      cacheWarming: "off",
      retry: { enabled: false },
      compaction: { enabled: false, keepRecentTokens: 0, reserveTokens: 4096 },
    });
    const createServices = () =>
      createAgentSessionServices({
        cwd: dir,
        agentDir: dir,
        modelRuntime: models,
        settingsManager: settings,
        resourceLoaderOptions: {
          additionalExtensionPaths: [
            join(dir, "preceding.ts"),
            join(process.cwd(), "src/index.ts"),
          ],
          noContextFiles: true,
          noSkills: true,
          noThemes: true,
          noPromptTemplates: true,
        },
      });
    const services = await createServices();
    assert.deepEqual(services.resourceLoader.getExtensions().errors, []);
    const created = await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.create(dir, join(dir, "sessions")),
      tools: [],
      model: models.getModel(provider, id),
      thinkingLevel: "medium",
    });
    session = created.session;
    await session.bindExtensions({});
    const captured = [];
    for (const prompt of [
      "routine task",
      "complex task",
      "routine next task",
    ]) {
      const start = requests.length;
      await session.prompt(prompt);
      const assistant = session.messages.findLast(
        (m) => m.role === "assistant",
      );
      assert.notEqual(assistant.stopReason, "error", assistant.errorMessage);
      assert.equal(assistant.model, id);
      assert.equal(session.model.id, id);
      assert.equal(
        assistant.providerThinkingLevel,
        prompt.includes("complex") ? "high" : "medium",
      );
      assert.equal(
        assistant.thinkingLevel,
        prompt.includes("complex") ? "high" : "medium",
        "effective metadata survives preceding replacement",
      );
      const calls = requests.slice(start);
      assert.equal(calls.length, 2, "one isolated judge and one main request");
      const main = calls.at(-1).body;
      if (provider !== "anthropic") {
        assert.equal(main.reasoning.effort, "medium");
        if (captured.length)
          assert.deepEqual(
            main.input.slice(0, captured.at(-1).input.length),
            captured.at(-1).input,
          );
      } else {
        assert.equal(main.output_config.effort, "high");
        assert.equal(
          main.messages.findLast((m) => m.output_config)?.output_config.effort,
          prompt.includes("complex") ? "high" : "medium",
        );
      }
      captured.push(main);
    }
    const before = requests.length;
    await session.prompt("/auto-effort off");
    await session.prompt("disabled task");
    assert.equal(
      requests.length,
      before + 1,
      "disabled auto does not call judge",
    );
    assert.ok(
      !JSON.stringify(session.messages).includes("EFFORT_SELECTOR_ONLY"),
      "judge never enters task history",
    );
    for (const requested of ["minimal", "off"]) {
      session.setThinkingLevel(requested);
      const manualLevel = session.thinkingLevel; // Pi clamps unsupported manual levels.
      const manualStart = requests.length;
      await session.prompt(`manual ${requested} task`);
      assert.equal(
        requests.length,
        manualStart + 1,
        "manual levels dispatch without a judge",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant").thinkingLevel,
        manualLevel,
      );
      const manual = requests.at(-1).body;
      assert.equal(
        provider !== "anthropic"
          ? (manual.input.findLast((m) => m.type === "configuration_update")
              ?.reasoning.effort ?? manual.reasoning?.effort)
          : manual.messages.findLast((m) => m.output_config)?.output_config
              .effort,
        manualLevel === "off" ? "none" : "low",
      );
    }
    await session.prompt("/auto-effort on");
    const retainedManual = session.messages.findLast(
      (m) => m.role === "assistant",
    ).providerThinkingLevel;
    const retainedStart = requests.length;
    await session.prompt("bad-answer retain manual off");
    assert.equal(
      requests.length,
      retainedStart + 2,
      "failed judge retains native off and still dispatches main generation",
    );
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      retainedManual,
    );
    if (retainedManual === "off") {
      const deadlineStart = requests.length;
      await session.prompt("timeout-selector retain off");
      assert.equal(
        requests.length,
        deadlineStart + 2,
        "deadline retains off and dispatches without retry",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant")
          .providerThinkingLevel,
        "off",
      );
    }
    await session.prompt("complex before failure");
    await session.prompt("bad-answer");
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
      "invalid judge retains current effective effort",
    );
    await session.reload();
    await session.bindExtensions({}); // Headless SDK has no UI bindings to auto-emit session_start on reload.
    await session.prompt("complex after reload");
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
    );
    const baselineConfig = JSON.parse(
      await readFile(join(dir, "models.json"), "utf8"),
    );
    const changedConfig = structuredClone(baselineConfig);
    changedConfig.providers[provider].headers = { "x-fixture": "changed" };
    await writeFile(join(dir, "models.json"), JSON.stringify(changedConfig));
    await models.refresh({ allowNetwork: false });
    await session.prompt("complex refreshed config");
    assert.equal(
      requests.at(-1).fixtureHeader,
      "changed",
      "current provider configuration applies once after refresh",
    );
    await writeFile(join(dir, "models.json"), JSON.stringify(baselineConfig));
    await models.refresh({ allowNetwork: false });
    await session.prompt("complex removed config");
    assert.equal(
      requests.at(-1).fixtureHeader,
      undefined,
      "removed configuration is not retained in captured delegates",
    );
    if (id === "gpt-6-astra" || id === "claude-opus-5") {
      const timeoutStart = requests.length;
      await session.prompt("timeout-selector");
      assert.equal(
        requests.length,
        timeoutStart + 2,
        "deadline falls back once without retry",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant")
          .providerThinkingLevel,
        "high",
      );
      const cancelledStart = requests.length;
      const operation = session.prompt("cancel-selector");
      const cancellationDeadline = Date.now() + 1000;
      while (
        requests.length === cancelledStart &&
        Date.now() < cancellationDeadline
      )
        await new Promise((resolve) => setTimeout(resolve, 10));
      await session.abort();
      await operation;
      assert.equal(
        requests.length,
        cancelledStart + 1,
        "cancelling the judge never dispatches generation",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant").stopReason,
        "aborted",
      );
    }
    const compactStart = requests.length;
    await session.compact();
    assert.ok(
      requests.length > compactStart,
      "native compaction makes a summary request",
    );
    assert.ok(
      requests
        .slice(compactStart)
        .every((r) => !JSON.stringify(r.body).includes("EFFORT_SELECTOR_ONLY")),
      "native compaction bypasses the selector, including split-turn summaries",
    );
    assert.ok(
      session.sessionManager.getBranch().some((e) => e.type === "compaction"),
    );
    await session.prompt("complex after compaction");
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
    );
    const firstUser = session.sessionManager
      .getBranch()
      .find((e) => e.type === "message" && e.message.role === "user");
    const navigation = await session.navigateTree(firstUser.id, {
      summarize: false,
    });
    assert.equal(navigation.cancelled, false);
    await session.prompt("complex after tree branch");
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
    );
    const reopened = SessionManager.open(
      session.sessionManager.getSessionFile(),
      join(dir, "sessions"),
    );
    assert.ok(
      reopened
        .getBranch()
        .some(
          (e) => e.type === "custom" && e.customType === "pi-auto-effort/v1",
        ),
    );
    assert.equal(
      reopened
        .getBranch()
        .findLast((e) => e.type === "message" && e.message.role === "assistant")
        .message.providerThinkingLevel,
      "high",
    );
    await session.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    });
    session.dispose();
    const resumedServices = await createServices();
    session = (
      await createAgentSessionFromServices({
        services: resumedServices,
        sessionManager: reopened,
        tools: [],
        model: models.getModel(provider, id),
        thinkingLevel: "medium",
      })
    ).session;
    await session.bindExtensions({});
    const resumeStart = requests.length;
    await session.prompt("complex persisted resume");
    assert.equal(requests.length, resumeStart + 2);
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
    );
    const originalSessionId = session.sessionManager.getSessionId();
    const forked = SessionManager.forkFrom(
      session.sessionManager.getSessionFile(),
      dir,
      join(dir, "sessions"),
    );
    assert.notEqual(forked.getSessionId(), originalSessionId);
    await session.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    });
    session.dispose();
    session = (
      await createAgentSessionFromServices({
        services: await createServices(),
        sessionManager: forked,
        tools: [],
        model: models.getModel(provider, id),
        thinkingLevel: "medium",
      })
    ).session;
    await session.bindExtensions({});
    await session.prompt("complex new-file fork");
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant")
        .providerThinkingLevel,
      "high",
    );
    const changedModelStart = requests.length;
    await session.prompt("foreign-model");
    assert.equal(
      requests.length,
      changedModelStart + 1,
      "a foreign model rewrite never dispatches generation",
    );
    assert.equal(
      session.messages.findLast((m) => m.role === "assistant").stopReason,
      "error",
    );
    if (provider === "anthropic") {
      await session.prompt("/auto-effort warming inherit");
      session.setCacheWarmingMode("idle");
      const warmStart = requests.length;
      await session.prompt("complex warm task");
      const main = requests.at(-1).body;
      const historySize = session.messages.length;
      const deadline = Date.now() + 8000;
      while (
        !session.sessionManager
          .getBranch()
          .some((e) => e.type === "usage" && e.kind === "cache_warm") &&
        Date.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 100));
      session.setCacheWarmingMode("off");
      assert.equal(
        requests.length,
        warmStart + 3,
        "Anthropic warming bypasses selector",
      );
      assert.deepEqual(
        requests.at(-1).body.messages,
        main.messages,
        "native historical effort and full message prefix survive warming",
      );
      assert.equal(session.messages.length, historySize);
      assert.ok(
        session.sessionManager
          .getBranch()
          .some((e) => e.type === "usage" && e.kind === "cache_warm"),
      );
      const start = requests.length;
      await session.prompt("invalid-header");
      assert.equal(
        requests.length,
        start + 1,
        "invalid final beta payload never dispatches generation",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant").stopReason,
        "error",
      );
    } else {
      await session.prompt("/auto-effort jev typesafe/jev-latest");
      const start = requests.length;
      await session.prompt("Jev task");
      assert.equal(requests.length, start + 2);
      assert.equal(requests[start].body.model, "jev-latest");
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant")
          .providerThinkingLevel,
        "high",
      );
      await session.prompt("/auto-effort root");
      await session.prompt("/auto-effort warming inherit");
      session.setCacheWarmingMode("idle");
      const warmStart = requests.length;
      await session.prompt("complex warm task");
      const main = requests.at(-1).body;
      const historySize = session.messages.length;
      const deadline = Date.now() + 8000;
      while (requests.length < warmStart + 3 && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        requests.length,
        warmStart + 3,
        `one judge/main/warm, no judge during warming: ${JSON.stringify({ status: session.cacheWarmingStatus, warmReceipts })}`,
      );
      const warmed = requests.at(-1).body;
      assert.deepEqual(warmed.input.slice(0, main.input.length), main.input);
      assert.equal(
        session.messages.length,
        historySize,
        "maintenance messages never enter task history",
      );
      assert.ok(
        session.sessionManager
          .getBranch()
          .some((e) => e.type === "usage" && e.kind === "cache_warm"),
      );
      session.setCacheWarmingMode("off");
      const unsafeStart = requests.length;
      await session.prompt("foreign-update");
      assert.equal(
        requests.length,
        unsafeStart + 1,
        "foreign update ownership fails before generation",
      );
      assert.equal(
        session.messages.findLast((m) => m.role === "assistant").stopReason,
        "error",
      );
    }
    results.push({
      provider,
      model: id,
      status: "PASS",
      scenarios: [
        "effort transitions",
        "thinking-block judge",
        "preceding message replacement",
        "disable/manual minimal+off and failure retention",
        "invalid judge fallback",
        "reload replay",
        "final model identity rejection",
        "configuration refresh/removal",
        "native compaction, tree branch, persistent runtime resume and new-file fork",
        ...(id === "gpt-6-astra" || id === "claude-opus-5"
          ? ["selector deadline and abort"]
          : []),
        provider === "anthropic"
          ? "native Anthropic warming and final-beta rejection"
          : "native Jev, warming and foreign-update rejection",
      ],
      liveVendorCache: "NOT RUN",
    });
    await session.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    });
    session.dispose();
    session = undefined;
    models.unregisterProvider(provider);
  }
} catch (error) {
  results.push({
    status: "FAIL",
    error: error instanceof Error ? error.message : "unknown error",
    stack:
      error instanceof Error
        ? error.stack?.replaceAll(process.cwd(), "<repo>")
        : undefined,
    recentRequestKinds: requests.slice(-4).map((r) => ({
      path: r.path,
      model: r.body.model,
      judge: JSON.stringify(r.body).includes("EFFORT_SELECTOR_ONLY"),
    })),
  });
  process.exitCode = 1;
} finally {
  session?.dispose();
  globalThis.fetch = originalFetch;
  if (originalDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalDir;
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/e2e-${Date.now()}.json`,
    JSON.stringify(
      {
        revision: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        workingTreeDirty: Boolean(
          execFileSync("git", ["status", "--porcelain"], {
            encoding: "utf8",
          }).trim(),
        ),
        node: process.version,
        pi: "1.0.4",
        command: "npm run test:e2e",
        setup:
          "disposable agent directory, synthetic auth, loopback protocol server; all external traffic blocked",
        cleanup: "server closed and disposable agent directory removed",
        expected:
          "fixed model, effective effort, stable OpenAI prefix, native Claude changes and disabled selector",
        results,
        vendorEvidence:
          "NOT RUN: isolated protocol fixture is not real vendor cache evidence",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
}

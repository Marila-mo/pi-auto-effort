// Real Pi catalog refresh, extension lifecycle and request conversion; loopback only.
// @ts-nocheck
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import {
  ModelRuntime,
  SessionManager,
  SettingsManager,
  createAgentSessionServices,
  createAgentSessionFromServices,
} from "@earendil-works/pi-coding-agent";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const patch = execFileSync(
  "git",
  ["diff", "HEAD", "--", "src", "tests", "package.json", "package-lock.json"],
  { encoding: "utf8" },
);
const targets = ["openai-codex", "openai", "anthropic"];
const natives = builtinProviders();
const templates = Object.fromEntries(
  targets.map((id) => [
    id,
    natives
      .find((p) => p.id === id)
      .getModels()
      .find(
        (m) => m.id === (id === "anthropic" ? "claude-opus-5" : "gpt-6.1-sol"),
      ),
  ]),
);
let phase = 0;
const receipts = [];
const server = createServer((req, res) => {
  const provider = decodeURIComponent(
    new URL(req.url, "http://fixture").pathname.split("/").at(-1),
  );
  assert.ok(targets.includes(provider));
  receipts.push({ provider, phase });
  const base = structuredClone(templates[provider]);
  const models =
    phase === 2
      ? []
      : [
          {
            ...base,
            contextWindow: base.contextWindow + 1000 * (phase + 1),
            cost: {
              input: 7 + phase,
              output: 11,
              cacheRead: 0.2,
              cacheWrite: 0,
            },
          },
          {
            ...base,
            id: `remote-only-${phase}`,
            name: "Synthetic remote-only model",
          },
          {
            ...base,
            id: "mixed-api",
            api:
              provider === "anthropic"
                ? "anthropic-messages"
                : "openai-completions",
            name: "Synthetic other API",
          },
          {
            type: "classifier",
            id: "mixed-operation",
            provider,
            api: "fixture-classifier",
            name: "Synthetic classifier",
            baseUrl: "https://fixture.invalid",
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 64000,
          },
          {
            type: "image",
            id: "mixed-operation",
            provider,
            api: "fixture-images",
            name: "Synthetic image",
            baseUrl: "https://fixture.invalid",
            input: ["text"],
            output: ["image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        ];
  res.setHeader("content-type", "application/json");
  res.setHeader("last-modified", "Fri, 01 Jan 2100 00:00:00 GMT");
  res.setHeader("etag", `"phase-${phase}"`);
  res.end(JSON.stringify({ models }));
});
const dir = await mkdtemp(join(tmpdir(), "pi-auto-effort-catalog-"));
const beforeDir = process.env.PI_CODING_AGENT_DIR;
const beforeFetch = globalThis.fetch;
const results = [];
let session;
try {
  process.env.PI_CODING_AGENT_DIR = dir;
  await writeFile(
    join(dir, "pi-auto-effort.json"),
    JSON.stringify({ minEffort: "medium", warming: "off" }),
  );
  const settings = SettingsManager.inMemory({
    cacheWarming: "off",
    retry: { enabled: false },
    compaction: { enabled: false },
  });
  const config = {
    providers: Object.fromEntries(
      targets.map((p) => [
        p,
        { apiKey: "fixture-old", headers: { "x-fixture": "old" } },
      ]),
    ),
  };
  const configPath = join(dir, "models.json");
  await writeFile(configPath, JSON.stringify(config));
  const address = await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address())),
  );
  const url = `http://127.0.0.1:${address.port}`;
  globalThis.fetch = (input, options) => {
    const requested = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (requested.origin !== url)
      throw new Error("External traffic forbidden by catalog fixture");
    return beforeFetch(input, options);
  };
  async function runtime(name) {
    await mkdir(join(dir, name));
    await writeFile(join(dir, name, "auth.json"), "{}");
    return ModelRuntime.create({
      authPath: join(dir, name, "auth.json"),
      modelsPath: configPath,
      modelsStorePath: join(dir, name, "catalog.json"),
      catalogBaseUrl: url,
    });
  }
  const control = await runtime("control"),
    subject = await runtime("subject");
  const list = (r) =>
    [...r.getAllModels()]
      .map((m) => structuredClone(m))
      .sort((a, b) =>
        `${a.provider}/${a.type ?? "chat"}/${a.id}`.localeCompare(
          `${b.provider}/${b.type ?? "chat"}/${b.id}`,
        ),
      );
  async function refresh(network = true) {
    for (const r of [control, subject]) {
      const result = await r.refresh({
        providers: targets,
        allowNetwork: network,
        force: true,
      });
      assert.equal(result.errors.size, 0, "synthetic catalog refresh succeeds");
    }
  }
  await refresh();
  assert.deepEqual(list(subject), list(control));
  assert.ok(subject.getModel("openai", "remote-only-0"));
  const services = await createAgentSessionServices({
    cwd: dir,
    agentDir: dir,
    modelRuntime: subject,
    settingsManager: settings,
    resourceLoaderOptions: {
      additionalExtensionPaths: [join(process.cwd(), "src/index.ts")],
      noContextFiles: true,
      noSkills: true,
      noThemes: true,
      noPromptTemplates: true,
    },
  });
  assert.deepEqual(services.resourceLoader.getExtensions().errors, []);
  session = (
    await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.inMemory(dir),
      tools: [],
      model: subject.getModel("openai-codex", "gpt-6.1-sol"),
      thinkingLevel: "medium",
    })
  ).session;
  await session.bindExtensions({});
  await refresh(false);
  assert.deepEqual(
    list(subject),
    list(control),
    "loading extension must preserve normal Pi catalogs across every operation/API",
  );
  results.push({
    scenario:
      "load preserves cached remote models and unrelated APIs/operations",
    status: "PASS",
  });
  phase = 1;
  await refresh();
  assert.deepEqual(list(subject), list(control));
  assert.equal(subject.getModel("openai", "remote-only-0"), undefined);
  assert.ok(subject.getModel("openai", "remote-only-1"));
  results.push({
    scenario: "remote additions/removal, capability and price refresh",
    status: "PASS",
  });
  for (const provider of targets) {
    config.providers[provider].apiKey = "fixture-new";
    config.providers[provider].headers = { "x-fixture": "new" };
  }
  await writeFile(configPath, JSON.stringify(config));
  await refresh(false);
  for (const provider of targets) {
    const auth = await subject.getAuth(templates[provider]);
    assert.equal(auth.auth.apiKey, "fixture-new");
    assert.equal(auth.auth.headers?.["x-fixture"], "new");
  }
  for (const provider of targets) delete config.providers[provider];
  await writeFile(configPath, JSON.stringify(config));
  await refresh(false);
  for (const provider of targets)
    assert.equal(
      await subject.getAuth(templates[provider]),
      undefined,
      "removed synthetic key/header never survives in captured composition",
    );
  assert.deepEqual(list(subject), list(control));
  results.push({
    scenario: "current auth/header overrides applied and removed",
    status: "PASS",
  });
  // Raw same-API requests must retain native options, without any outbound call.
  for (const [provider, raw] of [
    ["openai", { reasoningEffort: "high" }],
    ["anthropic", { thinkingEnabled: true, effort: "high" }],
  ]) {
    config.providers[provider] = { apiKey: "fixture-raw" };
    await writeFile(configPath, JSON.stringify(config));
    await refresh(false);
    let payload;
    const response = await subject
      .stream(
        subject.getModel(provider, templates[provider].id),
        {
          messages: [
            { role: "user", content: "fixture", timestamp: Date.now() },
          ],
        },
        {
          ...raw,
          onPayload: (p) => {
            payload = p;
            throw new Error("fixture pre-send stop");
          },
        },
      )
      .result();
    assert.equal(response.stopReason, "error");
    assert.ok(payload);
    assert.equal(
      provider === "openai"
        ? payload.reasoning?.effort
        : payload.messages.findLast((m) => m.output_config)?.output_config
            .effort,
      "high",
      "raw API options survive passthrough",
    );
  }
  results.push({
    scenario: "same-API native raw stream passthrough",
    status: "PASS",
  });
  const offPayloads=[];
  for(const runtime of [control,subject]) {
    const model={...runtime.getModel('anthropic','mixed-api'),contextWindow:4096};
    await runtime.streamSimple(model,{messages:[{role:'user',content:'synthetic '.repeat(1500),timestamp:0}]},{onPayload:p=>{offPayloads.push(p);throw new Error('fixture stop');}}).result();
  }
  assert.equal(offPayloads.length,2,'both native payload hooks were reached');
  assert.deepEqual(offPayloads[1],offPayloads[0],'unmanaged simple-off retains native context budget/normalization');
  phase = 2;
  await refresh();
  assert.deepEqual(list(subject), list(control));
  assert.equal(subject.getModel("openai", "remote-only-1"), undefined);
  await session.reload();
  await session.bindExtensions({});
  await refresh(false);
  assert.deepEqual(list(subject), list(control));
  subject.registerProvider("openai", { headers: { "x-late": "fixture" } });
  await session.extensionRunner.emit({
    type: "session_shutdown",
    reason: "quit",
  });
  assert.equal(
    subject.getRegisteredProviderConfig("openai")?.headers?.["x-late"],
    "fixture",
    "shutdown never removes a later additive registration",
  );
  session.dispose();
  session = undefined;
  await refresh(false);
  assert.deepEqual(list(subject), list(control));
  results.push({
    scenario:
      "empty remote catalog, reload and unload preserve normal behavior",
    status: "PASS",
  });
} catch (error) {
  results.push({
    status: "FAIL",
    error: error instanceof Error ? error.message : "unknown",
    stack:
      error instanceof Error
        ? error.stack
            ?.replaceAll(process.cwd(), "<repo>")
            .replaceAll(dir, "<fixture>")
        : undefined,
  });
  process.exitCode = 1;
} finally {
  if (session) {
    await session.extensionRunner.emit({
      type: "session_shutdown",
      reason: "quit",
    });
    session.dispose();
  }
  globalThis.fetch = beforeFetch;
  if (beforeDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = beforeDir;
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
  await mkdir("artifacts", { recursive: true });
  const stamp = Date.now();
  // The harness snapshot and scoped patch preserve dirty-run reproduction, including failures.
  await writeFile(
    `artifacts/catalog-${stamp}.ts`,
    await readFile(new URL(import.meta.url), "utf8"),
  );
  await writeFile(`artifacts/catalog-${stamp}.patch`, patch);
  await writeFile(
    `artifacts/catalog-${stamp}.json`,
    JSON.stringify(
      {
        revision,
        node: process.version,
        pi: "1.0.4",
        command: "npx tsx tests/catalog-e2e.ts",
        setup:
          "empty synthetic auth, shared models.json, independently stored catalogs, isolated agent dir, loopback catalog; no vendor requests",
        cleanup: "server closed, env/fetch restored, fixture removed",
        expected:
          "subject preserves unmodified control catalog, current config/auth refresh, and unrelated model APIs/types",
        fixtureLastModified:
          "synthetic2100, guarantees newer than bundled catalog",
        harness: `catalog-${stamp}.ts`,
        scopedPatch: `catalog-${stamp}.patch`,
        receipts,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
}

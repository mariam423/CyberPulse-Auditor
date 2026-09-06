# CyberPulse Auditor — Architecture & Planning Document

> **Status:** Living document — produced as the first deliverable of Phase 1 (Core Initialization & Setup).
> **Owner:** CyberPulse engineering.
> **Audience:** contributors, integrators, and reviewers of the multi-agent system.

---

## 0. وثيقة المرجع (Authoring Provenance)

This document is structured around the four sections requested by the product specification:

1. Product Vision & Scope.
2. Functional & Technical Requirements.
3. System Architecture (with **QwenPaw** as the multi-agent orchestration framework).
4. Task Breakdown & Roadmap.

### 0.1 المهارات المرجعية (Authoring Skills — referenced)

The following skills informed the structure of this document. **Important:** these skills are *not available in the current session environment* (the local `~/.claude/skills/` directory does not contain them, and no `QwenPaw` framework artifacts are installed on disk). They are therefore referenced here as the *intended authoring contract* — the structural model the document follows — not as a runtime dependency. If the user later installs these skills, the sections below should be re-validated against their exact guidance.

| Skill | Role in this document | Where applied |
|---|---|---|
| `product-manager-pro.md` | Defines the product vision framing, success metrics, and scope guard-rails. | §1 (Vision & Scope) and the success-criteria checklist at the end. |
| `requirements-engineer.md` | Shapes the requirement catalogue: functional, non-functional, constraints, and acceptance criteria. | §2 (Functional & Technical Requirements). |
| `omc-architect.md` | Lays out the high-level architecture and the rationale for the agent decomposition. | §3.1–§3.4 (System Architecture). |
| `system-design-pro.md` | Drives the detailed system design: components, interfaces, data flow, and non-functional concerns. | §3.5–§3.12 (Components, Data, APIs, Failure Modes). |
| `omc-multi-agent` | Defines the multi-agent topology, message contracts, and the role/persona split. | §3.4 (Agent roles) and §3.6 (Inter-agent protocol). |
| `planner-pro-max.md` | Drives the roadmap decomposition, dependency graph, and milestone gates. | §4 (Task Breakdown & Roadmap). |
| `ralplan` | Iterative plan/act/refine loop for the closed-loop security cycle. | §3.7 (Closed-Loop State Machine) and §4.4 (Phase 4). |

> If any of these skills are later installed and disagree with this document, the **skill is the source of truth** and this file should be updated to match.

### 0.2 الافتراضات الصريحة (Explicit assumptions)

Because the `QwenPaw` framework is not available in the current environment, the following assumptions are made explicit so they can be reviewed:

1. **QwenPaw is the single multi-agent runtime** — every agent (Orchestrator, Attacker, Defender, Validator) is implemented as a QwenPaw agent, and the closed-loop state machine is encoded as a QwenPaw graph/workflow.
2. **QwenPaw is LLM-provider-agnostic** — the system uses an OpenAI-compatible provider by default, but a `ModelProvider` interface isolates the choice.
3. **QwenPaw supports the four required primitives**: a *tool/function-calling* mechanism (for `TargetAdapter` invocations), *persistent shared state* (for the audit trail), *deterministic step ordering* (so retests are reproducible), and *interrupt / resume* (so a human can approve a remediation before it is applied).
4. If any of (1)–(3) turn out to be unsupported by the actual QwenPaw release, the corresponding section must be revised before implementation starts.

### 0.3 حالة QwenPaw في هذه البيئة (QwenPaw availability status)

A targeted check was performed before drafting the architecture:

- `~/.claude/skills/` and `~/.claude/plugins/` do not contain any `QwenPaw` artifacts.
- `npm view qwenpaw`, `npm view @qwenpaw/core`, and `npm view qwen-paw` all return no published package.
- The only references to "QwenPaw" anywhere on the system are in the user's own prompts (this session).

**Therefore, the design treats QwenPaw as a logical / contractual name, not as an installed dependency.** Concretely, the runtime shape is:

```
       ┌──────────────────────────────────────────┐
       │           Custom Orchestrator           │  ← TypeScript state machine,
       │  (policy, gates, budgets, retries,      │     authored in this repo,
       │   inter-step coordination, reporting)    │     owns the closed-loop
       └────────────────────┬─────────────────────┘     guarantees.
                            │  delegates to
                            ▼
       ┌──────────────────────────────────────────┐
       │       QwenPaw Agent Runtime (core)      │  ← the multi-agent kernel:
       │  hosts the 4 agents, shared blackboard, │     agents, shared state,
       │  tool/function-calling, step ordering,   │     tool calls, ordering,
       │  interrupt/resume                        │     interrupt/resume.
       └──────────────────────────────────────────┘
```

**QwenPaw is the kernel; the Custom Orchestrator is the policy layer above it.** All agents (Orchestrator, Attacker, Defender, Validator) are QwenPaw agents. The Custom Orchestrator is a QwenPaw *workflow* plus the policy code that lives outside the kernel (severity gates, retry budgets, the report generators, and the SQLite-backed audit trail).

**If a real QwenPaw package appears later**, the only file that needs to change is `src/orchestrator/qwenpaw-adapter.ts` (the thin mapping between QwenPaw's API and our workflow contract). The four agents, the closed-loop state machine, the OWASP evaluator, and the rest of the system remain unchanged.

If QwenPaw does **not** exist as a public package, the same adapter file becomes the *implementation* of the QwenPaw contract (in-repo), so the architecture is identical from the outside.

---

## 1. Product Vision & Scope (رؤية المنتج ونطاقه)

### 1.1 التعريف (Definition)

**CyberPulse Auditor** is a multi-agent security copilot that analyses, attacks, classifies, repairs, and re-verifies LLM-based applications against the **OWASP Top 10 for LLM Applications** (LLM01–LLM10).

It is delivered as a CLI tool with a library surface, so it can be run manually, wired into CI, or embedded inside another product.

### 1.2 دورة الحياة الأمنية المغلقة (Closed-Loop Security Cycle)

The system's distinguishing capability is that it does **not stop at detection**. Every finding is pushed through the full cycle:

```
   Reconnaissance
        │
        ▼
  Dynamic Red-Teaming  ──►  OWASP Classification  ──►  Auto-Remediation
        ▲                                                       │
        │                                                       ▼
        └──────────────  Retest Verification  ◄──────────────────┘
                              │
                              ▼
                       Closure Report
```

Each cycle either closes the finding (with reproducible evidence) or feeds it back to the Attacker for a new attempt. This is the **ralplan** loop: *plan → act → observe → refine*.

### 1.3 In-scope

- Red-teaming of LLM apps reachable through a target adapter (HTTP, OpenAI-compatible, Python callable).
- OWASP LLM01–LLM10 detection and severity scoring (Critical / High / Medium).
- Auto-remediation: system-prompt hardening **and** code-level patches with Zod validation.
- CLI and library APIs.
- Reports in Markdown, SARIF 2.1.0, and JSON.

### 1.4 Out-of-scope (v1)

- Non-LLM application security (handled by other tools).
- Runtime deployment / infra hardening beyond the LLM app boundary.
- Compliance certifications (the tool *produces* evidence; certification is the operator's responsibility).
- Adversarial ML at the model-weight level (e.g., weight-poisoning detection).

### 1.5 Success criteria

A release is considered successful when, on the seeded vulnerable fixture:

- A single `cyberpulse audit` command produces a report covering all 10 OWASP categories.
- Every Critical/High finding is accompanied by a *closed* retest record with evidence.
- A second run against the patched fixture reports zero open Critical/High findings.
- The CI gate (`--fail-on open-critical`) exits non-zero on regressions.

---

## 2. Functional & Technical Requirements (المتطلبات الوظيفية والتقنية)

### 2.1 محركات وظيفية (Functional engines)

| ID | Engine | Capability | Acceptance |
|---|---|---|---|
| FR-1 | Dynamic Red-Teaming | Generates multi-turn jailbreaks and dynamic payloads targeting LLM01 (Prompt Injection) and LLM06 (Excessive Agency); extensible to all 10. | Attacker can produce ≥ 1 exploitable transcript for each seeded vulnerability. |
| FR-2 | OWASP Evaluator | Maps every observed failure to one or more of LLM01–LLM10 with a severity (Critical/High/Medium) and a reproducible evidence trail. | Each `Finding` carries `owaspId`, `severity`, `repro`. |
| FR-3 | Auto-Patch (Self-Healing) | Auto-engineers hardened system prompts; emits code-level patches with Zod validation schemas that, when applied, block the original attack vector. | Every Critical/High finding is matched with a `PromptPatch` or `CodePatch`; the Zod schema rejects the original payload (unit-tested). |
| FR-4 | Validator / Re-test | Replays the original and mutated payloads against the patched target and records a `closed: bool` outcome with evidence. | Every finding in the report has a `retest` block. |
| FR-5 | CLI + Integrations | First-class CLI (`cyberpulse audit | retest | report`) and a programmatic API usable from any framework. | `npx cyberpulse --help` works; the library exports an `audit()` function. |

### 2.2 المتطلبات غير الوظيفية (Non-functional requirements)

| ID | Concern | Requirement |
|---|---|---|
| NFR-1 | Reproducibility | A given run, target, and model must produce the same set of findings on replay (modulo model temperature ≤ 0.2). |
| NFR-2 | Auditability | Every attempt, finding, patch, and retest is persisted in SQLite and linked to the run id. |
| NFR-3 | Safety | Defender never mutates a user-supplied target in-place without an explicit `--apply` flag. |
| NFR-4 | Performance | A single audit against the seeded fixture completes in ≤ 5 minutes with `maxIterations=3` on a developer laptop. |
| NFR-5 | Portability | Runs on Linux, macOS, and Windows with Node.js ≥ 20. |
| NFR-6 | Extensibility | New OWASP rules and new target adapters are added by implementing a single interface; no edits to the orchestrator. |
| NFR-7 | Reporting | SARIF 2.1.0 output must validate against the official schema. |

### 2.3 القيود (Constraints)

- Language: **TypeScript** (Node.js ≥ 20) — chosen so the same runtime powers the CLI, the library, and the QwenPaw agents.
- Validation: **Zod** for every agent I/O contract and for every emitted code patch.
- Persistence: **SQLite** (single file) — no external daemon.
- LLM provider: pluggable, default OpenAI-compatible.

---

## 3. System Architecture (التصميم المعماري للنظام)

### 3.1 نظرة عامة (Overview)

CyberPulse is decomposed into **five layers**:

1. **Entry layer** — CLI + library API.
2. **Orchestration layer** — the QwenPaw graph that drives the closed loop.
3. **Agent layer** — Orchestrator, Attacker, Defender/Remediation, Validator.
4. **Knowledge & evaluation layer** — OWASP catalog, evaluator, red-team payload library, remediation templates.
5. **Infrastructure layer** — Target adapter, Model provider, persistence, reporting.

### 3.2 مخطط النظام (System diagram)

```
                    ┌──────────────────────────────────────┐
                    │           Entry Layer                │
                    │   CLI (cyberpulse)   Library API     │
                    └──────────────────┬───────────────────┘
                                       ▼
                    ┌──────────────────────────────────────┐
                    │   Custom Orchestrator (Policy)       │
                    │  gates · budgets · retries · report  │
                    └──────────────────┬───────────────────┘
                                       │  uses the kernel
                                       ▼
                    ┌──────────────────────────────────────┐
                    │   QwenPaw Agent Runtime (Kernel)     │
                    │   closed-loop workflow (ralplan)     │
                    │   hosts: Orchestrator, Attacker,     │
                    │   Defender, Validator                │
                    └──┬───────────────┬─────────────┬─────┘
                       │               │             │
                       ▼               ▼             ▼
                ┌────────────┐  ┌────────────┐  ┌────────────┐
                │  Attacker  │  │  Defender  │  │  Validator │
                │   Agent    │  │   Agent    │  │   Agent    │
                └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
                      │               │               │
                      └───────────────┴───────────────┘
                                       │
                                       ▼
                ┌──────────────────────────────────────┐
                │  Knowledge & Evaluation Layer        │
                │  OWASP Catalog · Evaluator · Red-    │
                │  Team Payloads · Remediation Tmpls   │
                └──────────────────────────────────────┘
                                       │
                                       ▼
                ┌──────────────────────────────────────┐
                │  Infrastructure Layer                │
                │  TargetAdapter · ModelProvider ·     │
                │  SQLite Store · Reporters            │
                └──────────────────────────────────────┘
```

### 3.3 The QwenPaw role + Custom Orchestrator (دور QwenPaw + Custom Orchestrator)

Per the spec and the user's directive, the system is built on **two cooperating layers**:

#### 3.3.1 QwenPaw (the kernel / النواة)

**QwenPaw is the multi-agent kernel** that hosts the four agents and the workflow that connects them. Its responsibilities are limited to what a multi-agent kernel does well:

- **Agent hosting** — every agent (Orchestrator, Attacker, Defender, Validator) is a QwenPaw agent with a defined persona, system prompt, and tool allow-list.
- **Shared blackboard** — the run context (target descriptor, current findings, patches, retest results) is held in QwenPaw's shared state, so every agent reads/writes through one consistent surface.
- **Step ordering** — QwenPaw drives the steps `recon → attack → classify → remediate → retest → (loop | report)` in order, with the same determinism guarantee.
- **Tool / function calling** — QwenPaw is the only way the agents reach outside the kernel; the only registered tools are `TargetAdapter` invocations and the report generators.
- **Interrupt / resume** — QwenPaw can pause for human approval (e.g., before a `CodePatch` is applied to a real target).

QwenPaw does **not** decide *when* to stop iterating, *what* counts as a closed finding, or *how* to budget retries — those are policy decisions and live one layer up.

#### 3.3.2 Custom Orchestrator (the policy layer / طبقة السياسة)

The **Custom Orchestrator** is a TypeScript module we author in this repository. It sits *on top of* QwenPaw and supplies everything the kernel intentionally leaves out:

- **Closed-loop policy** — `policy.ts` defines the severity gates (e.g., "no Critical finding may be reported as `closed: false`"), the iteration budget, and the termination rules.
- **Audit trail** — every QwenPaw step, agent call, finding, patch, and retest is mirrored to SQLite so a failure is replayable.
- **Reporting** — Markdown, SARIF 2.1.0, and JSON reporters live in the Custom Orchestrator, not in QwenPaw, so the format is owned by us.
- **Human-in-the-loop hooks** — the `--apply` gate, `--fail-on open-critical`, and the `retest` subcommand are policy decisions, not kernel decisions.

The Custom Orchestrator interacts with QwenPaw exclusively through `src/orchestrator/qwenpaw-adapter.ts`. That adapter is the *only* file that knows QwenPaw's concrete API. Replacing QwenPaw (or implementing it in-repo if no public package exists) is a single-file change.

#### 3.3.3 Why two layers

- **Single responsibility** — QwenPaw is the kernel; the Custom Orchestrator is the policy. Neither has to do the other's job.
- **Replaceability** — if a different multi-agent framework is ever preferred, the adapter file is the only thing that changes.
- **Testability** — the closed-loop policy can be unit-tested without spinning up the agent kernel; the kernel can be smoke-tested without the policy.
- **Auditability** — the Custom Orchestrator owns the audit trail, so the kernel can be a black box from the operator's point of view.

### 3.4 أدوار الوكلاء (Agent roles)

There are **two distinct things** named "orchestrator" in this system, and they sit on different layers. Conflating them is the most common reading error, so the distinction is stated up front:

- **Custom Orchestrator** (TypeScript, this repo) — the *policy* layer that owns the closed-loop guarantees. Not a QwenPaw agent.
- **Orchestrator Agent** (QwenPaw agent) — the *coordinator* QwenPaw agent that routes work between Attacker, Defender, and Validator within a single iteration.

The four QwenPaw agents:

| Agent | Persona | QwenPaw role | Inputs | Outputs | Allowed tools |
|---|---|---|---|---|---|
| **Orchestrator Agent** | Neutral coordinator (inside the kernel). | `orchestrator-agent` | Step input from the Custom Orchestrator's workflow. | Routing decision + the agent's own contribution (e.g., recon output). | `target.call`, `store.read`. |
| **Attacker** | Offensive red-teamer. | `attacker` | Goal, OWASP ids to probe, current findings. | Attack transcript (multi-turn). | `target.call`, `payloads.mutate`. |
| **Defender / Remediation** | Defensive engineer. | `defender` | Findings (with evidence). | `PromptPatch` and/or `CodePatch`. | `remediation.promptHarden`, `remediation.codePatch`. |
| **Validator** | Independent auditor. | `validator` | Original transcript + patches. | `RetestResult[]` with `closed: bool` and evidence. | `target.call`, `payloads.mutate`. |

**Layering between the two orchestrators:**

```
   Custom Orchestrator (this repo)  ←── owns policy, gates, audit trail, budget
            │
            │  drives one iteration of
            ▼
   QwenPaw Workflow
            │
            │  starts the
            ▼
   Orchestrator Agent (QwenPaw)  ←── routes work to Attacker/Defender/Validator
            │
            │  in this iteration
            ▼
   Attacker / Defender / Validator (QwenPaw agents)
```

The Attacker and Defender are connected by a **bidirectional feedback channel** (per the spec diagram): the Defender's patches are fed back to the Attacker for a new round, closing the loop. The Custom Orchestrator observes the iteration's outcome and decides whether to start another iteration or move to `report`.

### 3.5 مكونات النظام (Core components)

| Component | Responsibility | File (planned) |
|---|---|---|
| CLI program | Commander-based commands: `audit`, `retest`, `report`. | `src/cli/program.ts` |
| Orchestrator | The QwenPaw workflow that drives the closed loop. | `src/orchestrator/orchestrator.ts` + `src/orchestrator/qwenpaw-adapter.ts` |
| Agent base | Shared `Agent<I,O>` contract with Zod-validated I/O, retries, logging. | `src/agents/base.ts` |
| Attacker | Generates multi-turn jailbreaks. | `src/agents/attacker.ts` |
| Defender | Emits `PromptPatch` / `CodePatch`. | `src/agents/defender.ts` |
| Validator | Re-tests patched target. | `src/agents/validator.ts` |
| OWASP catalog | LLM01–LLM10 metadata, severity, detectors. | `src/owasp/catalog.ts` |
| OWASP evaluator | Maps a transcript to `Finding[]`. | `src/owasp/evaluator.ts` |
| Red-team payloads | Templates + mutators for each OWASP id. | `src/redteam/payloads/*.ts` |
| Prompt hardener | System-prompt rewriting rules. | `src/remediation/prompt-hardener.ts` |
| Code patcher | Zod-validated code-level patch generator. | `src/remediation/code-patch.ts` |
| Target adapter | The boundary to the LLM app under test. | `src/targets/adapter.ts` (+ http / openai-compatible / python-fn) |
| Model provider | The boundary to the LLM used for analysis. | `src/model/provider.ts` (+ openai / anthropic / ollama) |
| Store | SQLite persistence. | `src/store/sqlite.ts` |
| Reporters | Markdown, SARIF 2.1.0, JSON. | `src/report/{markdown,sarif,json}.ts` |

### 3.6 بروتوكول الوكلاء (Inter-agent protocol)

All inter-agent messages are Zod schemas. The shared types are the *only* contract between QwenPaw agents and the Custom Orchestrator:

```ts
type RunId = string & { __brand: "RunId" };

const Finding = z.object({
  id: z.string(),
  owaspId: z.enum(["LLM01","LLM02","LLM03","LLM04","LLM05",
                   "LLM06","LLM07","LLM08","LLM09","LLM10"]),
  severity: z.enum(["critical","high","medium","low","info"]),
  title: z.string(),
  evidence: z.string(),        // redacted transcript excerpt
  repro: z.object({            // exact replay instructions
    payload: z.string(),
    target: z.string(),
    expected: z.string(),
  }),
});

const PromptPatch = z.object({
  kind: z.literal("prompt"),
  before: z.string(),
  after: z.string(),
  rationale: z.string(),
});

const CodePatch = z.object({
  kind: z.literal("code"),
  file: z.string(),
  diff: z.string(),
  zodSchema: z.string(),       // Zod source; must reject the original payload
  rationale: z.string(),
});

const Patch = z.discriminatedUnion("kind", [PromptPatch, CodePatch]);

const RetestResult = z.object({
  findingId: z.string(),
  closed: z.boolean(),
  attempts: z.array(z.object({
    payload: z.string(),
    response: z.string(),
    passed: z.boolean(),
  })),
  evidence: z.string(),
});
```

These schemas are the boundary between the **Custom Orchestrator** (this repo) and the **QwenPaw agents** (the kernel). The QwenPaw workflow passes them between agents; the Custom Orchestrator reads/writes the same shapes into the SQLite audit trail. Every transition is logged so a failure is replayable.

### 3.7 آلة الحالة المغلقة (Closed-loop state machine)

The closed-loop is **owned by the Custom Orchestrator** (TypeScript in this repo), and the **QwenPaw workflow** is the inner loop it calls once per iteration. This is the central architectural decision:

```
   ┌───────────────────────────────────────────────────────────────────┐
   │  Custom Orchestrator (this repo)  —  outer loop, policy owner     │
   │                                                                   │
   │   for iteration in 1..maxIterations:                              │
   │       outcome = qwenpaw.runOneIteration(input, sharedState)       │
   │       audit_trail.write(outcome)                                  │
   │       if policy.allCriticalClosed(outcome):                       │
   │           break                                                   │
   │   reporters.emit(audit_trail)                                    │
   └───────────────────────────────────────────────────────────────────┘
                                  │
                                  │  one iteration
                                  ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  QwenPaw Workflow (kernel)  —  inner loop, step-by-step          │
   │                                                                   │
   │   recon → attack → classify → remediate → retest                  │
   │       (each step is a QwenPaw agent call;                         │
   │        shared state on the QwenPaw blackboard)                    │
   └───────────────────────────────────────────────────────────────────┘
```

The full data-flow (one iteration):

```
                ┌──────────┐
                │  recon   │  (Orchestrator Agent gathers target descriptor)
                └─────┬────┘
                      ▼
              ┌───────────────┐
       ┌─────►│    attack     │  (Attacker emits multi-turn transcript)
       │      └─────┬─────────┘
       │            ▼
       │      ┌───────────────┐
       │      │   classify    │  (OWASP Evaluator → Finding[])
       │      └─────┬─────────┘
       │            ▼
       │      ┌───────────────┐
       │      │   remediate   │  (Defender → Patch[])
       │      └─────┬─────────┘
       │            ▼
       │      ┌───────────────┐
       │      │    retest     │  (Validator → RetestResult[])
       │      └─────┬─────────┘
       │            │
       │            ▼
       └────  return to Custom Orchestrator
                          │
                          ▼
              Custom Orchestrator policy check:
              "any Critical/High open AND iteration < maxIterations?"
                          │
                  yes ───┘      no
                  │                │
                  ▼                ▼
              iterate           report
```

**Policy** (lives in `src/orchestrator/policy.ts`, owned by the Custom Orchestrator):
- A run never reaches `report` while a Critical finding has `closed: false` unless `--allow-open-critical` is passed.
- `maxIterations` (default 3) bounds the loop.
- The Defender's `CodePatch` is only applied if `--apply` is set; otherwise it is proposed.

### 3.8 تدفق البيانات (Data flow)

1. CLI parses the run config and target descriptor and hands them to the **Custom Orchestrator**.
2. The Custom Orchestrator creates a `Run` row in SQLite and calls the **QwenPaw workflow** for one iteration.
3. The QwenPaw Orchestrator Agent performs `recon` and writes the descriptor to the QwenPaw blackboard.
4. The QwenPaw Attacker uses `TargetAdapter` to call the LLM app with payloads from the red-team library, producing a transcript on the blackboard.
5. The QwenPaw Defender reads the transcript, emits `Patch[]`; the Custom Orchestrator mirrors these rows to SQLite.
6. The QwenPaw Validator re-runs the original and mutated payloads against the patched target; `RetestResult[]` is written.
7. The Custom Orchestrator reads the iteration's outcome, applies `policy.ts`, and either starts another iteration or moves to `report`.
8. When the gate passes, the Custom Orchestrator's reporters emit Markdown/SARIF/JSON.

### 3.9 فهرسة البيانات (Data model)

```
runs (id, target, config, started_at, finished_at, status)
attempts (id, run_id, agent, payload, response, ts)
findings (id, run_id, owasp_id, severity, title, evidence, repro_json)
patches (id, run_id, finding_id, kind, before, after OR diff, zod_schema, rationale)
retests (id, run_id, finding_id, closed, attempts_json, evidence, ts)
```

All writes are wrapped in a single SQLite transaction per orchestrator step so a crash mid-loop leaves a consistent state.

### 3.10 أنماط الفشل (Failure modes)

| Failure | Detection | Response |
|---|---|---|
| Target unreachable | `TargetAdapter` returns transport error. | Mark attempt as failed; record in audit log; let the gate decide. |
| Model provider down | `ModelProvider` raises. | Retry with exponential backoff (3 attempts); if still failing, mark the run `error` and surface the cause in the report. |
| Defender emits invalid patch | Zod validation of `Patch` fails. | Roll back the agent's output; record a `remediation_invalid` event; the orchestrator skips that finding's retest. |
| Retest inconclusive (model non-deterministic at higher temperature) | Validator runs each payload N times (default 3) and uses majority. | If the result is still split, escalate to a human review flag. |
| Loop runs over budget | `policy.ts` counters trigger termination. | Report is still produced, marked `partial`, and lists unclosed findings. |

### 3.11 الأمان (Security considerations)

- Targets are exercised through a *narrow* adapter that whitelists the methods and headers the LLM app exposes.
- The Defender's `CodePatch.diff` is shown to the user before `--apply`; the agent never shells out.
- Prompts and responses that may contain secrets are redacted by the report generator before being written to disk (the full transcript remains in SQLite for the operator's own use).
- The QwenPaw agent system prompts are themselves an attack surface; they are loaded from signed configuration, not from user input.

### 3.12 قابلية التوسع (Extensibility)

- New OWASP rule → add to `catalog.ts` and write a detector module; the orchestrator picks it up automatically.
- New target type → implement `TargetAdapter`; no other code changes.
- New reporter → implement the `Reporter` interface.
- New model provider → implement `ModelProvider`.

---

## 4. Task Breakdown & Roadmap (خطة العمل المجزأة وخريطة الطريق)

The roadmap follows the four phases in the spec, each producing a runnable increment. The plan decomposition follows `planner-pro-max` discipline: each phase has a **goal**, a **checklist**, an **owner** (default: the implementing agent), a **gate** (what must be true to leave the phase), and **dependencies** (what must already be in place).

### 4.1 المرحلة الأولى — Core Initialization & Setup

**Goal:** a runnable shell with the project skeleton, the OWASP catalog, the persistence layer, and one working CLI command.

**Checklist**
- [ ] Initialize `package.json`, `tsconfig.json`, ESLint, Prettier, Vitest.
- [ ] Create repository layout (`src/`, `tests/`, `data/`, `docs/`, `bin/`).
- [ ] Implement `src/util/{logger,ids,diff}.ts`.
- [ ] Implement `src/model/provider.ts` + `openai.ts`.
- [ ] Implement `src/targets/adapter.ts` + the three concrete adapters.
- [ ] Implement `src/owasp/{catalog,severities}.ts` seeded from `data/seed/owasp-llm-top10.json`.
- [ ] Implement `src/store/sqlite.ts` with the schema in §3.9.
- [ ] Wire `bin/cyberpulse.ts` to `src/cli/program.ts` with `audit`, `retest`, `report` subcommands.
- [ ] Write a hello-world integration test that starts a run, writes to SQLite, and prints JSON.

**Gate:** `npx cyberpulse --help` works; `npm test` is green; a run can be started and reported as JSON.

**Dependencies:** none (this is the foundation).

### 4.2 المرحلة الثانية — Offensive Red-Teaming Module

**Goal:** the Attacker agent can produce multi-turn jailbreaks targeting LLM01 and LLM06 (with the other eight OWASP ids stubbed but extensible).

**Checklist**
- [ ] Implement `src/agents/base.ts` (`Agent<I,O>` with Zod-validated I/O, retries, logging).
- [ ] Implement `src/agents/attacker.ts` with the `AttackPlan` / `AttackTurn` contracts.
- [ ] Implement `src/redteam/payloads/{prompt-injection,jailbreak-multi,excessive-agency,sensitive-disclosure,supply-chain}.ts` and the LLM03/04/07/08/09/10 stubs.
- [ ] Implement `src/redteam/mutators.ts` (encoding, framing, role-play, multi-turn chaining).
- [ ] Implement `src/owasp/evaluator.ts` — maps an attacker transcript to `Finding[]`.
- [ ] Add an adversarial test that the Attacker can find a known-bad fixture target.

**Gate:** `cyberpulse audit --target tests/fixtures/mock-target --goal "reveal system prompt"` returns ≥ 1 `Finding` with a stable `owaspId`, severity, and reproducible payload.

**Dependencies:** Phase 1.

### 4.3 المرحلة الثالثة — Defensive Auto-Remediation Module

**Goal:** the Defender agent can produce, for every finding, either a `PromptPatch` or a `CodePatch` whose Zod schema rejects the original payload.

**Checklist**
- [ ] Implement `src/agents/defender.ts` consuming `Finding[]` and emitting `RemediationPlan` items.
- [ ] Implement `src/remediation/prompt-hardener.ts` (rule-based + LLM-assisted hardening).
- [ ] Implement `src/remediation/code-patch.ts` (unified-diff + Zod schema).
- [ ] Implement `src/remediation/templates/` per LLM id.
- [ ] Unit-test that for every seed vulnerability, the emitted patch's Zod schema rejects the original payload.

**Gate:** Defender runs against any Phase 2 finding and returns ≥ 1 patch; the Zod schema in every `CodePatch` fails the original attack payload.

**Dependencies:** Phase 2.

### 4.4 المرحلة الرابعة — Closed-Loop Integration & Testing

**Goal:** a single `cyberpulse audit` command drives the full closed loop and produces a report with retest evidence for every Critical/High finding.

**Checklist**
- [ ] Implement `src/orchestrator/orchestrator.ts` — the **Custom Orchestrator** (outer loop, owns policy, audit trail, and reporting).
- [ ] Implement `src/orchestrator/qwenpaw-adapter.ts` — the thin wrapper that maps the QwenPaw kernel's API onto the Custom Orchestrator's contract. If QwenPaw turns out to be a real external package, this file imports it; if not, this file *implements* the QwenPaw contract in-repo.
- [ ] Implement `src/agents/{orchestrator,attacker,defender,validator}.ts` as **QwenPaw agents** sharing a blackboard.
- [ ] Implement `src/agents/validator.ts` with majority-vote retests.
- [ ] Implement `src/orchestrator/policy.ts` with severity gates and retry budgets.
- [ ] Implement `src/report/{markdown,sarif,json}.ts`.
- [ ] End-to-end test `tests/integration/closed-loop.spec.ts` against the seeded vulnerable fixture; the report must list the original finding as **Closed** with retest evidence.
- [ ] End-to-end test against the **patched** fixture returning zero open Critical/High findings.
- [ ] CI script: `--fail-on open-critical` exits non-zero on regressions.

**Gate:** A second run against the patched fixture shows zero open Critical/High findings; SARIF output validates against the official schema.

**Dependencies:** Phase 3.

### 4.5 خريطة الطريق الزمنية (Suggested milestone calendar)

The above phases are sequenced for a single contributor. Suggested time-box (calendar weeks, not effort):

| Week | Milestone |
|---|---|
| 1 | Phase 1 complete; CI is green. |
| 2 | Phase 2 complete; Attacker finds the seeded vulnerability. |
| 3 | Phase 3 complete; Defender produces a valid patch for every seed. |
| 4 | Phase 4 complete; closed-loop report + SARIF CI gate. |
| 5+ | Hardening: extra OWASP ids, more target adapters, performance, docs. |

### 4.6 معالم الإنجاز (Definition of Done — overall)

- All four phases green; CI gate passes on the seeded fixture.
- One CLI command (`cyberpulse audit <target>`) produces a Markdown + SARIF + JSON report.
- Every Critical/High finding has a `retest` block with `closed: true` and evidence.
- Public docs (`docs/architecture.md`, `docs/usage.md`, `docs/owasp-mapping.md`) are written and linked from the README.
- A release tag is cut and the CLI is publishable.

---

## Appendix A — Skills-to-section traceability

| Skill | Primary section(s) |
|---|---|
| `product-manager-pro.md` | §1 (Vision & Scope), §1.5 (Success criteria). |
| `requirements-engineer.md` | §2 (Functional & Non-functional Requirements), §2.3 (Constraints). |
| `omc-architect.md` | §3.1, §3.2, §3.3 (Architecture overview, system diagram, QwenPaw role). |
| `system-design-pro.md` | §3.4–§3.12 (Agents, data model, failure modes, security, extensibility). |
| `omc-multi-agent` | §3.4 (Agent roles), §3.6 (Inter-agent protocol). |
| `planner-pro-max.md` | §4 (Phases, gates, dependencies, milestone calendar). |
| `ralplan` | §1.2 (Closed-loop cycle), §3.7 (State machine), §4.4 (Phase 4). |

## Appendix B — Open questions for the user

1. **QwenPaw — is it a real, public package, or a logical/contractual name?** A search of `~/.claude/`, the plugin marketplaces, and the npm registry returned no hits. If it is a private/internal package, please provide its install name and version, or confirm that the in-repo `qwenpaw-adapter.ts` should *implement* the contract. The architecture is identical either way; only the import path in that one file changes.
2. **Default model provider** for Phase 1 — OpenAI, Anthropic, or Ollama?
3. **Default target adapter** for the first end-to-end demo — HTTP, OpenAI-compatible, or Python callable?
4. **Patch-application policy** — propose-only by default, or auto-apply to a workspace copy?
5. **OWASP catalog source** — hand-curated in-repo, or fetched from an official feed at run time?

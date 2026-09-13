/**
 * CI mock LLM target — deterministic, dependency-free
 * ──────────────────────────────────────────────────
 * Used by the GitHub Actions workflow (both jobs):
 *   - security-audit : the CLI smoke audit posts here as the "model"
 *   - e2e            : /api/scan closed-loop tests post here
 *
 * Behavior: responds to EVERY chat-completion request with a safe
 * refusal — the exact posture that must produce ZERO findings.
 * `GET /health` is the readiness probe (no body parsing, O(1)).
 *
 * Zero external deps: node:http only. Runs on any Node ≥ 18.
 */

import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 19999);
const HOST = '127.0.0.1';

const SAFE_REFUSAL = "I'm sorry, but I can't help with that request.";

const server = http.createServer((req, res) => {
  // Readiness probe — instant, no body read.
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, up: true }));
    return;
  }

  // Any other route: consume the body, answer as a chat completion.
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'mock-cmpl',
        object: 'chat.completion',
        model: 'mock-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: SAFE_REFUSAL },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      })
    );
  });
});

// Postgres-driver-style nicety: fail fast when the port is taken
// (a stale mock from a cancelled run must never confuse CI).
server.on('error', (err) => {
  console.error(`mock-target: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`mock-target: listening on http://${HOST}:${PORT} (always-refuses)`);
});

// Container-friendliness: SIGTERM → clean exit (kill in the workflow).
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
});

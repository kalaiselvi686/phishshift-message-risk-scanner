import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMessage, messageLimits } from "../scanner.js";
import { createServer } from "../server.js";

test("scores a credential request with urgency and a shortened link as high risk", () => {
  const result = analyzeMessage(
    "Urgent: verify your account password now at https://bit.ly/account"
  );

  assert.equal(result.riskLevel, "high");
  assert.equal(result.score, 63);
  assert.deepEqual(
    result.indicators.map((indicator) => indicator.id),
    ["urgency", "credentials", "shortened-link"]
  );
  assert.equal(result.checkedLinks, 1);
});

test("reports a routine message with a secure link as low risk", () => {
  const result = analyzeMessage("The meeting starts at 10:00. Details: https://example.com/agenda");

  assert.equal(result.riskLevel, "low");
  assert.equal(result.score, 0);
  assert.deepEqual(result.indicators, []);
});

test("rejects empty and oversized messages", () => {
  assert.throws(() => analyzeMessage("   "), {
    name: "RangeError",
    message: "Enter a message to scan."
  });
  assert.throws(() => analyzeMessage("a".repeat(messageLimits.maxCharacters + 1)), {
    name: "RangeError"
  });
  assert.throws(() => analyzeMessage(123), {
    name: "TypeError",
    message: "Message must be a string."
  });
});

test("serves the health endpoint and validates API requests", async (context) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  for (const [path, heading] of [
    ["/", "<title>Overview | PhishShift</title>"],
    ["/analyzer", "<title>Message Analyzer | PhishShift</title>"],
    ["/history", "<title>Scan History | PhishShift</title>"]
  ]) {
    const pageResponse = await fetch(`${baseUrl}${path}`);
    assert.equal(pageResponse.status, 200);
    assert.match(await pageResponse.text(), new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await healthResponse.json(), { status: "ok", scannerMode: "rules-based" });

  const invalidResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "" })
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error, "Enter a message to scan.");

  const scanResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Please send the payment now." })
  });
  assert.equal(scanResponse.status, 200);
  const scanResult = await scanResponse.json();
  assert.equal(scanResult.riskLevel, "medium");
  assert.equal(scanResult.scannerMode, "rules-based");
});

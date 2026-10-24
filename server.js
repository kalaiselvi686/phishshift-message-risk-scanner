import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeMessage, messageLimits } from "./scanner.js";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 12_000;

const assets = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/analyzer", { file: "analyzer.html", type: "text/html; charset=utf-8" }],
  ["/analyzer/", { file: "analyzer.html", type: "text/html; charset=utf-8" }],
  ["/history", { file: "history.html", type: "text/html; charset=utf-8" }],
  ["/history/", { file: "history.html", type: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }]
]);

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let bodyBytes = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }

  if (tooLarge) {
    throw new HttpError(413, "Request body is too large.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function securityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    securityHeaders(response);

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && requestUrl.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok", scannerMode: "rules-based" });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/analyze") {
      try {
        const payload = await readJsonBody(request);
        if (typeof payload?.message !== "string") {
          throw new HttpError(400, "Provide the message as a string.");
        }
        if (payload.message.length > messageLimits.maxCharacters) {
          throw new HttpError(
            400,
            `Messages must be ${messageLimits.maxCharacters} characters or fewer.`
          );
        }

        sendJson(response, 200, analyzeMessage(payload.message));
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(response, error.statusCode, { error: error.message });
          return;
        }
        if (error instanceof RangeError) {
          sendJson(response, 400, { error: error.message });
          return;
        }
        console.error("Message analysis failed:", error);
        sendJson(response, 500, { error: "The message could not be analyzed." });
      }
      return;
    }

    if (request.method === "GET" && assets.has(requestUrl.pathname)) {
      const asset = assets.get(requestUrl.pathname);
      try {
        const content = await readFile(join(rootDirectory, "public", asset.file));
        response.writeHead(200, {
          "Content-Type": asset.type,
          "Cache-Control": "no-cache"
        });
        response.end(content);
      } catch (error) {
        console.error(`Unable to serve ${asset.file}:`, error);
        sendJson(response, 500, { error: "The application could not be loaded." });
      }
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`PhishShift listening on port ${port}.`);
  });
}

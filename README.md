# PhishShift Message Risk Scanner

PhishShift is a responsive multi-page message-analysis dashboard with a same-origin JSON API. Overview, Message Analyzer, and Scan History each have a dedicated page. It flags explainable warning signs in pasted email, SMS, and direct-message text.

## Requirements translated into the app

- **Message analysis:** accept text and return a 0–100 risk score, risk band, matched indicators, and practical guidance.
- **Explainability:** show the signals that contributed to a result instead of presenting an unexplained verdict.
- **Dashboard:** provide scan totals, high-risk counts, average score, and recent activity based on the current browser's history.
- **Privacy:** analyze messages in memory; retain only score, risk level, indicator count, and timestamp in local browser storage. Never persist the message text.
- **Usability:** support desktop and mobile layouts and provide clear input validation and status feedback.
- **Deployment:** serve the frontend and API from one Node web service with a Render Blueprint and `/api/health` health check.

The supplied screenshot appears to show only a technical-requirements page. No dataset or trained model is present in the project, so this first implementation uses transparent, hand-authored rules. It is not a trained machine-learning model and does not claim calibrated accuracy. A labeled dataset and an agreed evaluation plan are needed before adding or reporting model metrics.

## Run locally

Requires Node.js 20 or later.

```powershell
npm.cmd start
```

Open `http://localhost:3000`. Run the automated checks with:

```powershell
npm.cmd test
```

Use the sidebar to visit `/` (Overview), `/analyzer` (Message Analyzer), and `/history` (Scan History). Scan metadata is shared across these pages in the same browser.

Risk bands are deterministic rule scores: low (0–19), medium (20–44), high (45–69), and critical (70–100). They are indicators for review, not probabilities.

## API

### `GET /api/health`

Returns service status and scanner mode.

### `POST /api/analyze`

Request:

```json
{
  "message": "Your message text"
}
```

Returns `score`, `riskLevel`, `summary`, matched `indicators`, number of `checkedLinks`, scanned character count, and scanner mode. Empty messages, invalid JSON, wrong input types, and messages over 5,000 characters are rejected with an explicit error.

## Deploy to Render

1. Push this project to a GitHub repository.
2. In Render, select **New** → **Blueprint** and connect that repository.
3. Confirm the service settings from `render.yaml` and deploy.
4. Open the generated service URL and check that `/api/health` reports `{"status":"ok","scannerMode":"rules-based"}`.

Render supplies the `PORT` environment variable; the server binds to it and listens on all interfaces. No secrets or external services are required.

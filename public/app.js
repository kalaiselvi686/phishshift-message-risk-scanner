const HISTORY_KEY = "phishshift.scan-history.v1";
const HISTORY_LIMIT = 20;

const input = document.querySelector("#message-input");
const analyzeButton = document.querySelector("#analyze-button");
const formError = document.querySelector("#form-error");
const resultCard = document.querySelector("#result-card");

function isValidHistoryItem(item) {
  return item
    && typeof item.id === "string"
    && typeof item.riskLevel === "string"
    && typeof item.score === "number"
    && typeof item.indicatorCount === "number"
    && typeof item.createdAt === "string"
    && Number.isFinite(Date.parse(item.createdAt));
}

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(history) ? history.filter(isValidHistoryItem).slice(0, HISTORY_LIMIT) : [];
  } catch (error) {
    console.error("Unable to read local scan history:", error);
    return [];
  }
}

let scanHistory = loadHistory();

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(scanHistory));
    return true;
  } catch (error) {
    console.error("Unable to save local scan history:", error);
    return false;
  }
}

function todayHistory() {
  const today = new Date().toDateString();
  return scanHistory.filter((scan) => new Date(scan.createdAt).toDateString() === today);
}

function updateStats() {
  const today = todayHistory();
  const highRisk = today.filter((scan) => scan.riskLevel === "high" || scan.riskLevel === "critical").length;
  const average = today.length
    ? Math.round(today.reduce((total, scan) => total + scan.score, 0) / today.length)
    : 0;
  const total = document.querySelector("#stat-total");
  const high = document.querySelector("#stat-high");
  const averageElement = document.querySelector("#stat-average");
  const totalSaved = document.querySelector("#history-total");

  if (total) total.textContent = String(today.length);
  if (high) high.textContent = String(highRisk);
  if (averageElement) averageElement.textContent = String(average);
  if (totalSaved) totalSaved.textContent = String(scanHistory.length);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function createRiskBadge(riskLevel) {
  const badge = document.createElement("span");
  badge.className = `table-risk risk-${riskLevel}`;
  badge.textContent = riskLevel;
  return badge;
}

function renderHistoryTable() {
  const historyBody = document.querySelector("#history-body");
  const emptyHistory = document.querySelector("#empty-history");
  const table = historyBody?.closest("table");
  if (!historyBody || !emptyHistory || !table) return;

  historyBody.replaceChildren();
  emptyHistory.hidden = scanHistory.length > 0;
  table.hidden = scanHistory.length === 0;

  for (const scan of scanHistory) {
    const row = document.createElement("tr");
    const scanCell = document.createElement("td");
    const riskCell = document.createElement("td");
    const scoreCell = document.createElement("td");
    const indicatorCell = document.createElement("td");
    const timeCell = document.createElement("td");

    scanCell.textContent = "Message scan";
    riskCell.append(createRiskBadge(scan.riskLevel));
    scoreCell.textContent = `${scan.score} / 100`;
    indicatorCell.textContent = String(scan.indicatorCount);
    timeCell.textContent = formatDate(scan.createdAt);
    row.append(scanCell, riskCell, scoreCell, indicatorCell, timeCell);
    historyBody.append(row);
  }

  const historyCount = document.querySelector("#history-count");
  const clearButton = document.querySelector("#clear-button");
  const exportButton = document.querySelector("#export-button");
  if (historyCount) {
    historyCount.textContent = `Showing ${scanHistory.length} scan${scanHistory.length === 1 ? "" : "s"}`;
  }
  if (clearButton) clearButton.disabled = scanHistory.length === 0;
  if (exportButton) exportButton.disabled = scanHistory.length === 0;
}

function renderRecentScans() {
  const recentList = document.querySelector("#recent-list");
  const emptyHistory = document.querySelector("#empty-history");
  if (!recentList || !emptyHistory) return;

  recentList.replaceChildren();
  emptyHistory.hidden = scanHistory.length > 0;
  for (const scan of scanHistory.slice(0, 5)) {
    const row = document.createElement("div");
    const label = document.createElement("strong");
    const time = document.createElement("time");
    const score = document.createElement("span");
    const badge = createRiskBadge(scan.riskLevel);
    row.className = "recent-row";
    label.textContent = "Message scan";
    time.textContent = formatDate(scan.createdAt);
    time.dateTime = scan.createdAt;
    score.textContent = `${scan.score} / 100`;
    row.append(label, badge, score, time);
    recentList.append(row);
  }
}

function renderHistory() {
  renderHistoryTable();
  renderRecentScans();
  updateStats();
}

function showError(message) {
  if (!formError) return;
  formError.textContent = message;
  formError.hidden = false;
}

function addIndicator(indicator) {
  const item = document.createElement("li");
  const icon = document.createElement("span");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  icon.className = "indicator-check";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "!";
  title.textContent = indicator.title;
  copy.append(title, document.createTextNode(indicator.detail));
  item.append(icon, copy);
  return item;
}

function renderResult(result) {
  const riskName = result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1);
  const badge = document.querySelector("#risk-badge");
  const indicatorList = document.querySelector("#indicator-list");
  document.querySelector("#result-title").textContent = `${riskName} risk assessment`;
  badge.className = `risk-badge risk-${result.riskLevel}`;
  badge.textContent = `${riskName} risk`;
  document.querySelector("#result-score").textContent = String(result.score);
  document.querySelector("#result-summary").textContent = result.summary;
  const scoreFill = document.querySelector("#score-fill");
  scoreFill.style.width = `${result.score}%`;
  scoreFill.dataset.risk = result.riskLevel;
  indicatorList.replaceChildren();

  if (result.indicators.length === 0) {
    const item = document.createElement("li");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    item.className = "empty-indicators";
    icon.className = "indicator-check";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";
    copy.textContent = "No clear warning indicators matched.";
    item.append(icon, copy);
    indicatorList.append(item);
  } else {
    for (const indicator of result.indicators) indicatorList.append(addIndicator(indicator));
  }

  document.querySelector("#indicator-count").textContent = String(result.indicators.length);
  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function analyzeMessage() {
  const message = input.value.trim();
  formError.hidden = true;
  if (!message) {
    showError("Enter a message to scan.");
    input.focus();
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.classList.add("loading");
  analyzeButton.querySelector(".button-label").textContent = "Analyzing…";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The message could not be analyzed.");

    renderResult(result);
    scanHistory.unshift({
      id: crypto.randomUUID(),
      riskLevel: result.riskLevel,
      score: result.score,
      indicatorCount: result.indicators.length,
      createdAt: new Date().toISOString()
    });
    scanHistory = scanHistory.slice(0, HISTORY_LIMIT);
    if (!saveHistory()) showError("The scan completed, but this browser could not save scan history.");
    renderHistory();
  } catch (error) {
    showError(error instanceof Error ? error.message : "The message could not be analyzed.");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.classList.remove("loading");
    analyzeButton.querySelector(".button-label").textContent = "Analyze message";
  }
}

function exportHistory() {
  const columns = ["scan", "risk_level", "score", "indicator_count", "created_at"];
  const rows = scanHistory.map((scan) => ["Message scan", scan.riskLevel, scan.score, scan.indicatorCount, scan.createdAt]);
  const csv = [columns, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "phishshift-scan-history.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function checkService() {
  const status = document.querySelector("#scanner-status");
  if (!status) return;
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error(`Health check returned ${response.status}.`);
    const data = await response.json();
    status.textContent = data.status === "ok" ? "Operational" : "Unavailable";
  } catch (error) {
    console.error("Scanner health check failed:", error);
    status.textContent = "Unavailable";
    document.querySelector(".status-value .status-dot")?.style.setProperty("background", "#d75a65");
  }
}

if (input && analyzeButton && formError && resultCard) {
  input.addEventListener("input", () => {
    document.querySelector("#character-count").textContent = `${input.value.length.toLocaleString()} / 5,000`;
    formError.hidden = true;
  });
  analyzeButton.addEventListener("click", analyzeMessage);
}

document.querySelector("#clear-button")?.addEventListener("click", () => {
  scanHistory = [];
  if (!saveHistory()) {
    showError("This browser could not clear its saved scan history.");
    return;
  }
  renderHistory();
});
document.querySelector("#export-button")?.addEventListener("click", exportHistory);

renderHistory();
checkService();

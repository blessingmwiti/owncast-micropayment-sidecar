const rateEl = document.querySelector("#rate");
const streamStatusEl = document.querySelector("#stream-status");
const viewerCountEl = document.querySelector("#viewer-count");
const rationaleEl = document.querySelector("#rationale");
const totalEl = document.querySelector("#total");
const uniqueWalletsEl = document.querySelector("#unique-wallets");
const settledSessionsEl = document.querySelector("#settled-sessions");
const averageWatchEl = document.querySelector("#average-watch");
const sessionsEl = document.querySelector("#sessions");
const settlementsEl = document.querySelector("#settlements");
const refreshButton = document.querySelector("#refresh");
const reconcileButton = document.querySelector("#reconcile");
const adminStatusEl = document.querySelector("#admin-status");
const query = new URLSearchParams(window.location.search);
const queryToken = query.get("token");

if (queryToken) {
  window.localStorage.setItem("payflowAdminToken", queryToken);
  window.history.replaceState({}, "", window.location.pathname);
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "";
  return td;
}

function renderSessions(sessions) {
  sessionsEl.replaceChildren(
    ...sessions.map((session) => {
      const row = document.createElement("tr");
      row.append(
        cell(session.viewerUserId),
        cell(session.status),
        cell(String(session.watchedSeconds ?? "")),
        cell(`$${Number(session.ratePerSecond).toFixed(6)}`),
        cell(session.amountUSDC ?? ""),
        cell(session.walletAddress ?? "")
      );
      return row;
    })
  );
}

function renderSettlements(settlements) {
  settlementsEl.replaceChildren(
    ...settlements.map((settlement) => {
      const row = document.createElement("tr");
      row.append(
        cell(settlement.provider),
        cell(settlement.status),
        cell(settlement.amountUSDC),
        cell(settlement.amountUnits),
        cell(settlement.transactionId ?? settlement.error ?? "")
      );
      return row;
    })
  );
}

async function refresh() {
  const adminToken = window.localStorage.getItem("payflowAdminToken");
  const headers = adminToken ? { "x-payflow-admin-token": adminToken } : {};
  const [rateResponse, ledgerResponse, metricsResponse] = await Promise.all([
    fetch("/agent/rate"),
    fetch("/ledger", { headers }),
    fetch("/metrics", { headers })
  ]);
  const decision = await rateResponse.json();
  const ledger = await ledgerResponse.json();
  const metrics = await metricsResponse.json();

  if (!ledgerResponse.ok || !metricsResponse.ok) {
    rationaleEl.textContent = ledger.error ?? "Unable to load dashboard ledger";
    return;
  }
  const total = ledger.settlements
    .filter((settlement) => settlement.status === "settled")
    .reduce((sum, settlement) => sum + Number(settlement.amountUSDC), 0);

  rateEl.textContent = `$${Number(decision.ratePerSecond).toFixed(6)}/sec`;
  streamStatusEl.textContent = decision.online ? "online" : "offline";
  viewerCountEl.textContent = String(decision.viewerCount ?? 0);
  rationaleEl.textContent = decision.rationale ?? "static rate";
  totalEl.textContent = `$${total.toFixed(6)}`;
  uniqueWalletsEl.textContent = String(metrics.uniqueWallets ?? 0);
  settledSessionsEl.textContent = String(metrics.settledSessions ?? 0);
  averageWatchEl.textContent = `${metrics.averageWatchedSeconds ?? 0}s`;
  renderSessions(ledger.sessions ?? []);
  renderSettlements(ledger.settlements ?? []);
}

async function reconcile() {
  const adminToken = window.localStorage.getItem("payflowAdminToken");
  const headers = adminToken ? { "x-payflow-admin-token": adminToken } : {};
  adminStatusEl.textContent = "Reconciling...";

  const response = await fetch("/admin/reconcile", {
    method: "POST",
    headers
  });
  const body = await response.json();

  if (!response.ok) {
    adminStatusEl.textContent = body.error ?? "Reconciliation failed";
    return;
  }

  adminStatusEl.textContent = `Attempted ${body.result.attempted}, settled ${body.result.settled}, failed ${body.result.failed}`;
  await refresh();
}

refreshButton.addEventListener("click", refresh);
reconcileButton.addEventListener("click", reconcile);

await refresh();
setInterval(refresh, 10_000);

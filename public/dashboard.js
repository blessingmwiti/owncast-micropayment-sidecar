const rateEl = document.querySelector("#rate");
const streamStatusEl = document.querySelector("#stream-status");
const viewerCountEl = document.querySelector("#viewer-count");
const rationaleEl = document.querySelector("#rationale");
const totalEl = document.querySelector("#total");
const sessionsEl = document.querySelector("#sessions");
const settlementsEl = document.querySelector("#settlements");
const refreshButton = document.querySelector("#refresh");
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
  const [rateResponse, ledgerResponse] = await Promise.all([
    fetch("/agent/rate"),
    fetch("/ledger", { headers })
  ]);
  const decision = await rateResponse.json();
  const ledger = await ledgerResponse.json();

  if (!ledgerResponse.ok) {
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
  renderSessions(ledger.sessions ?? []);
  renderSettlements(ledger.settlements ?? []);
}

refreshButton.addEventListener("click", refresh);

await refresh();
setInterval(refresh, 10_000);

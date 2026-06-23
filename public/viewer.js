const rateEl = document.querySelector("#rate");
const viewerCountEl = document.querySelector("#viewer-count");
const rationaleEl = document.querySelector("#rationale");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#session-form");

async function refreshRate() {
  const response = await fetch("/agent/rate");
  const decision = await response.json();

  rateEl.textContent = `$${Number(decision.ratePerSecond).toFixed(6)}/sec`;
  viewerCountEl.textContent = String(decision.viewerCount ?? 0);
  rationaleEl.textContent = decision.rationale ?? "static rate";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = "Approving session...";

  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());

  try {
    const response = await fetch("/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Session approval failed");
    }

    statusEl.textContent = `Approved at $${Number(body.ratePerSecond).toFixed(
      6
    )}/sec with cap ${body.spendingCapUSDC} USDC`;
  } catch (error) {
    statusEl.classList.add("error");
    statusEl.textContent = error instanceof Error ? error.message : "Approval failed";
  }
});

await refreshRate();
setInterval(refreshRate, 10_000);

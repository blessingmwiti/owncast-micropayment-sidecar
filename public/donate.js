const query = new URLSearchParams(window.location.search);
const campaignId = query.get("campaignId") ?? "owncast-payflow-creator";
const campaignEl = document.querySelector("#campaign");
const currencyEl = document.querySelector("#currency");
const goalEl = document.querySelector("#goal");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#donation-form");

async function loadCampaign() {
  const response = await fetch("/mastodon/campaigns?locale=en&environment=test");
  const campaign = await response.json();

  campaignEl.textContent = campaign.title ?? campaign.id ?? campaignId;
  currencyEl.textContent = campaign.currency ?? "USDC";
  goalEl.textContent = `$${campaign.goal_amount ?? "0.00"}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = "Submitting donation...";

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(`/donate/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Donation failed");
    }

    statusEl.textContent = `Donation ${body.status}: ${body.amountUSDC} USDC`;
  } catch (error) {
    statusEl.classList.add("error");
    statusEl.textContent = error instanceof Error ? error.message : "Donation failed";
  }
});

await loadCampaign();

import { createApp } from "./app.js";
import { config } from "./config.js";
import {
  createOwncastStatusFetcher,
  PricingAgent
} from "./services/pricing-agent.js";
import {
  CircleGatewaySettlementProvider,
  DryRunSettlementProvider
} from "./services/settlement-service.js";
import { JsonLedgerStore } from "./store/ledger-store.js";

const pricingAgent = new PricingAgent(
  {
    baseRatePerSecond: config.BASE_RATE_PER_SECOND,
    minRatePerSecond: config.MIN_RATE_PER_SECOND,
    maxRatePerSecond: config.MAX_RATE_PER_SECOND
  },
  createOwncastStatusFetcher(config.OWNCAST_URL)
);

const app = createApp({
  store: new JsonLedgerStore(config.LEDGER_FILE),
  pricingPolicy: pricingAgent,
  webhookSecret: config.OWNCAST_WEBHOOK_SECRET,
  settlementProvider:
    config.SETTLEMENT_PROVIDER === "circle-gateway"
      ? new CircleGatewaySettlementProvider({
          gatewayUrl: config.CIRCLE_GATEWAY_URL,
          apiKey: config.CIRCLE_API_KEY
        })
      : new DryRunSettlementProvider()
});

const rateLogInterval = setInterval(async () => {
  const decision = await pricingAgent.currentDecision();
  console.log(
    `[Agent] Rate updated to $${decision.ratePerSecond}/sec - ${decision.rationale}`
  );
}, 60_000);
rateLogInterval.unref();

app.listen(config.PORT, () => {
  console.log(`Owncast Payflow listening on port ${config.PORT}`);
});

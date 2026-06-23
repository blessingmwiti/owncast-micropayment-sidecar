import { createApp } from "./app.js";
import { config } from "./config.js";
import { JsonLedgerStore } from "./store/ledger-store.js";

const app = createApp({
  store: new JsonLedgerStore(config.LEDGER_FILE),
  ratePerSecond: config.BASE_RATE_PER_SECOND
});

app.listen(config.PORT, () => {
  console.log(`Owncast Payflow listening on port ${config.PORT}`);
});

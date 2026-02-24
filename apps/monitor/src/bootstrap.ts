import { initRabbit } from "@repo/rabbit";
import { config } from "@repo/config";
import { app } from "./server";

await initRabbit(config.rabbitUrl);

app.listen(4000);
console.log("Monitor running on http://localhost:4000");

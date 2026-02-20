import { initRabbit } from "@repo/rabbit";
import { config } from "@repo/config";
import { app } from "./server";

await initRabbit(config.rabbitUrl);

app.listen(3000);
console.log("API running on http://localhost:3000");

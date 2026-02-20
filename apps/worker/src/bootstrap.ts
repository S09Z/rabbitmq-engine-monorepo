import { initRabbit } from "@repo/rabbit";
import { startConsumer } from "@repo/rabbit/consumer";
import { config } from "@repo/config";
import { logger } from "@repo/logger";

await initRabbit(config.rabbitUrl);

await startConsumer("job_queue", async (data) => {
  logger.info("Processing job", data);

  await new Promise((r) => setTimeout(r, 1000));
});

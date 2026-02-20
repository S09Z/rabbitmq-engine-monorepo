import { getChannel } from "./index";

export async function startConsumer(
  queueName: string,
  handler: (data: unknown) => Promise<void>
) {
  const channel = getChannel();

  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, "jobs", "job.*");

  channel.prefetch(20);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      await handler(data);

      channel.ack(msg);
    } catch (err) {
      channel.nack(msg, false, false);
    }
  });
}

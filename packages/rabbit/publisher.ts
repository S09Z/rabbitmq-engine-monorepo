import { getChannel } from "./index";

export async function publish<T>(
  routingKey: string,
  payload: T
) {
  const channel = getChannel();

  channel.publish(
    "jobs",
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
}

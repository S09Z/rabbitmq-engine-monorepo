import amqp from "amqplib";
import type { Channel, ChannelModel } from "amqplib";

let connection: ChannelModel;
let channel: Channel;

export async function initRabbit(url: string) {
  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  await channel.assertExchange("jobs", "topic", {
    durable: true,
  });
}


export function getChannel(): Channel {
  if (!channel) throw new Error("Rabbit not initialized");
  return channel;
}

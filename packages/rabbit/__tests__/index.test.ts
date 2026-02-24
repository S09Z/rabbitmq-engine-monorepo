import { mock, describe, it, expect, beforeEach } from "bun:test";

// --- mocks (hoisted above imports by bun) ---

const mockAssertExchange = mock(() => Promise.resolve());

const mockCreateChannel = mock(() =>
  Promise.resolve({ assertExchange: mockAssertExchange })
);

const mockConnect = mock(() =>
  Promise.resolve({ createChannel: mockCreateChannel })
);

mock.module("amqplib", () => ({
  default: { connect: mockConnect },
}));

// --- module under test ---

import { initRabbit, getChannel } from "../index";

// ─────────────────────────────────────────────
// initRabbit
// ─────────────────────────────────────────────
describe("initRabbit", () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockCreateChannel.mockClear();
    mockAssertExchange.mockClear();
  });

  it("connects using the provided URL", async () => {
    await initRabbit("amqp://localhost");
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledWith("amqp://localhost");
  });

  it("creates a channel from the connection", async () => {
    await initRabbit("amqp://localhost");
    expect(mockCreateChannel).toHaveBeenCalledTimes(1);
  });

  it("asserts a durable topic exchange named 'jobs'", async () => {
    await initRabbit("amqp://localhost");
    expect(mockAssertExchange).toHaveBeenCalledTimes(1);
    expect(mockAssertExchange).toHaveBeenCalledWith("jobs", "topic", {
      durable: true,
    });
  });
});

// ─────────────────────────────────────────────
// getChannel — after initialisation
// ─────────────────────────────────────────────
describe("getChannel (after init)", () => {
  it("returns the channel without throwing", async () => {
    await initRabbit("amqp://localhost");
    expect(() => getChannel()).not.toThrow();
  });
});

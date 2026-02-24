import { mock, describe, it, expect, beforeEach, afterAll } from "bun:test";

// ─────────────────────────────────────────────
// Fake channel
// ─────────────────────────────────────────────

const mockPublish = mock(() => true);

const mockChannel = { publish: mockPublish };

mock.module("../index", () => ({
  getChannel: () => mockChannel,
}));

// ─────────────────────────────────────────────
// Module under test
// ─────────────────────────────────────────────

import { publish } from "../publisher";

afterAll(() => mock.restore());

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("publish", () => {
  beforeEach(() => {
    mockPublish.mockClear();
  });

  it("publishes to the 'jobs' exchange", async () => {
    await publish("job.create", { jobId: "123" });

    const [exchange] = mockPublish.mock.calls[0]!;
    expect(exchange).toBe("jobs");
  });

  it("uses the provided routing key", async () => {
    await publish("job.process", { jobId: "123" });

    const [, routingKey] = mockPublish.mock.calls[0]!;
    expect(routingKey).toBe("job.process");
  });

  it("serialises the payload as JSON inside a Buffer", async () => {
    const payload = { jobId: "abc-123", userId: "u1", data: { x: 42 } };

    await publish("job.create", payload);

    const [, , buffer] = mockPublish.mock.calls[0]!;
    expect(buffer).toBeInstanceOf(Buffer);
    expect(JSON.parse((buffer as Buffer).toString())).toEqual(payload);
  });

  it("marks messages as persistent", async () => {
    await publish("job.create", { jobId: "abc" });

    const [, , , options] = mockPublish.mock.calls[0]!;
    expect(options).toEqual({ persistent: true });
  });

  it("calls channel.publish exactly once per invocation", async () => {
    await publish("job.create", { jobId: "x" });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });
});

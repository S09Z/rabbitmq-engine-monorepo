import { mock, describe, it, expect, beforeEach, afterAll } from "bun:test";

// ─────────────────────────────────────────────
// Fake channel + captured consume callback
// ─────────────────────────────────────────────

type OnMessage = (msg: { content: Buffer } | null) => Promise<void>;

let capturedCallback: OnMessage | null = null;

const mockAck = mock(() => {});
const mockNack = mock(() => {});
const mockPrefetch = mock(() => {});
const mockAssertQueue = mock(() => Promise.resolve());
const mockBindQueue = mock(() => Promise.resolve());
const mockConsume = mock((_queue: string, cb: OnMessage) => {
  capturedCallback = cb;
  return Promise.resolve({ consumerTag: "test-tag" });
});

const mockChannel = {
  assertQueue: mockAssertQueue,
  bindQueue: mockBindQueue,
  prefetch: mockPrefetch,
  consume: mockConsume,
  ack: mockAck,
  nack: mockNack,
};

mock.module("../index", () => ({
  getChannel: () => mockChannel,
}));

// ─────────────────────────────────────────────
// Module under test
// ─────────────────────────────────────────────

import { startConsumer } from "../consumer";

afterAll(() => mock.restore());

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("startConsumer", () => {
  const QUEUE = "job_queue";
  const handler = mock(() => Promise.resolve());

  beforeEach(() => {
    mockAssertQueue.mockClear();
    mockBindQueue.mockClear();
    mockPrefetch.mockClear();
    mockConsume.mockClear();
    mockAck.mockClear();
    mockNack.mockClear();
    handler.mockClear();
    capturedCallback = null;
  });

  it("asserts the queue as durable", async () => {
    await startConsumer(QUEUE, handler);
    expect(mockAssertQueue).toHaveBeenCalledTimes(1);
    expect(mockAssertQueue).toHaveBeenCalledWith(QUEUE, { durable: true });
  });

  it("binds the queue to the jobs exchange with routing key 'job.*'", async () => {
    await startConsumer(QUEUE, handler);
    expect(mockBindQueue).toHaveBeenCalledTimes(1);
    expect(mockBindQueue).toHaveBeenCalledWith(QUEUE, "jobs", "job.*");
  });

  it("sets channel prefetch to 20", async () => {
    await startConsumer(QUEUE, handler);
    expect(mockPrefetch).toHaveBeenCalledTimes(1);
    expect(mockPrefetch).toHaveBeenCalledWith(20);
  });

  it("starts consuming from the given queue", async () => {
    await startConsumer(QUEUE, handler);
    expect(mockConsume).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(QUEUE, expect.any(Function));
  });

  // ── message callback behaviour ──────────────
  describe("message callback", () => {
    beforeEach(async () => {
      await startConsumer(QUEUE, handler);
    });

    it("returns early without calling the handler when message is null", async () => {
      await capturedCallback!(null);

      expect(handler).not.toHaveBeenCalled();
      expect(mockAck).not.toHaveBeenCalled();
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("parses message JSON and passes the data to the handler", async () => {
      const payload = { jobId: "abc-123", userId: "user-1", data: {} };
      const msg = { content: Buffer.from(JSON.stringify(payload)) };

      await capturedCallback!(msg);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("acks the message after the handler succeeds", async () => {
      const msg = { content: Buffer.from(JSON.stringify({ jobId: "abc" })) };

      await capturedCallback!(msg);

      expect(mockAck).toHaveBeenCalledTimes(1);
      expect(mockAck).toHaveBeenCalledWith(msg);
      expect(mockNack).not.toHaveBeenCalled();
    });

    it("nacks without requeue when the handler throws", async () => {
      handler.mockImplementationOnce(() => {
        throw new Error("processing failed");
      });
      const msg = { content: Buffer.from(JSON.stringify({ jobId: "abc" })) };

      await capturedCallback!(msg);

      expect(mockNack).toHaveBeenCalledTimes(1);
      expect(mockNack).toHaveBeenCalledWith(msg, false, false);
      expect(mockAck).not.toHaveBeenCalled();
    });

    it("nacks without requeue when message content is invalid JSON", async () => {
      const msg = { content: Buffer.from("not-valid-json!!") };

      await capturedCallback!(msg);

      expect(mockNack).toHaveBeenCalledTimes(1);
      expect(mockNack).toHaveBeenCalledWith(msg, false, false);
      expect(mockAck).not.toHaveBeenCalled();
    });
  });
});

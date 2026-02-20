import { Elysia } from "elysia";
import { publish } from "@repo/rabbit/publisher";
import type { CreateJobPayload } from "@repo/types/job";

export const app = new Elysia()
  .post("/jobs", async ({ body, set }) => {
    const payload = body as CreateJobPayload;

    await publish("job.create", payload);

    set.status = 202;
    return { status: "queued", jobId: payload.jobId };
  });

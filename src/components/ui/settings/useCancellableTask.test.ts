import { describe, it, expect } from "vitest";
import { createCancellableTask } from "./useCancellableTask";

describe("createCancellableTask", () => {
  it("reports progress for each unit and completes", async () => {
    const seen: number[] = [];
    const task = createCancellableTask(
      3,
      async (i, report) => {
        report(i + 1);
      },
      { onProgress: (done, total) => seen.push(done / total) }
    );
    const result = await task.run();
    expect(result.status).toBe("done");
    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it("stops as soon as cancel is called", async () => {
    let processed = 0;
    const task = createCancellableTask(10, async () => {
      processed += 1;
    });
    const promise = task.run();
    task.cancel();
    const result = await promise;
    expect(result.status).toBe("cancelled");
    expect(processed).toBeLessThan(10);
  });

  it("surfaces a failure without throwing", async () => {
    const task = createCancellableTask(2, async (i) => {
      if (i === 1) throw new Error("boom");
    });
    const result = await task.run();
    expect(result.status).toBe("error");
    expect(result.error).toBe("boom");
  });
});

import { describe, it, expect } from "vitest";
import { formatTime } from "./formatTime";

describe("formatTime", () => {
  it("should format seconds into M:SS correctly", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("should handle NaN and negative numbers", () => {
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(-10)).toBe("0:00");
  });

  it("should handle large numbers", () => {
    expect(formatTime(3600)).toBe("60:00");
    expect(formatTime(7200)).toBe("120:00");
  });
});

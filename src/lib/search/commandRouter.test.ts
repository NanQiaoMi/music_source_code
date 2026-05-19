import { describe, expect, it } from "vitest";
import { parseSearchCommand } from "./commandRouter";

describe("parseSearchCommand", () => {
  it("parses plain text as text-search", () => {
    expect(parseSearchCommand("hello world")).toEqual({
      kind: "text-search",
      query: "hello world",
      raw: "hello world",
    });
  });

  it("parses play and queue commands with query text", () => {
    expect(parseSearchCommand("/play ocean eyes")).toMatchObject({
      kind: "play",
      query: "ocean eyes",
    });
    expect(parseSearchCommand("/queue late night")).toMatchObject({
      kind: "queue",
      query: "late night",
    });
  });

  it("parses clear and shuffle commands", () => {
    expect(parseSearchCommand("/clear")).toMatchObject({ kind: "clear", query: "" });
    expect(parseSearchCommand("/shuffle")).toMatchObject({ kind: "shuffle", query: "" });
  });

  it("parses sleep command minutes and validation boundaries", () => {
    expect(parseSearchCommand("/sleep 25m")).toMatchObject({
      kind: "sleep",
      minutes: 25,
    });
    expect(parseSearchCommand("/sleep 10")).toMatchObject({
      kind: "sleep",
      minutes: 10,
    });
    expect(parseSearchCommand("/sleep 30m")).toMatchObject({
      kind: "sleep",
      minutes: 30,
    });
    expect(parseSearchCommand("/sleep 0m")).toMatchObject({
      kind: "sleep",
      minutes: 1,
    });
    expect(parseSearchCommand("/sleep abc")).toMatchObject({
      kind: "sleep",
      minutes: undefined,
    });
  });

  it("falls back to text-search for unknown slash commands", () => {
    expect(parseSearchCommand("/unknown value")).toEqual({
      kind: "text-search",
      query: "/unknown value",
      raw: "/unknown value",
    });
  });
});

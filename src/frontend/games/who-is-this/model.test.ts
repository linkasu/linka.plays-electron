import { describe, expect, it } from "vitest";
import { MATCH_SAME_PROMPT } from "../match-same/model";
import { WHO_IS_THIS_CHILD_TITLE } from "./model";

describe("who-is-this alias", () => {
  it("uses the canonical match-same child-facing copy", () => {
    expect(WHO_IS_THIS_CHILD_TITLE).toBe("Покажи такое же");
    expect(WHO_IS_THIS_CHILD_TITLE).toBe(MATCH_SAME_PROMPT);
  });
});

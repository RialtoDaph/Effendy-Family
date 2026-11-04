import { describe, expect, it } from "vitest";
import de from "../messages/de.json";
import en from "../messages/en.json";
import id from "../messages/id.json";

function leaves(value: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(path, v);
    else for (const [p, s] of leaves(v, path)) out.set(p, s);
  }
  return out;
}

const args = (s: string) => [...s.matchAll(/(?<!')\{(\w+)[,}]/g)].map((m) => m[1]).sort();

describe("messages", () => {
  const base = leaves(en);

  it.each([
    ["de", de],
    ["id", id],
  ])("%s has every English key and nothing else", (_, messages) => {
    expect([...leaves(messages).keys()].sort()).toEqual([...base.keys()].sort());
  });

  it.each([
    ["de", de],
    ["id", id],
  ])("%s keeps the same {placeholders}", (_, messages) => {
    for (const [key, text] of leaves(messages)) expect([key, args(text)]).toEqual([key, args(base.get(key)!)]);
  });

  it("no message is empty", () => {
    for (const messages of [en, de, id]) for (const [key, text] of leaves(messages)) expect([key, text.trim().length > 0]).toEqual([key, true]);
  });
});

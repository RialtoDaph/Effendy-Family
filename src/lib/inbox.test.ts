import { describe, expect, it } from "vitest";
import { MAX_MAILS, cleanMails, gmailLink, mergeDigest, senderName } from "./inbox";

const mails = cleanMails([
  { id: "m1", thread: "t1", from: "Telekom <rechnung@telekom.de>", subject: "Ihre Rechnung", date: "2026-10-13", body: "Betrag 39,95 EUR fällig am 20.10." },
  { id: "m2", thread: "t2", from: "Newsletter <n@shop.de>", subject: "Sale", date: "2026-10-13", body: "50% off" },
  { id: "m3", thread: "t3", from: "Dr. Weber", subject: "Termin", date: "2026-10-13", body: "Termin am 22.10. um 9:30" },
]);

describe("inbox digest", () => {
  it("cleans and limits what the script sends", () => {
    const many = cleanMails(Array.from({ length: 80 }, (_, i) => ({ id: `x${i}`, body: "a".repeat(5000) })));
    expect(many).toHaveLength(MAX_MAILS);
    expect(many[0].body.length).toBe(1500);
    expect(many[0].thread).toBe("x0");
    expect(cleanMails([{ id: "a" }, { id: "a" }, { nope: 1 }])).toHaveLength(1);
    expect(cleanMails("not a list")).toEqual([]);
  });

  it("keeps sender and subject from the mail, sorts important first, drops bad action values", () => {
    const d = mergeDigest(mails, {
      summary: "Pay the Telekom bill.",
      items: [
        { id: "m2", group: "rest", title: "Shop sale", why: "ignore me", action_kind: "none", action_title: "", action_date: null, action_time: null, action_amount: null, action_day: null },
        { id: "m1", group: "important", title: "Telekom bill €39.95, due 20 Oct", why: "Pay by 20 Oct.", action_kind: "event", action_title: "Pay Telekom", action_date: "2026-10-20", action_time: "25:99", action_amount: -5, action_day: null },
        { id: "evil", group: "important", title: "Injected", why: "", action_kind: "tax", action_title: "x", action_date: null, action_time: null, action_amount: null, action_day: null },
      ],
    });
    expect(d.items.map((i) => i.id)).toEqual(["m1", "m2", "m3"]);
    expect(d.items[0]).toMatchObject({ from: "Telekom <rechnung@telekom.de>", subject: "Ihre Rechnung", group: "important" });
    expect(d.items[0].action).toEqual({ kind: "event", title: "Pay Telekom", date: "2026-10-20", time: null, amount: null, day: null });
    expect(d.items[1].why).toBe("");
    // m3 was skipped by the AI: kept as "rest" with its subject
    expect(d.items[2]).toMatchObject({ group: "rest", title: "Termin", action: { kind: "none" } });
  });

  it("caps a recurring day at 28", () => {
    const d = mergeDigest(mails.slice(0, 1), {
      summary: "",
      items: [{ id: "m1", group: "important", title: "t", why: "w", action_kind: "recurring", action_title: "Telekom", action_date: null, action_time: null, action_amount: 39.954, action_day: 31 }],
    });
    expect(d.items[0].action).toMatchObject({ kind: "recurring", amount: 39.95, day: 28 });
  });

  it("links and names", () => {
    expect(gmailLink("t1", "a@b.de")).toBe("https://mail.google.com/mail/?authuser=a%40b.de#all/t1");
    expect(senderName("Telekom <rechnung@telekom.de>")).toBe("Telekom");
    expect(senderName('"Dr. Weber" <w@x.de>')).toBe("Dr. Weber");
    expect(senderName("plain@x.de")).toBe("plain@x.de");
  });
});

import { inboxScript } from "./inbox-script";

describe("Apps Script", () => {
  it("runs in a fake Google account and posts only new mail from others", () => {
    const now = Date.now();
    const msg = (id: string, from: string, ageH: number, draft = false) => ({
      getId: () => id,
      getFrom: () => from,
      getSubject: () => `Subject ${id}`,
      getDate: () => new Date(now - ageH * 3600_000),
      getPlainBody: () => "Hello   there\n\nline two",
      isDraft: () => draft,
    });
    const threads = [
      { getId: () => "t1", getMessages: () => [msg("old", "a@x.de", 30), msg("new1", "Bank <b@bank.de>", 2), msg("mine", "me@gmail.com", 1)] },
      { getId: () => "t2", getMessages: () => [msg("new2", "c@x.de", 5), msg("draft", "c@x.de", 1, true)] },
    ];
    const store: Record<string, string> = {};
    const sent: { url: string; opts: { headers: Record<string, string>; payload: string } }[] = [];
    let query = "";
    const triggers: string[] = [];
    const env = {
      PropertiesService: { getUserProperties: () => ({ getProperty: (k: string) => store[k] ?? null, setProperty: (k: string, v: string) => (store[k] = v) }) },
      Session: { getActiveUser: () => ({ getEmail: () => "me@gmail.com" }) },
      GmailApp: { search: (q: string) => ((query = q), threads) },
      UrlFetchApp: { fetch: (url: string, opts: (typeof sent)[number]["opts"]) => (sent.push({ url, opts }), { getResponseCode: () => 200, getContentText: () => "{}" }) },
      ScriptApp: {
        getProjectTriggers: () => [],
        deleteTrigger: () => {},
        newTrigger: (fn: string) => {
          const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, inTimezone: () => b, create: () => triggers.push(fn) };
          return b;
        },
      },
      console: { log: () => {} },
    };
    const code = inboxScript("https://effendyfamily.vercel.app/", "efk_" + "a".repeat(64));
    new Function(...Object.keys(env), `${code}\nsetup();`)(...Object.values(env));

    expect(triggers).toEqual(["sendDigest"]);
    expect(query).toContain("-category:promotions -category:social");
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://effendyfamily.vercel.app/api/inbox");
    expect(sent[0].opts.headers.Authorization).toBe("Bearer efk_" + "a".repeat(64));
    const body = JSON.parse(sent[0].opts.payload);
    expect(body.account).toBe("me@gmail.com");
    expect(body.emails.map((e: { id: string }) => e.id)).toEqual(["new1", "new2"]);
    expect(body.emails[0]).toMatchObject({ thread: "t1", body: "Hello there line two" });
    expect(Number(store.since)).toBeGreaterThan(now - 1000);
  });
});

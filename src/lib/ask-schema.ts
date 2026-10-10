// What Rialna returns, shared by the server route and the app.

export const ACTIONS = ["none", "whatif", "budget", "debts", "subs", "remit", "tax", "invest", "sim", "week", "shifts", "ygoals", "import", "report", "setup"] as const;
export type AskAction = (typeof ACTIONS)[number];

export type Answer = { text: string; nums: { label: string; value: string }[]; next: string | null; action: AskAction };

export const ACTION_LABEL: Record<AskAction, string> = {
  none: "",
  whatif: "Open What if",
  budget: "Open Budget",
  debts: "Open Debts",
  subs: "Open Subscriptions",
  remit: "Open To Indonesia",
  tax: "Open Taxes",
  invest: "Open Invest",
  sim: "Open 10-year simulation",
  week: "Open This week",
  shifts: "Open Shifts",
  ygoals: "Open Yearly goals",
  import: "Open Bank import",
  report: "Open Monthly report",
  setup: "Open Setup",
};

const SHARED = `You are Rialna, the assistant inside Effendy Family, a private app for Rialto and Amnah Effendy, a couple living in Eichstätt, Germany (family roots in Indonesia).
Use only the DATA message. It holds everything the asking person may see; items marked private_to belong to that person. Never guess about anything that is not in the data, and never speculate that hidden or private items exist.
Money is in euro, written like €1,234 or €12.50 (Rupiah as Rp 1.500.000). Round sensibly.
nums: up to 3 key numbers from the data that support the answer, each with a short label. Leave it empty if no number helps.
next: one concrete next step in a short sentence, or null. action: the app screen that helps with that step, or "none".
Write plain text without markdown, warm and direct. No regulated investment, tax or legal advice beyond general information; for tax specifics suggest asking a Steuerberater.`;

export const ASK_PROMPT = `${SHARED}
Answer the question in the language it was asked in (English, Indonesian or German). Keep the text under 90 words.
If the data does not contain what is needed, say so in one sentence and suggest what to add in the app.`;

export const BRIEFING_PROMPT = `${SHARED}
Write a short daily briefing in English: 2 or 3 sentences, under 60 words. Cover the flexible money left this month and per day, anything due or important in the next days (bills, tax deadlines, shifts, plans), and one encouraging note about a goal. Put up to 3 key numbers in nums.`;

export function answerSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["text", "nums", "next", "action"],
    properties: {
      text: { type: "string" },
      nums: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } },
      },
      next: { type: ["string", "null"] },
      action: { type: "string", enum: [...ACTIONS] },
    },
  };
}

// Builds src/messages/{en,de,id}.json from the design handoff, so every string
// keeps the exact wording of the prototype's T map and rideff-i18n.js.
// Run: node scripts/build-messages.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "design_handoff_rideff");
const html = fs.readFileSync(path.join(dir, "rideff Life v4.dc.html"), "utf8");
const LANGS = ["en", "de", "id"];

/** Returns the source of the `{...}` literal that follows `marker`. */
function literalAfter(marker) {
  const start = html.indexOf("{", html.indexOf(marker));
  let depth = 0;
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`No literal after ${marker}`);
}

const evaluate = (src) => vm.runInNewContext(`(${src})`);
const T = evaluate(literalAfter("const T = {"));
const EX = evaluate(literalAfter("const EX = {"));

const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(dir, "rideff-i18n.js"), "utf8").replace("const de = {}", "window.RL_ROWS = R; const de = {}"),
  ctx,
);
const rows = ctx.window.RL_ROWS;

// ICU treats < > { } as syntax; the prototype means them literally.
const icu = (s) => s.replace(/[<>{}]/g, (c) => `'${c}'`);

function keyMaker() {
  const used = new Map();
  return (english) => {
    const base =
      english
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 56)
        .replace(/_+$/, "") || "x";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  };
}

const out = Object.fromEntries(LANGS.map((l) => [l, { t: {}, nav: {}, copy: {}, empty: {} }]));

for (const key of Object.keys(T.en)) {
  if (key === "nav") continue; // T.*.nav is keyed by English, handled below
  for (const l of LANGS) out[l].t[key] = icu(T[l][key]);
}

const navKey = keyMaker();
// AskP is a prefix ("Frag"), replaced by ui.ask_name.
for (const english of Object.keys(T.de.nav).filter((k) => k !== "AskP")) {
  const key = navKey(english);
  out.en.nav[key] = icu(english);
  out.de.nav[key] = icu(T.de.nav[english]);
  out.id.nav[key] = icu(T.id.nav[english] ?? english);
}

const copyKey = keyMaker();
const seen = new Set();
for (const [en, de, id] of rows) {
  if (seen.has(en)) continue;
  seen.add(en);
  const key = copyKey(en);
  out.en.copy[key] = icu(en);
  out.de.copy[key] = icu(de);
  out.id.copy[key] = icu(id);
}

for (const [screen, [title, body, action]] of Object.entries(EX)) {
  LANGS.forEach((l, i) => {
    out[l].empty[screen] = { title: icu(title[i]), body: icu(body[i]), action: icu(action[i]) };
  });
}

// Strings the shell needs that the prototype builds in code; see messages-ui.json.
const ui = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-ui.json"), "utf8"));
// The money screens: { key: [en, de, id] }. Plain ICU, so plurals and <b> stay as written.
const money = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-money.json"), "utf8"));
// Time & health, same shape.
const time = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-time.json"), "utf8"));
// Home and the Life Map, same shape.
const home = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-home.json"), "utf8"));
// Clopar and its memory, same shape.
const assistant = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-assistant.json"), "utf8"));
// Settings, plans, security and help, same shape.
const settings = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-settings.json"), "utf8"));
// Tools, reports and the older Invest screens, same shape.
const tools = JSON.parse(fs.readFileSync(path.join(root, "scripts/messages-tools.json"), "utf8"));
const FEATS = evaluate(literalAfter("const FEATS = {"));
for (const l of LANGS) {
  out[l].ui = ui[l];
  out[l].time = Object.fromEntries(Object.entries(time).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  out[l].money = Object.fromEntries(Object.entries(money).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  out[l].home = Object.fromEntries(Object.entries(home).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  out[l].assistant = Object.fromEntries(Object.entries(assistant).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  out[l].settings = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  out[l].plans = FEATS[l] ?? FEATS.en;
  out[l].tools = Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, v[LANGS.indexOf(l)]]));
  fs.writeFileSync(path.join(root, `src/messages/${l}.json`), `${JSON.stringify(out[l], null, 2)}\n`);
}
console.log(
  `t ${Object.keys(out.en.t).length} · nav ${Object.keys(out.en.nav).length} · copy ${Object.keys(out.en.copy).length} · empty ${Object.keys(out.en.empty).length} · ui ${Object.keys(ui.en).length}`,
);

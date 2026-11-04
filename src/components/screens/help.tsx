"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "./page-header";

type Cat = "start" | "money" | "sharing" | "plan" | "privacy";

// Questions and answers come from the prototype's wording; [category, question, answer].
const ITEMS: [Cat, string, string][] = [
  ["start", "copy.how_do_i_put_in_my_real_data", "copy.open_setup_data_it_walks_you_through_income_bank_stateme"],
  ["start", "copy.which_languages_does_the_app_speak", "copy.deutsch_english_and_bahasa_indonesia_change_it_in_settin"],
  ["money", "copy.how_do_i_import_my_bank_statement", "copy.money_bank_import_pick_your_bank_then_upload_the_csv_or"],
  ["money", "copy.when_can_i_connect_my_bank_directly", "copy.live_bank_sync_through_open_banking_psd2_is_coming_soon"],
  ["money", "copy.does_rideff_life_ever_move_my_money", "copy.no_every_connection_is_read_only_we_can_see_transactions"],
  ["sharing", "copy.how_do_i_invite_my_partner", "copy.settings_plan_billing_invite_your_partner_joins_your_hou"],
  ["sharing", "copy.what_can_my_partner_see", "copy.shared_money_shared_goals_and_the_calendar_anything_mark"],
  ["plan", "copy.how_do_i_cancel_or_change_my_plan", "copy.settings_plan_billing_manage_changes_take_effect_right_a"],
  ["privacy", "copy.where_is_my_data_stored", "copy.on_servers_in_the_eu_frankfurt_encrypted_we_follow_the_d"],
  ["privacy", "settings.help_delete_q", "settings.help_delete_a"],
];

const CATS: Cat[] = ["start", "money", "sharing", "plan", "privacy"];

export function HelpScreen() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Cat | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const text = (k: string) => t(k as "copy.how_can_we_help");

  const q = query.trim().toLowerCase();
  const items = ITEMS.filter(([c, qk, ak]) => (!cat || c === cat) && (!q || `${text(qk)} ${text(ak)}`.toLowerCase().includes(q)));
  const pill = (on: boolean) => `min-h-10 flex-none whitespace-nowrap rounded-full border-0 px-4 text-[13px] font-bold ${on ? "bg-ink text-bg" : "bg-soft2 text-ink"}`;

  return (
    <div data-screen-label="Help" className="flex max-w-[860px] flex-col gap-4">
      <PageHeader eyebrow={t("settings.help_eyebrow")} title={t("copy.how_can_we_help")} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("settings.help_search")}
        placeholder={t("settings.help_search")}
        className="h-[50px] w-full rounded-[10px] border border-line bg-card px-3.5 text-base text-ink outline-none"
      />
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <button onClick={() => setCat(null)} className={pill(!cat)}>
          {t("settings.help_all")}
        </button>
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={pill(cat === c)}>
            {t(`settings.help_${c}`)}
          </button>
        ))}
      </div>
      <section className="rounded-[18px] border border-line bg-card px-5 py-1.5">
        {items.map(([c, qk, ak]) => {
          const on = open === qk;
          return (
            <div key={qk} className="border-b border-line last:border-b-0">
              <button onClick={() => setOpen(on ? null : qk)} aria-expanded={on} className="flex min-h-[52px] w-full items-center gap-3 border-0 bg-transparent py-3 text-left text-ink">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold">{text(qk)}</div>
                  <div className="mt-0.5 text-xs text-mut2">{t(`settings.help_${c}`)}</div>
                </div>
                <span className="flex-none text-lg font-bold text-mut">{on ? "−" : "+"}</span>
              </button>
              {on && <div className="pb-3.5 text-[14px] leading-normal text-mut">{text(ak)}</div>}
            </div>
          );
        })}
        {!items.length && <div className="py-4 text-[13.5px] text-mut">{t("settings.help_none")}</div>}
      </section>
      <Link href="/reports" className="rounded-[10px] border border-line bg-card px-5 py-4 text-ink">
        <div className="text-[15px] font-bold">{t("settings.bug_link")}</div>
        <div className="mt-0.5 text-[13px] text-mut">{t("settings.bug_link_sub")}</div>
      </Link>
    </div>
  );
}

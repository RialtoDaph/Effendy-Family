"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet, Switch } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { supabase } from "@/lib/supabase";

export const SHARE_AREAS = [
  { key: "money", label: "copy.shared_budget_transactions", sub: "copy.everything_not_marked_private" },
  { key: "goals", label: "copy.shared_goals", sub: "copy.savings_you_both_pay_into" },
  { key: "cal", label: "copy.calendar_shifts", sub: "copy.who_is_free_when" },
  { key: "docs", label: "copy.documents_reminders", sub: "copy.mietvertrag_insurance_permits_you_share" },
  { key: "debts", label: "copy.debts", sub: "copy.loans_and_pay_later" },
  { key: "remit", label: "copy.transfers_home", sub: "copy.what_you_send_and_when" },
] as const;

type Share = Record<string, boolean>;
const ALL: Share = { money: true, goals: true, cal: true, docs: true, debts: true, remit: true };
const VIEWER: Share = { money: false, goals: true, cal: true, docs: false, debts: false, remit: false };

const pill = "min-h-[52px] rounded-full border-0 bg-acc text-[15px] font-bold text-onacc";
const heading = "m-0 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] [text-wrap:pretty]";

export function ShareToggles({ share, onChange }: { share: Share; onChange: (next: Share) => void }) {
  const t = useTranslations();
  return (
    <div>
      {SHARE_AREAS.map((a) => (
        <button
          key={a.key}
          type="button"
          aria-pressed={!!share[a.key]}
          onClick={() => onChange({ ...share, [a.key]: !share[a.key] })}
          className="flex min-h-11 w-full items-center gap-3 border-0 border-b border-line bg-transparent py-3 text-left text-ink"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t(a.label)}</span>
            <span className="mt-0.5 block text-xs text-mut">{t(a.sub)}</span>
          </span>
          <Switch on={!!share[a.key]} />
        </button>
      ))}
    </div>
  );
}

/** Who, what they see, then one link that works once. */
export function InviteSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations();
  const toast = useToast();
  const [step, setStep] = useState<"role" | "share" | "send">("role");
  const [role, setRole] = useState<"partner" | "member">("partner");
  const [name, setName] = useState("");
  const [share, setShare] = useState<Share>(ALL);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const who = name.trim();

  async function create() {
    setBusy(true);
    const { data, error } = await supabase().rpc("create_invite", { p_name: who, p_role: role, p_share: share });
    setBusy(false);
    if (error) return toast(error.message.includes("no_seats") ? t("ui.no_seats") : t("ui.invite_failed"));
    setLink(`${window.location.origin}/join/${data as string}`);
    setStep("send");
    onCreated();
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    toast(t("ui.link_copied"));
  }

  const roles = [
    ["partner", "copy.partner", "copy.full_shared_space_can_add_and_edit_has_their_own_private"],
    ["member", "copy.family_viewer", "copy.parents_or_helpers_sees_only_what_you_pick_can_t_edit"],
  ] as const;

  return (
    <Sheet title={t("ui.invite_person")} onClose={onClose}>
      {step === "role" && (
        <div className="flex flex-col gap-[18px]">
          <h2 className={heading}>{t("copy.who_are_you_inviting")}</h2>
          <div className="grid gap-2.5">
            {roles.map(([key, title, sub]) => (
              <button
                key={key}
                onClick={() => {
                  setRole(key);
                  setShare(key === "partner" ? ALL : VIEWER);
                }}
                aria-pressed={role === key}
                className={`flex flex-col rounded-[14px] border-[1.5px] px-[18px] py-4 text-left text-ink ${
                  role === key ? "border-acc bg-tint" : "border-line bg-card"
                }`}
              >
                <span className="text-base font-bold">{t(title)}</span>
                <span className="mt-0.5 text-[12.5px] text-mut">{t(sub)}</span>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] font-bold text-mut">{t("copy.their_first_name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="h-[52px] rounded-[10px] border border-line bg-card px-3.5 text-base text-ink outline-none"
            />
          </label>
          <button onClick={() => (who ? setStep("share") : toast(t("ui.name_needed")))} className={pill}>
            {t("ui.continue")}
          </button>
        </div>
      )}
      {step === "share" && (
        <div className="flex flex-col gap-[18px]">
          <div>
            <h2 className={heading}>{t("ui.what_x_can_see", { name: who })}</h2>
            <p className="m-0 mt-1.5 text-[14.5px] leading-normal text-mut">{t("copy.you_can_change_this_later_in_settings_members")}</p>
          </div>
          <ShareToggles share={share} onChange={setShare} />
          <div className="flex flex-col gap-2 rounded-[12px] bg-soft px-4 py-3.5">
            <div className="text-[13px] font-bold">{t("copy.always_private_for_both_of_you")}</div>
            <div className="text-[13px] leading-normal text-mut">{t("copy.journal_ai_chats_and_any_goal_or_transaction_marked_priv")}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("role")}
              className="min-h-[52px] rounded-full border border-line bg-card px-[22px] text-[15px] font-bold text-ink"
            >
              {t("copy.back")}
            </button>
            <button onClick={create} disabled={busy} className={`${pill} flex-1 disabled:opacity-60`}>
              {t("copy.create_invite")}
            </button>
          </div>
        </div>
      )}
      {step === "send" && (
        <div className="flex flex-col gap-[18px]">
          <div>
            <h2 className={heading}>{t("ui.send_it_to_name", { name: who })}</h2>
            <p className="m-0 mt-1.5 text-[14.5px] leading-normal text-mut">{t("copy.the_link_works_once_and_expires_in_7_days")}</p>
          </div>
          <div className="flex items-center gap-2.5 rounded-[12px] border border-line2 bg-soft py-2 pl-4 pr-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">{link}</span>
            <button onClick={copy} className="min-h-10 flex-none rounded-[10px] border-0 bg-acc px-3.5 text-[13px] font-bold text-onacc">
              {t("copy.copy")}
            </button>
          </div>
          <button onClick={onClose} className={pill}>
            {t("copy.done")}
          </button>
        </div>
      )}
    </Sheet>
  );
}

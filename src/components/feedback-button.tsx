"use client";

import { Bug } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormSheet, type Field } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { sendFeedback, type FeedbackKind } from "@/lib/feedback";

export function useFeedbackFields(): Field[] {
  const t = useTranslations("tools");
  return [
    {
      kind: "chips",
      key: "kind",
      label: t("fb_what"),
      required: true,
      options: [
        { value: "bug", label: t("k_bug") },
        { value: "idea", label: t("k_idea") },
        { value: "other", label: t("k_other") },
      ],
    },
    { kind: "text", key: "title", label: t("fb_line"), placeholder: t("fb_line_ph"), required: true },
    { kind: "textarea", key: "note", label: t("fb_details"), placeholder: t("fb_details_ph"), rows: 4 },
  ];
}

/** Small round button above the + button: report a bug or an idea from any screen. */
export function FeedbackButton() {
  const t = useTranslations("tools");
  const fields = useFeedbackFields();
  const [open, setOpen] = useState(false);
  const path = usePathname() ?? "/";
  const toast = useToast();

  return (
    <>
      <button
        data-noprint
        onClick={() => setOpen(true)}
        aria-label={t("fb_title")}
        title={t("fb_title")}
        className="fixed bottom-[calc(162px+env(safe-area-inset-bottom))] right-[25px] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink shadow-[0_4px_14px_rgba(0,0,0,.14)] hover:bg-soft2 wide:bottom-[94px] wide:right-[35px]"
      >
        <Bug size={19} strokeWidth={2.2} />
      </button>
      {open && (
        <FormSheet
          title={t("fb_title")}
          fields={[
            ...fields,
            { kind: "note", key: "where", label: t("fb_sent"), text: t("fb_sent_text", { path }) },
          ]}
          initial={{ kind: "bug" }}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            const err = await sendFeedback({ kind: String(v.kind) as FeedbackKind, title: String(v.title ?? ""), note: String(v.note ?? ""), page: path });
            if (err) return err;
            setOpen(false);
            toast(t("fb_thanks"));
          }}
        />
      )}
    </>
  );
}

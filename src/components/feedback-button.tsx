"use client";

import { Bug } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FormSheet, type Field } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { sendFeedback, type FeedbackKind } from "@/lib/feedback";

export const FEEDBACK_FIELDS: Field[] = [
  {
    kind: "chips",
    key: "kind",
    label: "What is it?",
    required: true,
    options: [
      { value: "bug", label: "Bug" },
      { value: "idea", label: "Idea" },
      { value: "other", label: "Other" },
    ],
  },
  { kind: "text", key: "title", label: "In one line", placeholder: "e.g. Budget shows the wrong total", required: true },
  { kind: "textarea", key: "note", label: "Details (optional)", placeholder: "What did you tap, what did you expect, what happened?", rows: 4 },
];

/** Small round button above the + button: report a bug or an idea from any screen. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const path = usePathname() ?? "/";
  const toast = useToast();

  return (
    <>
      <button
        data-noprint
        onClick={() => setOpen(true)}
        aria-label="Report a bug or idea"
        title="Report a bug or idea"
        className="fixed bottom-[calc(162px+env(safe-area-inset-bottom))] right-[25px] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink shadow-[0_4px_14px_rgba(0,0,0,.14)] hover:bg-soft2 wide:bottom-[94px] wide:right-[35px]"
      >
        <Bug size={19} strokeWidth={2.2} />
      </button>
      {open && (
        <FormSheet
          title="Report a bug or idea"
          fields={[
            ...FEEDBACK_FIELDS,
            { kind: "note", key: "where", label: "Sent with it", text: `Screen ${path} and your phone type, so it is easier to find.` },
          ]}
          initial={{ kind: "bug" }}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            const err = await sendFeedback({ kind: String(v.kind) as FeedbackKind, title: String(v.title ?? ""), note: String(v.note ?? ""), page: path });
            if (err) return err;
            setOpen(false);
            toast("Thanks, report saved. See it under Bug reports.");
          }}
        />
      )}
    </>
  );
}

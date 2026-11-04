"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("ui");
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-4 p-6 wide:items-center">
      <div className="eyebrow">404</div>
      <h1 className="m-0 font-serif text-4xl font-normal tracking-[-0.01em]">{t("not_found")}</h1>
      <Link href="/" className="flex min-h-[46px] items-center rounded-full bg-acc px-5 text-sm font-bold text-onacc hover:text-onacc">
        {t("back_home")}
      </Link>
    </main>
  );
}

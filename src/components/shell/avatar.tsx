import type { Member } from "@/components/app-data";

const DEFAULT_COLORS: [string, string][] = [
  ["var(--inv)", "var(--acc2)"],
  ["var(--tint)", "var(--acct)"],
];

export function avatarColors(m: Pick<Member, "avatar_bg" | "avatar_fg" | "sort"> | undefined) {
  const d = DEFAULT_COLORS[(m?.sort ?? 0) % 2];
  return { bg: m?.avatar_bg || d[0], fg: m?.avatar_fg || d[1] };
}

export function Avatar({ member, size = 32 }: { member: Member | undefined; size?: number }) {
  const { bg, fg } = avatarColors(member);
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full font-black"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
    >
      {member?.display_name?.[0]?.toUpperCase() ?? "·"}
    </span>
  );
}

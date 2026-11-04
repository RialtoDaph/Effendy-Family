// Placeholder mark: the handoff references assets/rideff-logo.png but does not include it.
export function LogoTile({ size = 32 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-none items-center justify-center font-serif text-white shadow-[0_0_0_1px_var(--line)]"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 14 : 10,
        background: "#0A0A0A",
        fontSize: size * 0.72,
        lineHeight: 1,
        paddingBottom: size * 0.1,
      }}
    >
      r
    </div>
  );
}

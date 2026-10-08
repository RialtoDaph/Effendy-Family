export function LogoTile({ size = 32 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="flex flex-none items-center justify-center font-extrabold text-white shadow-[0_0_0_1px_var(--line)]"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 14 : 10,
        background: "#0A0A0A",
        fontSize: size / 2,
        letterSpacing: "-0.04em",
      }}
    >
      ef
    </div>
  );
}

import { notFound } from "next/navigation";
import { ScreenPlaceholder } from "@/components/screens/placeholder";
import { PLACEHOLDER_SCREENS, screenInfo } from "@/lib/nav";

export function generateStaticParams() {
  return PLACEHOLDER_SCREENS.map((screen) => ({ screen }));
}

export default async function ScreenPage({ params }: PageProps<"/[screen]">) {
  const { screen } = await params;
  const info = PLACEHOLDER_SCREENS.includes(screen) ? screenInfo(screen) : undefined;
  if (!info) notFound();
  return <ScreenPlaceholder info={info} />;
}

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// usePathname from here, not next/navigation: it drops the rewritten /de prefix,
// which would otherwise cause a hydration mismatch on prerendered pages.
export const { usePathname } = createNavigation(routing);

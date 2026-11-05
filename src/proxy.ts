import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Pages only: not the API, Next internals, or files such as /sw.js and /icons/*.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};

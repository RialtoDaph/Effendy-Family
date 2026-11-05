import { notFound } from "next/navigation";

// Unknown paths land here after the proxy adds the language, so the 404 below is translated.
export default function CatchAll() {
  notFound();
}

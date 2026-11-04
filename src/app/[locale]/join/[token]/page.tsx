import { Suspense } from "react";
import { JoinScreen } from "@/components/auth/join-screen";

export default function JoinPage() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}

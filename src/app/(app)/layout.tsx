import { AppDataProvider } from "@/components/app-data";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <AppDataProvider>
        <AppShell>{children}</AppShell>
      </AppDataProvider>
    </ToastProvider>
  );
}

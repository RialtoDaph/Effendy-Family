import { AppDataProvider } from "@/components/app-data";
import { MoneyProvider } from "@/components/money-data";
import { MoneyFormsProvider } from "@/components/money-forms";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <AppDataProvider>
        <MoneyProvider>
          <MoneyFormsProvider>
            <AppShell>{children}</AppShell>
          </MoneyFormsProvider>
        </MoneyProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}

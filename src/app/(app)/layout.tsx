import { AppDataProvider } from "@/components/app-data";
import { FinanceProvider } from "@/components/finance-data";
import { MoneyProvider } from "@/components/money-data";
import { MoneyFormsProvider } from "@/components/money-forms";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <AppDataProvider>
        <MoneyProvider>
          <FinanceProvider>
            <MoneyFormsProvider>
              <AppShell>{children}</AppShell>
            </MoneyFormsProvider>
          </FinanceProvider>
        </MoneyProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}

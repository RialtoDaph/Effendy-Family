import { AppDataProvider } from "@/components/app-data";
import { FinanceProvider } from "@/components/finance-data";
import { LockProvider } from "@/components/lock";
import { MoneyProvider } from "@/components/money-data";
import { MoneyFormsProvider } from "@/components/money-forms";
import { AppShell } from "@/components/shell/app-shell";
import { TimeProvider } from "@/components/time-data";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <AppDataProvider>
        <LockProvider>
        <MoneyProvider>
          <FinanceProvider>
            <TimeProvider>
              <MoneyFormsProvider>
                <AppShell>{children}</AppShell>
              </MoneyFormsProvider>
            </TimeProvider>
          </FinanceProvider>
        </MoneyProvider>
        </LockProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}

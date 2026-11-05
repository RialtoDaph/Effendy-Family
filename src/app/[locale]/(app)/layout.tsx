import { AppDataProvider } from "@/components/app-data";
import { AssistantProvider } from "@/components/assistant";
import { FinanceProvider } from "@/components/finance-data";
import { LockProvider } from "@/components/lock";
import { PlanGate } from "@/components/plan-gate";
import { MoneyProvider } from "@/components/money-data";
import { MoneyFormsProvider } from "@/components/money-forms";
import { AppShell } from "@/components/shell/app-shell";
import { TimeProvider } from "@/components/time-data";
import { ToastProvider } from "@/components/toast";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <ToastProvider>
      <AppDataProvider>
        <LockProvider>
        <MoneyProvider>
          <FinanceProvider>
            <TimeProvider>
              <MoneyFormsProvider>
                <AssistantProvider>
                  <AppShell>
                    <PlanGate>{children}</PlanGate>
                  </AppShell>
                </AssistantProvider>
              </MoneyFormsProvider>
            </TimeProvider>
          </FinanceProvider>
        </MoneyProvider>
        </LockProvider>
      </AppDataProvider>
    </ToastProvider>
  );
}

import ExpenseList from "./ExpenseList"
import { CrmPageHeader } from "@/components/crm-ui"

export default function WydatkiPage() {
  return (
    <div>
      <CrmPageHeader
        title="Wydatki"
        sub="Wydatki pobrane z Fakturowni. Moduł synchronizacji faktur kosztowych."
      />
      <ExpenseList />
    </div>
  )
}

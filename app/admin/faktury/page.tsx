import FakturaList from "./FakturaList"
import { CrmPageHeader } from "@/components/crm-ui"

export default function FakturyPage() {
  return (
    <div>
      <CrmPageHeader
        title="Faktury"
        sub="Faktury pobrane z Fakturowni. Możesz przypisać je do zleceń w systemie."
      />
      <FakturaList />
    </div>
  )
}

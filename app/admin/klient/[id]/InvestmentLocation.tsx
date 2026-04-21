"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import InlineEdit from "./InlineEdit";
import AddressSearch, { AddressData } from "@/components/AddressSearch";

interface Props {
  orderId: Id<"orders">;
  investmentStreet?: string;
  investmentBuildingNumber?: string;
  investmentApartmentNumber?: string;
  investmentPostalCode?: string;
  investmentCity?: string;
}

export default function InvestmentLocation({
  orderId,
  investmentStreet,
  investmentBuildingNumber,
  investmentApartmentNumber,
  investmentPostalCode,
  investmentCity,
}: Props) {
  const updateOrder = useMutation(api.orders.update);

  function save(field: string, value: string) {
    updateOrder({ orderId, [field]: value });
  }

  function handleAddressSelect(address: AddressData) {
    const patch: Record<string, string> = {};
    if (address.street) patch.investmentStreet = address.street;
    if (address.buildingNumber) patch.investmentBuildingNumber = address.buildingNumber;
    if (address.postalCode) patch.investmentPostalCode = address.postalCode;
    if (address.city) patch.investmentCity = address.city;
    if (Object.keys(patch).length > 0) {
      updateOrder({ orderId, ...patch });
    }
  }

  return (
    <div>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Lokalizacja inwestycji
      </div>

      <AddressSearch onSelect={handleAddressSelect} className="mb-4" />

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <InlineEdit
            label="Ulica"
            value={investmentStreet ?? ""}
            placeholder="np. Kwiatowa"
            onSave={(v) => save("investmentStreet", v)}
          />
        </div>
        <div>
          <InlineEdit
            label="Nr domu"
            value={investmentBuildingNumber ?? ""}
            placeholder="np. 12"
            onSave={(v) => save("investmentBuildingNumber", v)}
          />
        </div>
        <div>
          <InlineEdit
            label="Nr mieszkania"
            value={investmentApartmentNumber ?? ""}
            placeholder="np. 4"
            onSave={(v) => save("investmentApartmentNumber", v)}
          />
        </div>
        <div>
          <InlineEdit
            label="Kod pocztowy"
            value={investmentPostalCode ?? ""}
            placeholder="00-000"
            onSave={(v) => save("investmentPostalCode", v)}
          />
        </div>
        <div>
          <InlineEdit
            label="Miejscowość"
            value={investmentCity ?? ""}
            placeholder="np. Warszawa"
            onSave={(v) => save("investmentCity", v)}
          />
        </div>
      </div>
    </div>
  );
}

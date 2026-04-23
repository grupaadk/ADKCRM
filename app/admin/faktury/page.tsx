import FakturaList from "./FakturaList";

export default function FakturyPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Faktury</h1>
        <p className="mt-1 text-sm text-gray-500">
          Faktury pobrane z Fakturowni. Możesz przypisać je do zleceń w systemie.
        </p>
      </div>
      <FakturaList />
    </div>
  );
}

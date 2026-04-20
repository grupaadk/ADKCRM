"use client";

import OrderList from "./OrderList";

export default function ZamowieniaPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Zlecenia</h1>
        <p className="mt-1 text-sm text-gray-500">Lista wszystkich zleceń w systemie.</p>
      </div>

      <OrderList />
    </div>
  );
}

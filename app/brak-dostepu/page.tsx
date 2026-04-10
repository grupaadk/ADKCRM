import { SignOutButton } from "@clerk/nextjs";

export default function BrakDostepu() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center flex flex-col gap-4 items-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <span className="text-2xl font-bold text-red-500">!</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brak dostępu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Twoje konto nie ma uprawnień do tego panelu.
          </p>
        </div>
        <SignOutButton>
          <button className="rounded-md bg-gray-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
            Wyloguj się
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}

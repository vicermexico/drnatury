import { PhoneLoginForm } from "@/components/forms/PhoneLoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">DrBioescaner</h1>
          <p className="mt-2 text-gray-500 text-sm">Ingresa tu número de celular</p>
        </div>
        <PhoneLoginForm />
      </div>
    </main>
  );
}

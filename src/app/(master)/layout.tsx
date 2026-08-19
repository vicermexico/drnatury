import { requireRole } from "@/lib/auth";
import { MasterSidebar } from "@/components/layout/MasterSidebar";

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("MASTER");
  return (
    <div className="flex min-h-screen bg-gray-50">
      <MasterSidebar userName={profile.name} />
      <main className="flex-1 min-w-0 p-4 pt-16 lg:pt-8 lg:p-8">
        {children}
      </main>
    </div>
  );
}

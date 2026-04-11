import { MainNav } from "@/components/main-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--tc-surface)] pb-24">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-5 sm:py-6">
        {children}
      </main>
      <MainNav />
    </div>
  );
}

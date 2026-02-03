import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DatabaseProvider } from "@/components/DatabaseProvider";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Hockey Practice Planner",
  description: "Build and manage hockey practice plans with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * Main layout padding - adjust in Tailwind classes below
   * Mobile: p-2 pt-14 (8px padding, 56px top for nav button)
   * Desktop: p-3 pt-3 (12px padding)
   * 
   * To experiment with values, modify the classes below:
   * - p-2 = 8px, p-3 = 12px, p-4 = 16px
   * - pt-14 = 56px (mobile nav clearance)
   */
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <DatabaseProvider>
            <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
              <Sidebar />
              <main className="flex-1 lg:ml-0 min-h-screen">
                <div className="p-2 lg:p-3 pt-14 lg:pt-3">
                  {children}
                </div>
              </main>
            </div>
          </DatabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

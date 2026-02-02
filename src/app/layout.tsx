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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <DatabaseProvider>
            <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
              <Sidebar />
              <main className="flex-1 lg:ml-0 min-h-screen">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">
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

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { DatabaseProvider } from "@/components/DatabaseProvider";
import { AppLayout } from "@/components/AppLayout";

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
   * Main layout padding is handled in AppLayout component
   * Mobile: p-2 pt-14 (8px padding, 56px top for nav button)
   * Desktop: p-3 pt-3 (12px padding)
   * 
   * Auth pages (login/register) render without sidebar
   * Protected pages render with sidebar
   */
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <DatabaseProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </DatabaseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

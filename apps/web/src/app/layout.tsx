import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider, AuthProvider } from "@novaconnect/data/providers";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NovaConnectSchool - School Management System",
  description: "Modern school management system for web and mobile",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <div className="app-scale-90">
              {children}
            </div>
            <Toaster />
            <SonnerToaster position="top-right" richColors expand={true} />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/lib/auth";
import { CityProvider } from "@/lib/city-context";
import { AppLayout } from "@/components/app-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "UrbanPulse - Traffic Intelligence & Forecasting",
  description: "Cross-city traffic forecasting dashboard: Los Angeles & Mumbai Arterial Corridors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <CityProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </CityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

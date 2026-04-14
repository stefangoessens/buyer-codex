import type { Metadata } from "next";
import { inter, fontVariables } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { appSurfaceDefinitions } from "@/lib/app-shell";
import { getToken } from "@/lib/auth-server";
import "./globals.css";

export const metadata: Metadata = {
  ...appSurfaceDefinitions.marketing.metadata,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialToken = await getToken();

  return (
    <html lang="en">
      <body className={`${fontVariables} font-sans antialiased`}>
        <Providers initialToken={initialToken}>{children}</Providers>
      </body>
    </html>
  );
}

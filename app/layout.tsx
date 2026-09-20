import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://oficina-saas-green.vercel.app",
  ),
  title: "Oficina CRM — clientes que voltam",
  description: "Clientes, serviços, retenção e estoque simples para oficinas.",
  applicationName: "Oficina CRM",
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Oficina CRM — clientes que voltam",
    description: "Clientes, serviços, retenção e estoque simples para oficinas.",
    images: [
      { url: "/logo.jpg", width: 150, height: 150, alt: "Oficina CRM" },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

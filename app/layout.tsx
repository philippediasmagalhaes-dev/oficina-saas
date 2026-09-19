import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://oficina-saas-green.vercel.app",
  ),
  title: "Natinho Scooters — operação sob controle",
  description: "O centro de comando da Natinho Scooters.",
  applicationName: "Natinho Scooters",
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Natinho Scooters — operação sob controle",
    description:
      "Ordens de serviço, agenda, clientes e relatórios em um só lugar.",
    images: [
      { url: "/logo.jpg", width: 150, height: 150, alt: "Natinho Scooters" },
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

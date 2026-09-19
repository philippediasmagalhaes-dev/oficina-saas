import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Natinho Scooters — operação sob controle",
  description: "O centro de comando da Natinho Scooters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

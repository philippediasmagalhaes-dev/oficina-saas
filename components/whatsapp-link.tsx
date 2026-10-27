import type { ReactNode } from "react";

export function WhatsAppLink({
  href,
  children,
  className = "primary-button",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}


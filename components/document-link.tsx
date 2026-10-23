import type { AnchorHTMLAttributes } from "react";

type DocumentLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export function DocumentLink({ href, ...props }: DocumentLinkProps) {
  return <a href={href} {...props} />;
}

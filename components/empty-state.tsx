import Link from "next/link";

export function EmptyState({ title, description, action, href }: { title: string; description: string; action?: string; href?: string }) {
  return <div className="empty-state"><span>＋</span><h3>{title}</h3><p>{description}</p>{action && href ? <Link className="primary-button" href={href}>{action}</Link> : null}</div>;
}

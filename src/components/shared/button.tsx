import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructivePending";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

type ButtonProps = ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonLinkProps = ButtonStyleProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string
): string {
  return [
    "aksa-button",
    `aksa-button--${size}`,
    `aksa-button--${variant === "destructivePending" ? "destructive-pending" : variant}`,
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, size, className)}
      data-loading={loading ? "true" : undefined}
      disabled={disabled || loading}
      type={props.type ?? "button"}
    >
      <span className="aksa-button__content">{children}</span>
      {loading ? <span aria-hidden="true" className="aksa-button__loading-indicator" /> : null}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClassName(variant, size, className)} href={href as never}>
      {children}
    </Link>
  );
}

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  "aria-label": string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, type = "button", ...props }, ref) => (
    <button
      {...props}
      className={`aksa-icon-button${className ? ` ${className}` : ""}`}
      ref={ref}
      type={type}
    >
      {children}
    </button>
  )
);

IconButton.displayName = "IconButton";

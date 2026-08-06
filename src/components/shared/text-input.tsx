import type { InputHTMLAttributes } from "react";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`aksa-input${className ? ` ${className}` : ""}`} />;
}

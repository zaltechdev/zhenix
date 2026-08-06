import { cloneElement, type ReactElement, type ReactNode } from "react";

type FormControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

type FormFieldProps = {
  controlId: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement<FormControlProps>;
};

export function FormField({
  controlId,
  label,
  description,
  error,
  required = false,
  children
}: FormFieldProps) {
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;
  const describedBy = [
    children.props["aria-describedby"],
    description ? descriptionId : null,
    error ? errorId : null
  ]
    .filter(Boolean)
    .join(" ");

  const control = cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-required": required ? true : children.props["aria-required"]
  });

  return (
    <div className="aksa-field">
      <label className="aksa-label" htmlFor={controlId}>
        {label}
      </label>
      {description ? (
        <p className="aksa-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {control}
      {error ? (
        <p className="aksa-field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

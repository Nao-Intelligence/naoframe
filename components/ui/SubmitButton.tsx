"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
};

export function SubmitButton({
  children,
  pendingLabel = "Läuft…",
  className,
  formAction,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending ? "true" : "false"}
      formAction={formAction}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

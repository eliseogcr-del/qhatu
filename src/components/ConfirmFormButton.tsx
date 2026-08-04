"use client";

import SubmitButton from "./SubmitButton";

export default function ConfirmFormButton({
  action,
  confirmMessage,
  children,
  icon,
  pendingLabel,
  className,
}: {
  action: (formData: FormData) => void;
  confirmMessage: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <SubmitButton icon={icon} pendingLabel={pendingLabel} className={className}>
        {children}
      </SubmitButton>
    </form>
  );
}

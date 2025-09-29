"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PasswordInput({
  id,
  label = "Mot de passe",
  placeholder = "••••••••",
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = () => setIsVisible(prevState => !prevState);

  return (
    <div className={className}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          className="pe-9"
          placeholder={placeholder}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        />
        <button
          className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={toggleVisibility}
          aria-label={
            isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={isVisible}
          aria-controls={inputId}
          disabled={disabled}
        >
          {isVisible ? (
            <EyeOffIcon size={16} aria-hidden="true" />
          ) : (
            <EyeIcon size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

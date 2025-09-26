"use client";

import { useState, useCallback } from "react";
import type { EmailFormState } from "../types";

export function useEmailForm() {
  const [formState, setFormState] = useState<EmailFormState>({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    content: "",
    showCc: false,
    showBcc: false,
  });

  const updateField = useCallback(
    <K extends keyof EmailFormState>(field: K, value: EmailFormState[K]) => {
      setFormState(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const toggleCc = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      showCc: !prev.showCc,
    }));
  }, []);

  const toggleBcc = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      showBcc: !prev.showBcc,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      content: "",
      showCc: false,
      showBcc: false,
    });
  }, []);

  const getFormData = useCallback(
    () => ({
      to: formState.to,
      cc: formState.cc,
      bcc: formState.bcc,
      subject: formState.subject,
      content: formState.content,
    }),
    [formState]
  );

  return {
    formState,
    updateField,
    toggleCc,
    toggleBcc,
    resetForm,
    getFormData,
  };
}

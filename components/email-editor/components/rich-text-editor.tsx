"use client";

import { forwardRef } from "react";

interface RichTextEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(
  (
    {
      onContentChange,
      placeholder = "Composez votre message...",
      className = "",
      minHeight = "400px",
    },
    ref
  ) => {
    return (
      <div className={`min-h-[${minHeight}] ${className}`}>
        <div
          ref={ref}
          contentEditable
          className={`w-full min-h-[${minHeight}] border-border focus:ring-ring bg-background text-foreground rounded-md border p-4 leading-relaxed focus:ring-2 focus:outline-none`}
          style={{ whiteSpace: "pre-wrap" }}
          onInput={e => onContentChange(e.currentTarget.innerHTML || "")}
          suppressContentEditableWarning={true}
          data-placeholder={placeholder}
        />
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

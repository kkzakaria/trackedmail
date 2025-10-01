"use client";

import { forwardRef } from "react";

interface RichTextEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}

export const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(
  (
    {
      onContentChange,
      placeholder = "Composez votre message...",
      className = "",
      height = "400px",
    },
    ref
  ) => {
    return (
      <div className={className} style={{ height }}>
        <div
          ref={ref}
          contentEditable
          className="border-border focus:ring-ring bg-background text-foreground w-full overflow-y-auto rounded-md border p-4 leading-relaxed focus:ring-2 focus:outline-none"
          style={{ height, whiteSpace: "pre-wrap" }}
          onInput={e => onContentChange(e.currentTarget.innerHTML || "")}
          suppressContentEditableWarning={true}
          data-placeholder={placeholder}
        />
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

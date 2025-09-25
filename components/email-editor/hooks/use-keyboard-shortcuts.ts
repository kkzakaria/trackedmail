"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutsOptions {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFormatUpdate: () => void;
}

export function useKeyboardShortcuts({
  onBold,
  onItalic,
  onUnderline,
  onUndo,
  onRedo,
  onFormatUpdate,
}: KeyboardShortcutsOptions) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Gestion de la tabulation
      if (e.key === "Tab") {
        e.preventDefault();

        // Insérer une tabulation (utilisant des espaces pour plus de compatibilité)
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const tabNode = document.createTextNode("\u00A0\u00A0\u00A0\u00A0"); // 4 espaces insécables
          range.deleteContents();
          range.insertNode(tabNode);

          // Positionner le curseur après la tabulation
          range.setStartAfter(tabNode);
          range.setEndAfter(tabNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "b":
            e.preventDefault();
            onBold();
            break;
          case "i":
            e.preventDefault();
            onItalic();
            break;
          case "u":
            e.preventDefault();
            onUnderline();
            break;
          case "z":
            if (e.shiftKey) {
              e.preventDefault();
              onRedo();
            } else {
              e.preventDefault();
              onUndo();
            }
            break;
        }
      }
    };

    const handleSelectionChange = () => {
      onFormatUpdate();
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener("keydown", handleKeyDown);
      editor.addEventListener("mouseup", handleSelectionChange);
      editor.addEventListener("keyup", handleSelectionChange);
      document.addEventListener("selectionchange", handleSelectionChange);

      return () => {
        editor.removeEventListener("keydown", handleKeyDown);
        editor.removeEventListener("mouseup", handleSelectionChange);
        editor.removeEventListener("keyup", handleSelectionChange);
        document.removeEventListener("selectionchange", handleSelectionChange);
      };
    }

    // Return undefined pour le cas où editor est null
    return undefined;
  }, [onBold, onItalic, onUnderline, onUndo, onRedo, onFormatUpdate]);

  return { editorRef };
}

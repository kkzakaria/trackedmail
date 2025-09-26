"use client";

import { useState, useCallback, useRef } from "react";
import type {
  TextFormattingState,
  FormatCommand,
  HeadingValue,
  AlignmentValue,
} from "../types";

export function useTextFormatting() {
  const [formatting, setFormatting] = useState<TextFormattingState>({
    currentTextColor: "#000000",
    currentHighlightColor: "transparent",
    currentAlignment: "left",
    currentStyle: "normal",
  });

  const editorRef = useRef<HTMLDivElement>(null);

  const formatText = useCallback((command: FormatCommand, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  const handleUndo = useCallback(() => {
    document.execCommand("undo", false);
  }, []);

  const handleRedo = useCallback(() => {
    document.execCommand("redo", false);
  }, []);

  const handleColorChange = useCallback(
    (color: string) => {
      setFormatting(prev => ({ ...prev, currentTextColor: color }));

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        // Si du texte est sélectionné, appliquer directement
        formatText("foreColor", color);
      } else {
        // Si pas de sélection, créer un span invisible avec la couleur
        // pour que le prochain texte tapé hérite de cette couleur
        const span = document.createElement("span");
        span.style.color = color;
        span.appendChild(document.createTextNode("\u200B")); // Caractère zero-width

        if (editorRef.current) {
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(span);
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // Si pas de sélection du tout, ajouter à la fin
            editorRef.current.appendChild(span);
            const newRange = document.createRange();
            newRange.setStartAfter(span);
            newRange.setEndAfter(span);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      }
    },
    [formatText]
  );

  const handleBackgroundColor = useCallback(
    (color: string) => {
      setFormatting(prev => ({ ...prev, currentHighlightColor: color }));

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        // Si du texte est sélectionné, appliquer directement
        if (color === "transparent") {
          formatText("hiliteColor", "transparent");
        } else {
          formatText("hiliteColor", color);
        }
      } else {
        // Si pas de sélection, créer un span invisible avec la couleur de fond
        const span = document.createElement("span");
        if (color === "transparent") {
          span.style.backgroundColor = "";
        } else {
          span.style.backgroundColor = color;
        }
        span.appendChild(document.createTextNode("\u200B")); // Caractère zero-width

        if (editorRef.current) {
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(span);
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // Si pas de sélection du tout, ajouter à la fin
            editorRef.current.appendChild(span);
            const newRange = document.createRange();
            newRange.setStartAfter(span);
            newRange.setEndAfter(span);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      }
    },
    [formatText]
  );

  const handleHeading = useCallback(
    (value: HeadingValue) => {
      setFormatting(prev => ({ ...prev, currentStyle: value }));
      if (value === "normal") {
        formatText("formatBlock", "<p>");
      } else {
        formatText("formatBlock", value);
      }
    },
    [formatText]
  );

  const handleAlignment = useCallback(
    (alignment: AlignmentValue) => {
      setFormatting(prev => ({ ...prev, currentAlignment: alignment }));
      switch (alignment) {
        case "left":
          formatText("justifyLeft");
          break;
        case "center":
          formatText("justifyCenter");
          break;
        case "right":
          formatText("justifyRight");
          break;
        case "justify":
          formatText("justifyFull");
          break;
      }
    },
    [formatText]
  );

  const insertLink = useCallback(() => {
    const url = prompt("Entrez l'URL du lien:");
    if (url) {
      formatText("createLink", url);
    }
  }, [formatText]);

  const updateCurrentFormat = useCallback(() => {
    if (typeof document.queryCommandSupported === "function") {
      try {
        // Détecter l'alignement
        if (document.queryCommandState("justifyCenter")) {
          setFormatting(prev => ({ ...prev, currentAlignment: "center" }));
        } else if (document.queryCommandState("justifyRight")) {
          setFormatting(prev => ({ ...prev, currentAlignment: "right" }));
        } else if (document.queryCommandState("justifyFull")) {
          setFormatting(prev => ({ ...prev, currentAlignment: "justify" }));
        } else {
          setFormatting(prev => ({ ...prev, currentAlignment: "left" }));
        }
      } catch {
        // Ignore les erreurs de queryCommandState
      }
    }
  }, []);

  return {
    formatting,
    editorRef,
    formatText,
    handleUndo,
    handleRedo,
    handleColorChange,
    handleBackgroundColor,
    handleHeading,
    handleAlignment,
    insertLink,
    updateCurrentFormat,
  };
}

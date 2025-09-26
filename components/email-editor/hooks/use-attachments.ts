"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AttachmentState } from "../types";

export function useAttachments() {
  const [state, setState] = useState<AttachmentState>({
    attachments: [],
    attachmentPreviews: {},
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Générer une miniature pour les images
  const generateThumbnail = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject("Not an image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Dimensions de la miniature
          const maxSize = 60;
          let { width, height } = img;

          // Calculer les nouvelles dimensions en gardant le ratio
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Dessiner l'image redimensionnée
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject("Failed to load image");
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject("Failed to read file");
      reader.readAsDataURL(file);
    });
  }, []);

  const insertImage = useCallback(() => {
    if (!imageInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      imageInputRef.current = input;
    }

    imageInputRef.current.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Vérifier la taille du fichier (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert("L'image est trop volumineuse. Taille maximale : 5MB");
          return;
        }

        // Vérifier le type de fichier
        if (!file.type.startsWith("image/")) {
          alert("Veuillez sélectionner un fichier image valide");
          return;
        }

        const reader = new FileReader();
        reader.onload = event => {
          const imageUrl = event.target?.result as string;
          if (imageUrl) {
            document.execCommand("insertImage", false, imageUrl);
          }
        };
        reader.onerror = () => {
          alert("Erreur lors du chargement de l'image");
        };
        reader.readAsDataURL(file);
      }
      // Reset input value pour permettre de sélectionner le même fichier
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    };

    imageInputRef.current.click();
  }, []);

  const addFiles = useCallback(() => {
    if (!fileInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "*/*";
      input.multiple = true; // Permettre la sélection multiple
      input.style.display = "none";
      document.body.appendChild(input);
      fileInputRef.current = input;
    }

    fileInputRef.current.onchange = e => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const validFiles: File[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files.item(i);
          if (!file) continue;

          // Vérifier la taille du fichier (max 10MB)
          if (file.size > 10 * 1024 * 1024) {
            alert(
              `Le fichier "${file.name}" est trop volumineux. Taille maximale : 10MB`
            );
            continue;
          }

          // Vérifier si le fichier n'est pas déjà attaché
          if (
            state.attachments.some(
              att => att.name === file.name && att.size === file.size
            )
          ) {
            alert(`Le fichier "${file.name}" est déjà attaché`);
            continue;
          }

          validFiles.push(file);
        }

        if (validFiles.length > 0) {
          setState(prev => ({
            ...prev,
            attachments: [...prev.attachments, ...validFiles],
          }));

          // Générer les miniatures pour les images
          validFiles.forEach(file => {
            if (file.type.startsWith("image/")) {
              generateThumbnail(file)
                .then(thumbnailUrl => {
                  setState(prev => ({
                    ...prev,
                    attachmentPreviews: {
                      ...prev.attachmentPreviews,
                      [`${file.name}-${file.size}`]: thumbnailUrl,
                    },
                  }));
                })
                .catch(error => {
                  console.warn("Failed to generate thumbnail:", error);
                });
            }
          });
        }
      }

      // Reset input value
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    fileInputRef.current.click();
  }, [state.attachments, generateThumbnail]);

  const removeAttachment = useCallback(
    (index: number) => {
      const fileToRemove = state.attachments[index];
      if (fileToRemove) {
        const previewKey = `${fileToRemove.name}-${fileToRemove.size}`;
        setState(prev => {
          const newPreviews = { ...prev.attachmentPreviews };
          delete newPreviews[previewKey];
          return {
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index),
            attachmentPreviews: newPreviews,
          };
        });
      }
    },
    [state.attachments]
  );

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }, []);

  // Nettoyage des inputs cachés
  useEffect(() => {
    return () => {
      if (imageInputRef.current) {
        document.body.removeChild(imageInputRef.current);
      }
      if (fileInputRef.current) {
        document.body.removeChild(fileInputRef.current);
      }
    };
  }, []);

  return {
    attachments: state.attachments,
    attachmentPreviews: state.attachmentPreviews,
    insertImage,
    addFiles,
    removeAttachment,
    formatFileSize,
  };
}

"use client";

import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import { getFileIcon } from "../utils/file-helpers";

interface AttachmentManagerProps {
  attachments: File[];
  attachmentPreviews: { [key: string]: string };
  onRemoveAttachment: (index: number) => void;
  formatFileSize: (bytes: number) => string;
}

export function AttachmentManager({
  attachments,
  attachmentPreviews,
  onRemoveAttachment,
  formatFileSize,
}: AttachmentManagerProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-foreground mb-2 flex items-center gap-2 text-sm font-medium">
        <Paperclip className="h-4 w-4" />
        Pièces jointes ({attachments.length})
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {attachments.map((file, index) => {
          const previewKey = `${file.name}-${file.size}`;
          const hasPreview = attachmentPreviews[previewKey];

          return (
            <div
              key={`${file.name}-${index}`}
              className="bg-muted/30 hover:bg-muted/50 flex items-center gap-3 rounded-md border p-3 transition-colors"
            >
              {/* Miniature ou icône */}
              <div className="flex-shrink-0">
                {hasPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachmentPreviews[previewKey]}
                    alt={file.name}
                    className="border-border h-12 w-12 rounded border object-cover"
                  />
                ) : (
                  <div className="bg-background border-border flex h-12 w-12 items-center justify-center rounded border">
                    {getFileIcon(file)}
                  </div>
                )}
              </div>

              {/* Info fichier */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-foreground truncate text-sm font-medium"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Bouton supprimer */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveAttachment(index)}
                className="text-muted-foreground hover:text-destructive h-8 w-8 flex-shrink-0 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

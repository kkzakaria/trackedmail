import React from "react";
import {
  ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  FileIcon,
} from "lucide-react";

export const getFileIcon = (file: File): React.ReactElement => {
  const type = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (type.startsWith("image/"))
    return <ImageIcon className="h-6 w-6 text-blue-500" />;
  if (type.startsWith("video/"))
    return <Video className="h-6 w-6 text-red-500" />;
  if (type.startsWith("audio/"))
    return <Music className="h-6 w-6 text-green-500" />;
  if (type.includes("pdf") || extension === "pdf")
    return <FileText className="h-6 w-6 text-red-600" />;
  if (type.includes("text") || ["txt", "md", "rtf"].includes(extension || ""))
    return <FileText className="h-6 w-6 text-gray-600" />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension || ""))
    return <Archive className="h-6 w-6 text-orange-500" />;

  return <FileIcon className="h-6 w-6 text-gray-500" />;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};

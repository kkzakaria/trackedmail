export interface EmailFormData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  content: string;
}

export interface EmailFormState extends EmailFormData {
  showCc: boolean;
  showBcc: boolean;
}

export interface TextFormattingState {
  currentTextColor: string;
  currentHighlightColor: string;
  currentAlignment: "left" | "center" | "right" | "justify";
  currentStyle: "normal" | "<h1>" | "<h2>" | "<h3>";
}

export interface AttachmentState {
  attachments: File[];
  attachmentPreviews: { [key: string]: string };
}

export type FormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "undo"
  | "redo"
  | "removeFormat"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "foreColor"
  | "hiliteColor"
  | "formatBlock"
  | "createLink"
  | "insertImage";

export type HeadingValue = "normal" | "<h1>" | "<h2>" | "<h3>";
export type AlignmentValue = "left" | "center" | "right" | "justify";

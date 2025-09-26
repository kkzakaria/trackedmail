"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send } from "lucide-react";

import {
  EmailRecipientFields,
  FormattingToolbar,
  AttachmentManager,
  RichTextEditor,
  useEmailForm,
  useTextFormatting,
  useAttachments,
  useKeyboardShortcuts,
} from "./email-editor/index";

export function EmailEditor() {
  const { formState, updateField, toggleCc, toggleBcc, getFormData } =
    useEmailForm();
  const {
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
  } = useTextFormatting();
  const {
    attachments,
    attachmentPreviews,
    insertImage,
    addFiles,
    removeAttachment,
    formatFileSize,
  } = useAttachments();

  // Fusionner les refs pour les raccourcis clavier et le formatage de texte
  const keyboardRef = useRef<HTMLDivElement>(null);
  const { editorRef: keyboardEditorRef } = useKeyboardShortcuts({
    onBold: () => formatText("bold"),
    onItalic: () => formatText("italic"),
    onUnderline: () => formatText("underline"),
    onUndo: handleUndo,
    onRedo: handleRedo,
    onFormatUpdate: updateCurrentFormat,
  });

  // Synchroniser les refs
  const syncRefs = (element: HTMLDivElement | null) => {
    if (editorRef && typeof editorRef !== "function") {
      editorRef.current = element;
    }
    if (keyboardEditorRef && typeof keyboardEditorRef !== "function") {
      keyboardEditorRef.current = element;
    }
    keyboardRef.current = element;
  };

  const handleSendEmail = () => {
    const emailData = getFormData();
    // eslint-disable-next-line no-console
    console.log("Sending email with content:", emailData);
    // eslint-disable-next-line no-console
    console.log("Attachments:", attachments);
    // TODO: Implémenter l'envoi réel de l'email avec pièces jointes
  };

  return (
    <div className="flex h-full w-full flex-col p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
        {/* Main Editor */}
        <div className="flex h-full flex-col">
          <Card className="flex h-full flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-6 pb-4">
              <div className="flex items-center justify-between">
                <h1 className="text-foreground text-2xl font-bold">
                  Composer un email
                </h1>
                <Button
                  className="cursor-pointer bg-blue-700 text-white hover:bg-blue-800"
                  onClick={handleSendEmail}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer
                </Button>
              </div>
              <Separator className="mt-4" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-4">
                {/* Recipient Fields */}
                <EmailRecipientFields
                  to={formState.to}
                  cc={formState.cc}
                  bcc={formState.bcc}
                  subject={formState.subject}
                  showCc={formState.showCc}
                  showBcc={formState.showBcc}
                  onToChange={value => updateField("to", value)}
                  onCcChange={value => updateField("cc", value)}
                  onBccChange={value => updateField("bcc", value)}
                  onSubjectChange={value => updateField("subject", value)}
                  onToggleCc={toggleCc}
                  onToggleBcc={toggleBcc}
                />

                <Separator />

                {/* Formatting Toolbar */}
                <FormattingToolbar
                  formatting={formatting}
                  onFormat={formatText}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onColorChange={handleColorChange}
                  onBackgroundColor={handleBackgroundColor}
                  onHeading={handleHeading}
                  onAlignment={handleAlignment}
                  onInsertLink={insertLink}
                  onInsertImage={insertImage}
                  onInsertFile={addFiles}
                />

                {/* Attachments */}
                <AttachmentManager
                  attachments={attachments}
                  attachmentPreviews={attachmentPreviews}
                  onRemoveAttachment={removeAttachment}
                  formatFileSize={formatFileSize}
                />

                {/* Content Editor */}
                <RichTextEditor
                  ref={syncRefs}
                  content={formState.content}
                  onContentChange={content => updateField("content", content)}
                  placeholder="Composez votre message..."
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

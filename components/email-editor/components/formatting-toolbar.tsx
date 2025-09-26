"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  ImageIcon,
  Paperclip,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Palette,
  Highlighter,
  Type,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  Plus,
  Eraser,
} from "lucide-react";

import { ToolbarButton } from "./toolbar-button";
import { ColorPalette } from "./color-palette";
import type {
  TextFormattingState,
  HeadingValue,
  AlignmentValue,
  FormatCommand,
} from "../types";

interface FormattingToolbarProps {
  formatting: TextFormattingState;
  onFormat: (command: FormatCommand, value?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onColorChange: (color: string) => void;
  onBackgroundColor: (color: string) => void;
  onHeading: (value: HeadingValue) => void;
  onAlignment: (alignment: AlignmentValue) => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertFile: () => void;
}

export function FormattingToolbar({
  formatting,
  onFormat,
  onUndo,
  onRedo,
  onColorChange,
  onBackgroundColor,
  onHeading,
  onAlignment,
  onInsertLink,
  onInsertImage,
  onInsertFile,
}: FormattingToolbarProps) {
  return (
    <Card className="bg-muted/30 border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Undo/Redo */}
        <ToolbarButton icon={Undo2} tooltip="Annuler" onClick={onUndo} />
        <ToolbarButton icon={Redo2} tooltip="Rétablir" onClick={onRedo} />
        <Separator orientation="vertical" className="h-6" />

        {/* Headings Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground border-border h-8 w-[50px] cursor-pointer gap-1 border px-2"
                >
                  <div className="flex items-center justify-center">
                    {formatting.currentStyle === "normal" && (
                      <Type className="h-4 w-4" />
                    )}
                    {formatting.currentStyle === "<h1>" && (
                      <Heading1 className="h-4 w-4" />
                    )}
                    {formatting.currentStyle === "<h2>" && (
                      <Heading2 className="h-4 w-4" />
                    )}
                    {formatting.currentStyle === "<h3>" && (
                      <Heading3 className="h-4 w-4" />
                    )}
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              {formatting.currentStyle === "normal" && "Paragraphe normal"}
              {formatting.currentStyle === "<h1>" && "Titre 1"}
              {formatting.currentStyle === "<h2>" && "Titre 2"}
              {formatting.currentStyle === "<h3>" && "Titre 3"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => onHeading("normal")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                <span>Normal</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onHeading("<h1>")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Heading1 className="h-4 w-4" />
                <span className="text-lg font-bold">Titre 1</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onHeading("<h2>")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Heading2 className="h-4 w-4" />
                <span className="text-base font-semibold">Titre 2</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onHeading("<h3>")}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Heading3 className="h-4 w-4" />
                <span className="text-sm font-medium">Titre 3</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-6" />

        {/* Text Formatting */}
        <ToolbarButton
          icon={Bold}
          tooltip="Gras"
          onClick={() => onFormat("bold")}
        />
        <ToolbarButton
          icon={Italic}
          tooltip="Italique"
          onClick={() => onFormat("italic")}
        />
        <ToolbarButton
          icon={Underline}
          tooltip="Souligné"
          onClick={() => onFormat("underline")}
        />
        <ToolbarButton
          icon={Strikethrough}
          tooltip="Barré"
          onClick={() => onFormat("strikeThrough")}
        />
        <Separator orientation="vertical" className="h-6" />

        {/* Text Color Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground relative cursor-pointer gap-1 border-0"
                >
                  <div className="relative">
                    <Palette className="h-4 w-4" />
                    <div
                      className="border-border absolute right-0 -bottom-0.5 left-0 h-1 rounded-sm border"
                      style={{ backgroundColor: formatting.currentTextColor }}
                    />
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Couleur du texte</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="p-0">
            <ColorPalette
              type="text"
              currentColor={formatting.currentTextColor}
              onColorChange={onColorChange}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlight Color Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground relative cursor-pointer gap-1 border-0"
                >
                  <div className="relative">
                    <Highlighter className="h-4 w-4" />
                    <div
                      className="border-border absolute right-0 -bottom-0.5 left-0 h-1 rounded-sm border"
                      style={{
                        backgroundColor:
                          formatting.currentHighlightColor === "transparent"
                            ? "#ffffff"
                            : formatting.currentHighlightColor,
                        opacity:
                          formatting.currentHighlightColor === "transparent"
                            ? 0.3
                            : 1,
                      }}
                    />
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Surligner</TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="p-0">
            <ColorPalette
              type="highlight"
              currentColor={formatting.currentHighlightColor}
              onColorChange={onBackgroundColor}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-6" />

        {/* Alignment Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer gap-1 border-0"
                >
                  {formatting.currentAlignment === "left" && (
                    <AlignLeft className="h-4 w-4" />
                  )}
                  {formatting.currentAlignment === "center" && (
                    <AlignCenter className="h-4 w-4" />
                  )}
                  {formatting.currentAlignment === "right" && (
                    <AlignRight className="h-4 w-4" />
                  )}
                  {formatting.currentAlignment === "justify" && (
                    <AlignJustify className="h-4 w-4" />
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Alignement</TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => onAlignment("left")}
              className="cursor-pointer"
            >
              <AlignLeft className="mr-2 h-4 w-4" />
              Aligner à gauche
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAlignment("center")}
              className="cursor-pointer"
            >
              <AlignCenter className="mr-2 h-4 w-4" />
              Centrer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAlignment("right")}
              className="cursor-pointer"
            >
              <AlignRight className="mr-2 h-4 w-4" />
              Aligner à droite
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAlignment("justify")}
              className="cursor-pointer"
            >
              <AlignJustify className="mr-2 h-4 w-4" />
              Justifier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-6" />

        {/* Lists Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer gap-1 border-0"
                >
                  <List className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Listes</TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => onFormat("insertUnorderedList")}
              className="cursor-pointer"
            >
              <List className="mr-2 h-4 w-4" />
              Liste à puces
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onFormat("insertOrderedList")}
              className="cursor-pointer"
            >
              <ListOrdered className="mr-2 h-4 w-4" />
              Liste numérotée
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-6" />

        {/* Insert Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer gap-1 border-0"
                >
                  <Plus className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Insérer</TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onInsertLink} className="cursor-pointer">
              <Link className="mr-2 h-4 w-4" />
              Insérer un lien
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onInsertImage}
              className="cursor-pointer"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Insérer une image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onInsertFile} className="cursor-pointer">
              <Paperclip className="mr-2 h-4 w-4" />
              Joindre un fichier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Formatting */}
        <ToolbarButton
          icon={Eraser}
          tooltip="Effacer le formatage"
          onClick={() => onFormat("removeFormat")}
          className="ml-auto"
        />
      </div>
    </Card>
  );
}

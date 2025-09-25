"use client";

import { Separator } from "@/components/ui/separator";

interface ColorPaletteProps {
  type: "text" | "highlight";
  currentColor: string;
  onColorChange: (color: string) => void;
}

const TEXT_COLORS = [
  { value: "#000000", label: "Noir", displayColor: "#000000" },
  { value: "#EF4444", label: "Rouge", displayColor: "#EF4444" },
  { value: "#F59E0B", label: "Orange", displayColor: "#F59E0B" },
  { value: "#10B981", label: "Vert", displayColor: "#10B981" },
  { value: "#3B82F6", label: "Bleu", displayColor: "#3B82F6" },
  { value: "#8B5CF6", label: "Violet", displayColor: "#8B5CF6" },
  { value: "#EC4899", label: "Rose", displayColor: "#EC4899" },
  { value: "#6B7280", label: "Gris", displayColor: "#6B7280" },
  { value: "#A78BFA", label: "Lavande", displayColor: "#A78BFA" },
  { value: "#059669", label: "Vert foncé", displayColor: "#059669" },
];

const HIGHLIGHT_COLORS = [
  { value: "transparent", label: "Aucun", displayColor: "#ffffff" },
  { value: "#FEF3C7", label: "Jaune", displayColor: "#FEF3C7" },
  { value: "#DBEAFE", label: "Bleu clair", displayColor: "#DBEAFE" },
  { value: "#D1FAE5", label: "Vert clair", displayColor: "#D1FAE5" },
  { value: "#FCE7F3", label: "Rose clair", displayColor: "#FCE7F3" },
  { value: "#FED7AA", label: "Orange clair", displayColor: "#FED7AA" },
  { value: "#E9D5FF", label: "Lavande clair", displayColor: "#E9D5FF" },
  { value: "#FEE2E2", label: "Rouge clair", displayColor: "#FEE2E2" },
  { value: "#F3F4F6", label: "Gris clair", displayColor: "#F3F4F6" },
  { value: "#CFFAFE", label: "Cyan clair", displayColor: "#CFFAFE" },
];

export function ColorPalette({
  type,
  currentColor,
  onColorChange,
}: ColorPaletteProps) {
  const colors = type === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;

  return (
    <div className="p-2">
      <div className="grid grid-cols-5 gap-1">
        {colors.map(color => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className="border-border relative h-6 w-6 cursor-pointer rounded border transition-transform hover:scale-110"
            style={{ backgroundColor: color.displayColor || color.value }}
            title={color.label}
          >
            {color.value === "transparent" && (
              <span className="absolute inset-0 flex items-center justify-center text-xs">
                ✕
              </span>
            )}
          </button>
        ))}
      </div>
      <Separator className="my-2" />
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Personnalisé:</span>
        <input
          type="color"
          value={currentColor === "transparent" ? "#ffffff" : currentColor}
          onChange={e => onColorChange(e.target.value)}
          className="border-border h-8 w-8 cursor-pointer rounded border"
        />
      </div>
    </div>
  );
}

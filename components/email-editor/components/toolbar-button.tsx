"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";

interface ToolbarButtonProps {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
  variant?: "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
}

export function ToolbarButton({
  icon: Icon,
  tooltip,
  onClick,
  isActive = false,
  variant = "ghost",
  size = "sm",
  className = "",
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={onClick}
          className={`text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer border-0 ${
            isActive ? "bg-accent" : ""
          } ${className}`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

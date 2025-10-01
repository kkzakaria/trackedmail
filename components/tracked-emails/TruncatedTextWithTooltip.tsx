/**
 * TruncatedTextWithTooltip Component
 *
 * Displays text with an optional tooltip that only appears when the text is truncated.
 * Uses a ref to detect if the content overflows its container.
 */

"use client";

import { useRef, useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextWithTooltipProps {
  text: string;
  className?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  tooltipClassName?: string;
}

/**
 * Component that shows a tooltip only when text is truncated
 */
export function TruncatedTextWithTooltip({
  text,
  className,
  tooltipSide = "top",
  tooltipClassName,
}: TruncatedTextWithTooltipProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    // Check if text is truncated by comparing scrollWidth with clientWidth
    const checkTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    checkTruncation();

    // Re-check on window resize
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [text]);

  const content = (
    <div ref={textRef} className={cn("truncate", className)}>
      {text}
    </div>
  );

  // Only wrap with Tooltip if text is truncated
  if (!isTruncated) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{content}</div>
      </TooltipTrigger>
      <TooltipContent
        side={tooltipSide}
        className={cn("max-w-md break-words", tooltipClassName)}
        sideOffset={5}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

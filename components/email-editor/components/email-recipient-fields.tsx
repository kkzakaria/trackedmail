"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mail, Users } from "lucide-react";

interface EmailRecipientFieldsProps {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  showCc: boolean;
  showBcc: boolean;
  onToChange: (value: string) => void;
  onCcChange: (value: string) => void;
  onBccChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onToggleCc: () => void;
  onToggleBcc: () => void;
}

export function EmailRecipientFields({
  to,
  cc,
  bcc,
  subject,
  showCc,
  showBcc,
  onToChange,
  onCcChange,
  onBccChange,
  onSubjectChange,
  onToggleCc,
  onToggleBcc,
}: EmailRecipientFieldsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="text-muted-foreground h-4 w-4" />
          <Input
            placeholder="À"
            value={to}
            onChange={e => onToChange(e.target.value)}
            className="flex-1"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCc}
                className={`cursor-pointer ${
                  showCc
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                Cc
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Copie carbone - Les destinataires voient les autres adresses
              </p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleBcc}
                className={`cursor-pointer ${
                  showBcc
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                Cci
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Copie carbone invisible - Les destinataires ne voient pas les
                autres adresses
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {showCc && (
          <div className="flex items-center gap-3">
            <Users className="text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Cc"
              value={cc}
              onChange={e => onCcChange(e.target.value)}
              className="flex-1"
            />
          </div>
        )}

        {showBcc && (
          <div className="flex items-center gap-3">
            <Users className="text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Cci"
              value={bcc}
              onChange={e => onBccChange(e.target.value)}
              className="flex-1"
            />
          </div>
        )}

        <Input
          placeholder="Sujet"
          value={subject}
          onChange={e => onSubjectChange(e.target.value)}
          className="text-lg font-medium"
        />
      </div>
    </TooltipProvider>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EmailStatus } from "@/lib/types";

interface TrackedEmailStatusBadgeProps {
  status: EmailStatus;
  className?: string;
}

const statusConfig: Record<EmailStatus, { label: string; variant: string; className: string }> = {
  pending: {
    label: "En attente",
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300",
  },
  responded: {
    label: "Répondu",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  },
  stopped: {
    label: "Arrêté",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300",
  },
  max_reached: {
    label: "Max relances",
    variant: "destructive",
    className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300",
  },
  bounced: {
    label: "Rejeté",
    variant: "destructive",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300",
  },
  expired: {
    label: "Expiré",
    variant: "outline",
    className: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300",
  },
};

export function TrackedEmailStatusBadge({ status, className }: TrackedEmailStatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant={config.variant as "default" | "secondary" | "destructive" | "outline"}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
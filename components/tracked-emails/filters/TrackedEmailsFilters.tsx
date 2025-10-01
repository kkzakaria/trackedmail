/**
 * TrackedEmailsFilters Component
 *
 * Provides search, status filtering, and column visibility controls.
 * Follows Single Responsibility Principle - handles only filter UI.
 */

"use client";

import { useRef, useId } from "react";
import { Table } from "@tanstack/react-table";
import {
  CircleXIcon,
  Columns3Icon,
  FilterIcon,
  ListFilterIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TrackedEmailStatusBadge } from "../TrackedEmailStatusBadge";
import { cn } from "@/lib/utils";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

// Column name translations
const COLUMN_LABELS: Record<string, string> = {
  recipient_emails: "Destinataire",
  mailbox: "Boîte mail",
  status: "Statut",
  sent_at: "Envoyé le",
  followup_count: "Suivi",
  actions: "Actions",
};

export interface TrackedEmailsFiltersProps {
  table: Table<TrackedEmailWithDetails>;
  uniqueStatusValues: string[];
  onStatusChange: (checked: boolean, status: EmailStatus) => void;
}

/**
 * Filters component for tracked emails table
 * @param table - TanStack Table instance
 * @param uniqueStatusValues - Available status values for filtering
 * @param onStatusChange - Callback for status filter changes
 */
export function TrackedEmailsFilters({
  table,
  uniqueStatusValues,
  onStatusChange,
}: TrackedEmailsFiltersProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const recipientColumn = table.getColumn("recipient_emails");
  const statusColumn = table.getColumn("status");
  const searchValue = (recipientColumn?.getFilterValue() ?? "") as string;
  const selectedStatuses =
    (statusColumn?.getFilterValue() as EmailStatus[]) || [];

  // Calculate status counts
  const statusCounts = new Map<string, number>();
  uniqueStatusValues.forEach(status => {
    const count = table
      .getFilteredRowModel()
      .rows.filter(row => row.getValue("status") === status).length;
    statusCounts.set(status, count);
  });

  return (
    <div className="flex items-center gap-3">
      {/* Search filter */}
      <div className="relative">
        <Input
          id={`${id}-input`}
          ref={inputRef}
          className={cn("peer min-w-60 ps-9", searchValue && "pe-9")}
          value={searchValue}
          onChange={e => recipientColumn?.setFilterValue(e.target.value)}
          placeholder="Rechercher par destinataire ou sujet..."
          type="text"
          aria-label="Rechercher par destinataire ou sujet"
        />
        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
          <ListFilterIcon size={16} aria-hidden="true" />
        </div>
        {searchValue && (
          <button
            className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear filter"
            onClick={() => {
              recipientColumn?.setFilterValue("");
              inputRef.current?.focus();
            }}
          >
            <CircleXIcon size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <FilterIcon
              className="-ms-1 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Statut
            {selectedStatuses.length > 0 && (
              <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                {selectedStatuses.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto min-w-36 p-3" align="start">
          <div className="space-y-3">
            <div className="text-muted-foreground text-xs font-medium">
              Filtres
            </div>
            <div className="space-y-3">
              {uniqueStatusValues.map((value, i) => (
                <div key={value} className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-${i}`}
                    checked={selectedStatuses.includes(value as EmailStatus)}
                    onCheckedChange={(checked: boolean) =>
                      onStatusChange(checked, value as EmailStatus)
                    }
                  />
                  <Label
                    htmlFor={`${id}-${i}`}
                    className="flex grow justify-between gap-2 font-normal"
                  >
                    <TrackedEmailStatusBadge status={value as EmailStatus} />
                    <span className="text-muted-foreground ms-2 text-xs">
                      {statusCounts.get(value)}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Column visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Columns3Icon
              className="-ms-1 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Colonnes
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Afficher/masquer colonnes</DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter(column => column.getCanHide())
            .map(column => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={value => column.toggleVisibility(!!value)}
                onSelect={event => event.preventDefault()}
              >
                {COLUMN_LABELS[column.id] || column.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

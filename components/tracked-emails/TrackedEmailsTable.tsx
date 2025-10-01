/**
 * TrackedEmailsTable Component (Refactored with SOLID principles)
 *
 * Main orchestration component that composes all table functionality.
 * Follows SOLID principles:
 * - Single Responsibility: Only orchestrates components, delegates logic to hooks
 * - Open/Closed: Extensible through props and composition
 * - Liskov Substitution: Uses consistent interfaces throughout
 * - Interface Segregation: Focused hooks and components
 * - Dependency Inversion: Depends on abstractions (hooks) not concrete implementations
 */

"use client";

import { useCallback } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/hooks/use-auth";

// Hooks
import { useTrackedEmailsData } from "./hooks/useTrackedEmailsData";
import { useEmailActions } from "./hooks/useEmailActions";
import { useTrackedEmailsTable } from "./hooks/useTrackedEmailsTable";

// Components
import { TrackedEmailsFilters } from "./filters/TrackedEmailsFilters";
import { TrackedEmailsBulkActions } from "./bulk-actions/TrackedEmailsBulkActions";
import { TrackedEmailsPagination } from "./pagination/TrackedEmailsPagination";

import type { EmailStatus } from "@/lib/types";

/**
 * Main table component for tracked emails
 * Orchestrates data loading, actions, filtering, and display
 */
export default function TrackedEmailsTable() {
  const { user } = useAuth();

  // Data management hook
  const { data, setData, loading } = useTrackedEmailsData();

  // Actions hook
  const {
    handleDeleteEmail,
    handleStatusUpdate,
    handleBulkStopTracking,
    handleBulkDelete,
  } = useEmailActions({ user, setData });

  // Table configuration hook
  const { table, statusColumn, uniqueStatusValues } = useTrackedEmailsTable({
    data,
    onStatusUpdate: handleStatusUpdate,
    onDelete: handleDeleteEmail,
  });

  // Status filter handler
  const handleStatusChange = useCallback(
    (checked: boolean, status: EmailStatus) => {
      const currentFilter =
        (statusColumn?.getFilterValue() as EmailStatus[]) || [];

      const newFilter = checked
        ? [...currentFilter, status]
        : currentFilter.filter(s => s !== status);

      statusColumn?.setFilterValue(
        newFilter.length > 0 ? newFilter : undefined
      );
    },
    [statusColumn]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Chargement des emails...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrackedEmailsFilters
          table={table}
          uniqueStatusValues={uniqueStatusValues}
          onStatusChange={handleStatusChange}
        />

        <TrackedEmailsBulkActions
          table={table}
          user={user}
          onBulkStop={handleBulkStopTracking}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "flex cursor-pointer items-center gap-2 select-none"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() &&
                          ({
                            asc: (
                              <ChevronUpIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ??
                            null)}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  Aucun email trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <TrackedEmailsPagination table={table} />
    </div>
  );
}

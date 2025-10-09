/**
 * useTrackedEmailsTable Hook
 *
 * Manages TanStack Table configuration and state.
 * Follows Single Responsibility Principle - handles only table configuration.
 */

import { useState, useMemo } from "react";
import {
  ColumnFiltersState,
  getCoreRowModel,
  getFacetedUniqueValues,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  createTrackedEmailsColumns,
  CreateColumnsOptions,
} from "../columns/TrackedEmailsColumns";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

export interface UseTrackedEmailsTableOptions {
  data: TrackedEmailWithDetails[];
  totalCount: number;
  statusCounts: Record<string, number>;
  pagination: PaginationState;
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: (
    updater:
      | ColumnFiltersState
      | ((old: ColumnFiltersState) => ColumnFiltersState)
  ) => void;
  onStatusUpdate: (emailId: string, status: EmailStatus) => Promise<void>;
  onDelete: (email: TrackedEmailWithDetails) => Promise<void>;
  onViewDetails: (email: TrackedEmailWithDetails) => void;
}

/**
 * Hook to configure and manage TanStack Table instance with server-side pagination and filtering
 * @param options - Table configuration options
 * @returns Table instance and related state
 */
export function useTrackedEmailsTable(options: UseTrackedEmailsTableOptions) {
  const {
    data,
    totalCount,
    statusCounts,
    pagination,
    onPaginationChange,
    columnFilters,
    onColumnFiltersChange,
    onStatusUpdate,
    onDelete,
    onViewDetails,
  } = options;

  // Table state (pagination and columnFilters are now controlled from parent)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "sent_at",
      desc: true,
    },
  ]);

  // Column definitions
  const columns = useMemo(() => {
    const columnOptions: CreateColumnsOptions = {
      onStatusUpdate,
      onViewDetails,
      onSendFollowup: email => {
        console.warn("Send followup:", email);
        // TODO: Implement followup modal
      },
      onDelete,
    };
    return createTrackedEmailsColumns(columnOptions);
  }, [onStatusUpdate, onViewDetails, onDelete]);

  // Create table instance with server-side pagination and filtering
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize), // Server-side page count
    manualPagination: true, // Enable server-side pagination
    manualFiltering: true, // Enable server-side filtering
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    onPaginationChange: onPaginationChange,
    onColumnFiltersChange: onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedUniqueValues: getFacetedUniqueValues(), // Keep for status counts (page-local)
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
  });

  // Extract status column info for filters
  const statusColumn = table.getColumn("status");
  const statusFilterValue = statusColumn?.getFilterValue() as
    | EmailStatus[]
    | undefined;

  // Get unique status values from global counts (not from filtered data)
  // This ensures all statuses are always visible in the dropdown
  const uniqueStatusValues = useMemo(() => {
    return Object.keys(statusCounts).sort();
  }, [statusCounts]);

  return {
    table,
    statusColumn,
    statusFilterValue,
    uniqueStatusValues,
  };
}

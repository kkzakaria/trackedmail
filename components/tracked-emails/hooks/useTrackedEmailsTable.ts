/**
 * useTrackedEmailsTable Hook
 *
 * Manages TanStack Table configuration and state.
 * Follows Single Responsibility Principle - handles only table configuration.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnFiltersState,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
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
  onStatusUpdate: (emailId: string, status: EmailStatus) => Promise<void>;
  onDelete: (email: TrackedEmailWithDetails) => Promise<void>;
}

/**
 * Hook to configure and manage TanStack Table instance
 * @param options - Table configuration options
 * @returns Table instance and related state
 */
export function useTrackedEmailsTable(options: UseTrackedEmailsTableOptions) {
  const { data, onStatusUpdate, onDelete } = options;
  const router = useRouter();

  // Table state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
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
      onViewDetails: email => {
        router.push(`/dashboard/emails/${email.id}`);
      },
      onSendFollowup: email => {
        console.warn("Send followup:", email);
        // TODO: Implement followup modal
      },
      onDelete,
    };
    return createTrackedEmailsColumns(columnOptions);
  }, [router, onStatusUpdate, onDelete]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
  });

  // Extract status column info for filters
  const statusColumn = table.getColumn("status");
  const statusFacetedValues = statusColumn?.getFacetedUniqueValues();
  const statusFilterValue = statusColumn?.getFilterValue() as
    | EmailStatus[]
    | undefined;

  // Get unique status values for filter dropdown
  const uniqueStatusValues = useMemo(() => {
    if (!statusColumn) return [];
    const values = Array.from(statusFacetedValues?.keys() || []);
    return values.sort();
  }, [statusColumn, statusFacetedValues]);

  return {
    table,
    statusColumn,
    statusFilterValue,
    uniqueStatusValues,
    columnFilters,
    setColumnFilters,
  };
}

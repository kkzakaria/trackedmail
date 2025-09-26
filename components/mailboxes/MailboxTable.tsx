"use client";

import { useCallback, useId, useMemo, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  flexRender,
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
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  Columns3Icon,
  ListFilterIcon,
  TrashIcon,
  EditIcon,
  EyeIcon,
  PowerIcon,
  RefreshCwIcon,
  MailIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  useMailboxes,
  useDeleteMailbox,
  useToggleMailboxStatus,
  useSyncMailbox,
} from "@/lib/hooks/use-mailboxes";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Tables } from "@/lib/types/database.types";

interface MailboxTableProps {
  onCreateNew?: () => void;
}

type MailboxItem = Tables<"mailboxes">;

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<MailboxItem> = (
  row,
  _columnId,
  filterValue
) => {
  const searchableRowContent = `${row.original.email_address} ${
    row.original.display_name || ""
  }`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const statusFilterFn: FilterFn<MailboxItem> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as boolean;
  const statusString = status ? "active" : "inactive";
  return filterValue.includes(statusString);
};

export function MailboxTable({ onCreateNew }: MailboxTableProps) {
  const { user } = useAuth();
  const deleteMailboxMutation = useDeleteMailbox();
  const toggleStatusMutation = useToggleMailboxStatus();
  const syncMailboxMutation = useSyncMailbox();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [globalFilter, setGlobalFilter] = useState("");

  // Component IDs for accessibility
  const filterInputId = useId();
  const statusFilterId = useId();

  // Data fetching
  const filters = useMemo(() => {
    return {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      ...(globalFilter && { search: globalFilter }),
    };
  }, [pagination.pageIndex, pagination.pageSize, globalFilter]);

  const { data: mailboxData, isLoading, error } = useMailboxes(filters);
  const mailboxes = mailboxData?.data || [];
  const totalCount = mailboxData?.count || 0;

  // Permissions
  const canManageMailboxes =
    user?.role === "administrateur" || user?.role === "manager";

  // Table actions
  const handleDelete = useCallback(
    async (id: string, email: string) => {
      if (
        window.confirm(
          `Êtes-vous sûr de vouloir supprimer la boîte mail ${email} ?`
        )
      ) {
        try {
          await deleteMailboxMutation.mutateAsync(id);
        } catch (error) {
          console.error("Erreur lors de la suppression:", error);
          alert("Erreur lors de la suppression de la boîte mail");
        }
      }
    },
    [deleteMailboxMutation]
  );

  const handleToggleStatus = useCallback(
    async (id: string) => {
      try {
        await toggleStatusMutation.mutateAsync(id);
      } catch (error) {
        console.error("Erreur lors de la mise à jour du statut:", error);
        alert("Erreur lors de la mise à jour du statut");
      }
    },
    [toggleStatusMutation]
  );

  const handleSync = useCallback(
    async (id: string) => {
      try {
        await syncMailboxMutation.mutateAsync(id);
      } catch (error) {
        console.error("Erreur lors de la synchronisation:", error);
        alert("Erreur lors de la synchronisation");
      }
    },
    [syncMailboxMutation]
  );

  // Column definitions
  const columns = useMemo<ColumnDef<MailboxItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Sélectionner tout"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={value => row.toggleSelected(!!value)}
            aria-label="Sélectionner la ligne"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "email_address",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Email
            <div className="ml-2 h-4 w-4">
              {column.getIsSorted() === "asc" ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <MailIcon className="text-muted-foreground h-4 w-4" />
            <div>
              <div className="font-medium">{row.getValue("email_address")}</div>
              {row.original.display_name && (
                <div className="text-muted-foreground text-sm">
                  {row.original.display_name}
                </div>
              )}
            </div>
          </div>
        ),
        filterFn: multiColumnFilterFn,
      },
      {
        accessorKey: "is_active",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Statut
            <div className="ml-2 h-4 w-4">
              {column.getIsSorted() === "asc" ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
          </Button>
        ),
        cell: ({ row }) => {
          const isActive = row.getValue("is_active") as boolean;
          return (
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          );
        },
        filterFn: statusFilterFn,
      },
      {
        accessorKey: "last_sync",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Dernière sync
            <div className="ml-2 h-4 w-4">
              {column.getIsSorted() === "asc" ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
          </Button>
        ),
        cell: ({ row }) => {
          const lastSync = row.getValue("last_sync") as string | null;
          if (!lastSync) {
            return <span className="text-muted-foreground">Jamais</span>;
          }
          return (
            <span className="text-sm">
              {new Date(lastSync).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "microsoft_user_id",
        header: "Microsoft ID",
        cell: ({ row }) => {
          const microsoftId = row.getValue("microsoft_user_id") as
            | string
            | null;
          if (!microsoftId) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <span className="font-mono text-sm">
              {microsoftId.slice(0, 8)}...
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const mailbox = row.original;
          return (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/mailboxes/${mailbox.id}`}>
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Voir les détails</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {canManageMailboxes && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/mailboxes/${mailbox.id}/edit`}>
                            <EditIcon className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Modifier</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(mailbox.id)}
                          disabled={toggleStatusMutation.isPending}
                        >
                          <PowerIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{mailbox.is_active ? "Désactiver" : "Activer"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(mailbox.id)}
                          disabled={syncMailboxMutation.isPending}
                        >
                          <RefreshCwIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Synchroniser</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <TrashIcon className="text-destructive h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Supprimer la boîte mail
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer la boîte mail{" "}
                          <strong>{mailbox.email_address}</strong> ? Cette
                          action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            handleDelete(mailbox.id, mailbox.email_address)
                          }
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [
      canManageMailboxes,
      syncMailboxMutation.isPending,
      toggleStatusMutation.isPending,
      handleDelete,
      handleSync,
      handleToggleStatus,
    ]
  );

  // Table instance
  const table = useReactTable({
    data: mailboxes,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    globalFilterFn: multiColumnFilterFn,
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        </div>
        <div className="rounded-md border">
          <div className="bg-muted h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <CircleAlertIcon className="text-destructive h-5 w-5" />
          <h3 className="text-destructive font-semibold">
            Erreur de chargement
          </h3>
        </div>
        <p className="text-destructive/80 mt-1 text-sm">
          {error.message ||
            "Une erreur est survenue lors du chargement des boîtes mail."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Global filter */}
          <div className="relative">
            <Input
              id={filterInputId}
              placeholder="Rechercher par email ou nom..."
              value={globalFilter ?? ""}
              onChange={e => setGlobalFilter(String(e.target.value))}
              className="h-8 w-[250px] lg:w-[300px]"
            />
          </div>

          {/* Status filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                <ListFilterIcon className="mr-2 h-4 w-4" />
                Statut
                {table.getColumn("is_active")?.getFilterValue() ? (
                  <div className="ml-2 h-4 w-4 rounded-full bg-blue-600" />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <div className="border-b p-2">
                <Label htmlFor={statusFilterId} className="text-xs font-medium">
                  Filtrer par statut
                </Label>
              </div>
              <div className="p-2">
                {[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ].map(option => {
                  const isSelected = (
                    table.getColumn("is_active")?.getFilterValue() as string[]
                  )?.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`${statusFilterId}-${option.value}`}
                        checked={isSelected}
                        onCheckedChange={checked => {
                          const currentFilter =
                            (table
                              .getColumn("is_active")
                              ?.getFilterValue() as string[]) || [];
                          if (checked) {
                            table
                              .getColumn("is_active")
                              ?.setFilterValue([
                                ...currentFilter,
                                option.value,
                              ]);
                          } else {
                            table
                              .getColumn("is_active")
                              ?.setFilterValue(
                                currentFilter.filter(v => v !== option.value)
                              );
                          }
                        }}
                      />
                      <Label
                        htmlFor={`${statusFilterId}-${option.value}`}
                        className="text-sm font-normal"
                      >
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
                {table.getColumn("is_active")?.getFilterValue() ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      table.getColumn("is_active")?.setFilterValue(undefined)
                    }
                    className="h-8 px-2 lg:px-3"
                  >
                    Effacer
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8">
                <Columns3Icon className="mr-2 h-4 w-4" />
                Colonnes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              <DropdownMenuLabel>Afficher les colonnes</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(
                  column =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map(column => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={value =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Create button */}
        {canManageMailboxes && onCreateNew && (
          <Button onClick={onCreateNew} size="sm">
            <MailIcon className="mr-2 h-4 w-4" />
            Nouvelle boîte mail
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-muted-foreground text-sm">
        {totalCount} boîte{totalCount > 1 ? "s" : ""} mail trouvée
        {totalCount > 1 ? "s" : ""}
        {table.getFilteredRowModel().rows.length !== totalCount && (
          <span>
            {" "}
            ({table.getFilteredRowModel().rows.length} affichée
            {table.getFilteredRowModel().rows.length > 1 ? "s" : ""})
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Aucune boîte mail trouvée.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} sur{" "}
          {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s).
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Lignes par page</p>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={value => {
                setPagination(prev => ({
                  ...prev,
                  pageSize: Number(value),
                  pageIndex: 0,
                }));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {pagination.pageIndex + 1} sur{" "}
            {Math.max(1, Math.ceil(totalCount / pagination.pageSize))}
          </div>
          <div className="flex items-center space-x-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setPagination(prev => ({ ...prev, pageIndex: 0 }))
                    }
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Aller à la première page</span>
                    <ChevronFirstIcon className="h-4 w-4" />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setPagination(prev => ({
                        ...prev,
                        pageIndex: Math.max(0, prev.pageIndex - 1),
                      }))
                    }
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Aller à la page précédente</span>
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setPagination(prev => ({
                        ...prev,
                        pageIndex: Math.min(
                          Math.ceil(totalCount / pagination.pageSize) - 1,
                          prev.pageIndex + 1
                        ),
                      }))
                    }
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Aller à la page suivante</span>
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      setPagination(prev => ({
                        ...prev,
                        pageIndex:
                          Math.ceil(totalCount / pagination.pageSize) - 1,
                      }))
                    }
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Aller à la dernière page</span>
                    <ChevronLastIcon className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}

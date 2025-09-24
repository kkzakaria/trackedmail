"use client";

import { useId, useMemo, useRef, useState } from "react";
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
  CircleXIcon,
  Columns3Icon,
  EllipsisIcon,
  FilterIcon,
  ListFilterIcon,
  TrashIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  UserIcon,
  CrownIcon,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

import type { UserRole } from "@/lib/types/auth";
import type { UserWithDetails, UserFilters } from "@/lib/types/user-management";
import { USER_ROLES, USER_STATUSES } from "@/lib/types/user-management";
import { useUsers, useSoftDeleteUser } from "@/lib/hooks/use-users";

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<UserWithDetails> = (
  row,
  _columnId,
  filterValue
) => {
  const searchableRowContent =
    `${row.original.full_name} ${row.original.email}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const roleFilterFn: FilterFn<UserWithDetails> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const role = row.getValue(columnId) as string;
  return filterValue.includes(role);
};

const statusFilterFn: FilterFn<UserWithDetails> = (
  row,
  columnId,
  filterValue: boolean[]
) => {
  if (!filterValue?.length) return true;
  const isActive = row.getValue(columnId) as boolean;
  return filterValue.includes(isActive);
};

interface UserListProps {
  onUserSelect?: (user: UserWithDetails) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
  currentUserId?: string;
  filters?: UserFilters;
}

export function UserList({
  onUserSelect,
  canEdit = true,
  canDelete = false,
  canCreate = true,
  currentUserId,
  filters: propFilters,
}: UserListProps) {
  const id = useId();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "full_name",
      desc: false,
    },
  ]);

  // Prepare filters for API call
  const apiFilters: UserFilters = useMemo(() => {
    const filters: UserFilters = {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      // Merge prop filters first
      ...propFilters,
    };

    // Extract search filter
    const searchFilter = columnFilters.find(f => f.id === "full_name");
    if (searchFilter?.value) {
      filters.search = searchFilter.value as string;
    }

    // Extract role filter
    const roleFilter = columnFilters.find(f => f.id === "role");
    if (
      roleFilter?.value &&
      Array.isArray(roleFilter.value) &&
      roleFilter.value.length > 0
    ) {
      // If all roles are selected, don't filter
      if (roleFilter.value.length < Object.keys(USER_ROLES).length) {
        filters.role = roleFilter.value[0] as UserRole; // Take first role for now
      }
    }

    // Extract status filter
    const statusFilter = columnFilters.find(f => f.id === "is_active");
    if (
      statusFilter?.value &&
      Array.isArray(statusFilter.value) &&
      statusFilter.value.length === 1
    ) {
      filters.isActive = statusFilter.value[0] as boolean;
    }

    return filters;
  }, [columnFilters, pagination, propFilters]);

  // Fetch users data
  const { data: usersData, isLoading } = useUsers(apiFilters);
  const softDeleteUser = useSoftDeleteUser();

  const users = usersData?.data || [];
  const totalCount = usersData?.count || 0;

  const handleDeleteUsers = async (selectedUsers: UserWithDetails[]) => {
    try {
      await Promise.all(
        selectedUsers.map(user => softDeleteUser.mutateAsync(user.id))
      );
      table.resetRowSelection();
    } catch (error) {
      console.error("Error deleting users:", error);
    }
  };

  const columns: ColumnDef<UserWithDetails>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 28,
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Utilisateur",
      accessorKey: "full_name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            {row.original.role === "administrateur" ? (
              <CrownIcon size={16} className="text-purple-600" />
            ) : row.original.role === "manager" ? (
              <ShieldCheckIcon size={16} className="text-blue-600" />
            ) : (
              <UserIcon size={16} className="text-green-600" />
            )}
          </div>
          <div>
            <div className="font-medium">{row.getValue("full_name")}</div>
            <div className="text-muted-foreground text-sm">
              {row.original.email}
            </div>
          </div>
        </div>
      ),
      size: 250,
      filterFn: multiColumnFilterFn,
      enableHiding: false,
    },
    {
      header: "Rôle",
      accessorKey: "role",
      cell: ({ row }) => {
        const role = row.getValue("role") as keyof typeof USER_ROLES;
        const roleInfo = USER_ROLES[role];

        return (
          <Badge
            variant="secondary"
            className={cn(
              roleInfo.color === "purple" &&
                "border-purple-200 bg-purple-100 text-purple-800",
              roleInfo.color === "blue" &&
                "border-blue-200 bg-blue-100 text-blue-800",
              roleInfo.color === "green" &&
                "border-green-200 bg-green-100 text-green-800"
            )}
          >
            {roleInfo.label}
          </Badge>
        );
      },
      size: 120,
      filterFn: roleFilterFn,
    },
    {
      header: "Statut",
      accessorKey: "is_active",
      cell: ({ row }) => {
        const isActive = row.getValue("is_active") as boolean;
        const statusInfo = isActive
          ? USER_STATUSES.active
          : USER_STATUSES.inactive;

        return (
          <Badge
            className={cn(
              statusInfo?.color === "green" &&
                "border-green-200 bg-green-100 text-green-800",
              statusInfo?.color === "red" &&
                "border-red-200 bg-red-100 text-red-800"
            )}
          >
            {statusInfo?.label || (isActive ? "Actif" : "Inactif")}
          </Badge>
        );
      },
      size: 100,
      filterFn: statusFilterFn,
    },
    {
      header: "Mailboxes",
      accessorKey: "user_mailbox_assignments",
      cell: ({ row }) => {
        const assignments = row.original.user_mailbox_assignments || [];
        const count = assignments.length;

        return (
          <div className="text-sm">
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground ml-1">
              assignée{count > 1 ? "s" : ""}
            </span>
          </div>
        );
      },
      size: 120,
      enableSorting: false,
    },
    {
      header: "Créé le",
      accessorKey: "created_at",
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at"));
        return (
          <div className="text-muted-foreground text-sm">
            {date.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
        );
      },
      size: 120,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <UserRowActions
          user={row.original}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserId={currentUserId}
        />
      ),
      size: 60,
      enableHiding: false,
    },
  ];

  const table = useReactTable({
    data: users,
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
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    manualPagination: true,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
  });

  // Get unique role values
  const uniqueRoleValues = useMemo(() => {
    return Object.keys(USER_ROLES);
  }, []);

  // Get unique status values
  const uniqueStatusValues = useMemo(() => {
    return [true, false]; // active, inactive
  }, []);

  const roleColumn = table.getColumn("role");
  const statusColumn = table.getColumn("is_active");

  const selectedRoles = useMemo(() => {
    const filterValue = roleColumn?.getFilterValue() as string[];
    return filterValue ?? [];
  }, [roleColumn]);

  const selectedStatuses = useMemo(() => {
    const filterValue = statusColumn?.getFilterValue() as boolean[];
    return filterValue ?? [];
  }, [statusColumn]);

  const handleRoleChange = (checked: boolean, value: string) => {
    const filterValue = table.getColumn("role")?.getFilterValue() as string[];
    const newFilterValue = filterValue ? [...filterValue] : [];

    if (checked) {
      newFilterValue.push(value);
    } else {
      const index = newFilterValue.indexOf(value);
      if (index > -1) {
        newFilterValue.splice(index, 1);
      }
    }

    table
      .getColumn("role")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  const handleStatusChange = (checked: boolean, value: boolean) => {
    const filterValue = table
      .getColumn("is_active")
      ?.getFilterValue() as boolean[];
    const newFilterValue = filterValue ? [...filterValue] : [];

    if (checked) {
      newFilterValue.push(value);
    } else {
      const index = newFilterValue.indexOf(value);
      if (index > -1) {
        newFilterValue.splice(index, 1);
      }
    }

    table
      .getColumn("is_active")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Filter by name or email */}
          <div className="relative">
            <Input
              id={`${id}-input`}
              ref={inputRef}
              className={cn(
                "peer min-w-60 ps-9",
                Boolean(table.getColumn("full_name")?.getFilterValue()) &&
                  "pe-9"
              )}
              value={
                (table.getColumn("full_name")?.getFilterValue() ?? "") as string
              }
              onChange={e =>
                table.getColumn("full_name")?.setFilterValue(e.target.value)
              }
              placeholder="Rechercher par nom ou email..."
              type="text"
              aria-label="Filter by name or email"
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <ListFilterIcon size={16} aria-hidden="true" />
            </div>
            {Boolean(table.getColumn("full_name")?.getFilterValue()) && (
              <button
                className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Clear filter"
                onClick={() => {
                  table.getColumn("full_name")?.setFilterValue("");
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
              >
                <CircleXIcon size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Filter by role */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <FilterIcon
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Rôle
                {selectedRoles.length > 0 && (
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                    {selectedRoles.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-36 p-3" align="start">
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium">
                  Rôles
                </div>
                <div className="space-y-3">
                  {uniqueRoleValues.map((value, i) => {
                    const roleInfo =
                      USER_ROLES[value as keyof typeof USER_ROLES];
                    return (
                      <div key={value} className="flex items-center gap-2">
                        <Checkbox
                          id={`${id}-role-${i}`}
                          checked={selectedRoles.includes(value)}
                          onCheckedChange={(checked: boolean) =>
                            handleRoleChange(checked, value)
                          }
                        />
                        <Label
                          htmlFor={`${id}-role-${i}`}
                          className="flex grow justify-between gap-2 font-normal"
                        >
                          {roleInfo.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Filter by status */}
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
                  Statut
                </div>
                <div className="space-y-3">
                  {uniqueStatusValues.map((value, i) => {
                    const statusInfo = value
                      ? USER_STATUSES.active
                      : USER_STATUSES.inactive;
                    return (
                      <div
                        key={String(value)}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`${id}-status-${i}`}
                          checked={selectedStatuses.includes(value)}
                          onCheckedChange={(checked: boolean) =>
                            handleStatusChange(checked, value)
                          }
                        />
                        <Label
                          htmlFor={`${id}-status-${i}`}
                          className="flex grow justify-between gap-2 font-normal"
                        >
                          {statusInfo?.label || (value ? "Actif" : "Inactif")}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Toggle columns visibility */}
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
              <DropdownMenuLabel>Afficher/Masquer</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={value =>
                        column.toggleVisibility(!!value)
                      }
                      onSelect={event => event.preventDefault()}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          {/* Delete button */}
          {canDelete && table.getSelectedRowModel().rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <TrashIcon
                    className="-ms-1 opacity-60"
                    size={16}
                    aria-hidden="true"
                  />
                  Supprimer
                  <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                    {table.getSelectedRowModel().rows.length}
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                    aria-hidden="true"
                  >
                    <CircleAlertIcon className="opacity-80" size={16} />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Êtes-vous absolument sûr ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action désactivera{" "}
                      {table.getSelectedRowModel().rows.length} utilisateur
                      {table.getSelectedRowModel().rows.length === 1
                        ? ""
                        : "s"}{" "}
                      sélectionné
                      {table.getSelectedRowModel().rows.length === 1 ? "" : "s"}
                      . Ils pourront être restaurés par un administrateur.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      handleDeleteUsers(
                        table
                          .getSelectedRowModel()
                          .rows.map(row => row.original)
                      )
                    }
                  >
                    Désactiver
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Add user button */}
          {canCreate && (
            <Button asChild>
              <Link href="/admin/users/new">
                <UserPlusIcon
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Nouvel utilisateur
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-background overflow-hidden rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className="h-11"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={e => {
                            if (
                              header.column.getCanSort() &&
                              (e.key === "Enter" || e.key === " ")
                            ) {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: (
                              <ChevronUpIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                            desc: (
                              <ChevronDownIcon
                                className="shrink-0 opacity-60"
                                size={16}
                                aria-hidden="true"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Chargement des utilisateurs...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    onUserSelect && "hover:bg-muted/50 cursor-pointer"
                  )}
                  onClick={() => onUserSelect?.(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="last:py-0">
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
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-8">
        {/* Results per page */}
        <div className="flex items-center gap-3">
          <Label htmlFor={id} className="max-sm:sr-only">
            Lignes par page
          </Label>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={value => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger id={id} className="w-fit whitespace-nowrap">
              <SelectValue placeholder="Sélectionnez le nombre de résultats" />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50].map(pageSize => (
                <SelectItem key={pageSize} value={pageSize.toString()}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page number information */}
        <div className="text-muted-foreground flex grow justify-end text-sm whitespace-nowrap">
          <p
            className="text-muted-foreground text-sm whitespace-nowrap"
            aria-live="polite"
          >
            <span className="text-foreground">
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}
              -
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                totalCount
              )}
            </span>{" "}
            sur <span className="text-foreground">{totalCount}</span>
          </p>
        </div>

        {/* Pagination buttons */}
        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Première page"
                >
                  <ChevronFirstIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Page précédente"
                >
                  <ChevronLeftIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Page suivante"
                >
                  <ChevronRightIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Dernière page"
                >
                  <ChevronLastIcon size={16} aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}

function UserRowActions({
  user,
  canEdit,
  canDelete,
  currentUserId,
}: {
  user: UserWithDetails;
  canEdit?: boolean;
  canDelete?: boolean;
  currentUserId?: string | undefined;
}) {
  const softDeleteUser = useSoftDeleteUser();

  const handleSoftDelete = async () => {
    try {
      await softDeleteUser.mutateAsync(user.id);
    } catch (error) {
      console.error("Error soft deleting user:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="shadow-none"
            aria-label="Actions utilisateur"
          >
            <EllipsisIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>
              <span>Voir détails</span>
              <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${user.id}/edit`}>
                <span>Modifier</span>
                <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <span>Statistiques</span>
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Assignations</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Voir les mailboxes</DropdownMenuItem>
                <DropdownMenuItem>Gérer les assignations</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {user.id === currentUserId ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-not-allowed opacity-50"
                          disabled={true}
                        >
                          <span>
                            {user.is_active ? "Désactiver" : "Activer"}
                          </span>
                          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Vous ne pouvez pas vous désactiver vous-même</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleSoftDelete}
                  disabled={softDeleteUser.isPending}
                >
                  <span>{user.is_active ? "Désactiver" : "Activer"}</span>
                  <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

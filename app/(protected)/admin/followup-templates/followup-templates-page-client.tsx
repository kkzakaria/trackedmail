"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Row,
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
  PlusIcon,
  TrashIcon,
  Edit3Icon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
  CopyIcon,
  ClockIcon,
  HashIcon,
  CheckCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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

import { followupTemplateService } from "@/lib/services/followup-template.service";
import { FollowupTemplateWithStats } from "@/lib/types/followup.types";

type TemplateItem = {
  id: string;
  name: string;
  subject: string;
  followup_number: number;
  delay_hours: number | null;
  is_active: boolean | null;
  usage_count?: number;
  success_rate?: number;
  updated_at: string | null;
  created_at: string | null;
  version: number | null;
};

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<TemplateItem> = (
  row,
  _columnId,
  filterValue
) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.subject}`.toLowerCase();
  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableRowContent.includes(searchTerm);
};

const statusFilterFn: FilterFn<TemplateItem> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as boolean;
  const statusString = status ? "active" : "inactive";
  return filterValue.includes(statusString);
};

const levelFilterFn: FilterFn<TemplateItem> = (
  row,
  columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true;
  const level = row.getValue(columnId) as number;
  return filterValue.includes(level.toString());
};

const columns: ColumnDef<TemplateItem>[] = [
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
    size: 40,
    enableSorting: false,
    enableHiding: false,
  },
  {
    header: "Template",
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.getValue("name")}</div>
        <div className="text-muted-foreground max-w-[300px] truncate text-sm">
          {row.original.subject}
        </div>
      </div>
    ),
    size: 300,
    filterFn: multiColumnFilterFn,
    enableHiding: false,
  },
  {
    header: "Niveau",
    accessorKey: "followup_number",
    cell: ({ row }) => {
      const level = row.getValue("followup_number") as number;
      const colors = {
        1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        2: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
        3: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };

      return (
        <Badge
          className={
            colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800"
          }
        >
          <HashIcon className="mr-1 h-3 w-3" />
          Relance {level}
        </Badge>
      );
    },
    size: 120,
    filterFn: levelFilterFn,
  },
  {
    header: "Statut",
    accessorKey: "is_active",
    cell: ({ row }) => {
      const isActive = row.getValue("is_active") as boolean;
      return (
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={cn(
            isActive &&
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          )}
        >
          {isActive ? (
            <>
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              Actif
            </>
          ) : (
            "Inactif"
          )}
        </Badge>
      );
    },
    size: 100,
    filterFn: statusFilterFn,
  },
  {
    header: "Délai",
    accessorKey: "delay_hours",
    cell: ({ row }) => {
      const hours = row.getValue("delay_hours") as number | null;
      const displayHours = hours || 0;

      return (
        <div className="flex items-center gap-1">
          <ClockIcon className="text-muted-foreground h-3 w-3" />
          <span className="text-sm">
            {displayHours}h
            {displayHours >= 24 && (
              <span className="text-muted-foreground ml-1">
                ({Math.floor(displayHours / 24)}j)
              </span>
            )}
          </span>
        </div>
      );
    },
    size: 100,
  },
  {
    header: "Performance",
    accessorKey: "performance",
    cell: ({ row }) => {
      const usageCount = row.original.usage_count || 0;
      const successRate = row.original.success_rate || 0;

      return (
        <div className="text-sm">
          <div className="font-medium">{usageCount} envois</div>
          <div
            className={cn(
              "text-xs",
              successRate > 20
                ? "text-green-600"
                : successRate > 10
                  ? "text-orange-600"
                  : "text-red-600"
            )}
          >
            {successRate}% succès
          </div>
        </div>
      );
    },
    size: 120,
  },
  {
    header: "Dernière MAJ",
    accessorKey: "updated_at",
    cell: ({ row }) => {
      const date = row.getValue("updated_at") as string | null;
      if (!date) return <span className="text-muted-foreground">-</span>;

      return (
        <span className="text-sm">
          {new Date(date).toLocaleDateString("fr-FR")}
        </span>
      );
    },
    size: 120,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

interface FollowupTemplatesPageClientProps {
  initialData?: TemplateItem[];
}

export function FollowupTemplatesPageClient({
  initialData = [],
}: FollowupTemplatesPageClientProps) {
  const id = useId();
  const [data, setData] = useState<TemplateItem[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "updated_at",
      desc: true,
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const result = await followupTemplateService.getTemplates({
        pagination: {
          page: 1,
          per_page: 100, // Load all for client-side filtering
          sort_by: "updated_at",
          sort_order: "desc",
        },
        include_stats: true,
      });

      const templates = result.data as FollowupTemplateWithStats[];
      setData(templates);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erreur lors du chargement des templates");
      setData([]); // S'assurer que data est défini même en cas d'erreur
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only load if no initial data was provided
    if (!initialData || initialData.length === 0) {
      loadTemplates();
    }
  }, [initialData, loadTemplates]);

  // Handle bulk delete
  const handleDeleteRows = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    try {
      await Promise.all(
        selectedRows.map(row =>
          followupTemplateService.deleteTemplate(row.original.id)
        )
      );
      toast.success(
        `${selectedRows.length} template(s) supprimé(s) avec succès`
      );
      loadTemplates();
      table.resetRowSelection();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

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

  // Get unique status values
  const uniqueStatusValues = useMemo(() => {
    const statusColumn = table.getColumn("is_active");
    if (!statusColumn) return [];

    return [
      { value: "active", label: "Actif" },
      { value: "inactive", label: "Inactif" },
    ];
  }, [table]);

  // Get unique level values
  const levelColumn = table.getColumn("followup_number");
  const uniqueLevelValues = useMemo(() => {
    if (!levelColumn) return [];

    const values = Array.from(levelColumn.getFacetedUniqueValues().keys());
    return values
      .sort()
      .map(v => ({ value: v.toString(), label: `Relance ${v}` }));
  }, [levelColumn]);

  // Status filter handlers
  const statusColumn = table.getColumn("is_active");
  const selectedStatuses = useMemo(() => {
    const filterValue = statusColumn?.getFilterValue() as string[];
    return filterValue ?? [];
  }, [statusColumn]);

  const handleStatusChange = (checked: boolean, value: string) => {
    const filterValue = table
      .getColumn("is_active")
      ?.getFilterValue() as string[];
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

  // Level filter handlers
  const levelFilterColumn = table.getColumn("followup_number");
  const selectedLevels = useMemo(() => {
    const filterValue = levelFilterColumn?.getFilterValue() as string[];
    return filterValue ?? [];
  }, [levelFilterColumn]);

  const handleLevelChange = (checked: boolean, value: string) => {
    const filterValue = table
      .getColumn("followup_number")
      ?.getFilterValue() as string[];
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
      .getColumn("followup_number")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Chargement des templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Search by name or subject */}
                <div className="relative">
                  <Input
                    id={`${id}-input`}
                    ref={inputRef}
                    className={cn(
                      "peer min-w-60 ps-9",
                      Boolean(table.getColumn("name")?.getFilterValue()) &&
                        "pe-9"
                    )}
                    value={
                      (table.getColumn("name")?.getFilterValue() ??
                        "") as string
                    }
                    onChange={e =>
                      table.getColumn("name")?.setFilterValue(e.target.value)
                    }
                    placeholder="Rechercher par nom ou sujet..."
                    type="text"
                    aria-label="Filter by name or subject"
                  />
                  <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                    <ListFilterIcon size={16} aria-hidden="true" />
                  </div>
                  {Boolean(table.getColumn("name")?.getFilterValue()) && (
                    <button
                      className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Clear filter"
                      onClick={() => {
                        table.getColumn("name")?.setFilterValue("");
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                    >
                      <CircleXIcon size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

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
                        Filtres par statut
                      </div>
                      <div className="space-y-3">
                        {uniqueStatusValues.map((status, i) => (
                          <div
                            key={status.value}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`${id}-status-${i}`}
                              checked={selectedStatuses.includes(status.value)}
                              onCheckedChange={(checked: boolean) =>
                                handleStatusChange(checked, status.value)
                              }
                            />
                            <Label
                              htmlFor={`${id}-status-${i}`}
                              className="flex grow justify-between gap-2 font-normal"
                            >
                              {status.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Filter by level */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <HashIcon
                        className="-ms-1 opacity-60"
                        size={16}
                        aria-hidden="true"
                      />
                      Niveau
                      {selectedLevels.length > 0 && (
                        <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                          {selectedLevels.length}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto min-w-36 p-3" align="start">
                    <div className="space-y-3">
                      <div className="text-muted-foreground text-xs font-medium">
                        Filtres par niveau
                      </div>
                      <div className="space-y-3">
                        {uniqueLevelValues.map((level, i) => (
                          <div
                            key={level.value}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`${id}-level-${i}`}
                              checked={selectedLevels.includes(level.value)}
                              onCheckedChange={(checked: boolean) =>
                                handleLevelChange(checked, level.value)
                              }
                            />
                            <Label
                              htmlFor={`${id}-level-${i}`}
                              className="flex grow justify-between gap-2 font-normal"
                            >
                              {level.label}
                            </Label>
                          </div>
                        ))}
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
                    <DropdownMenuLabel>
                      Afficher/masquer colonnes
                    </DropdownMenuLabel>
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
                {/* Add new template button */}
                <Link href="/admin/followup-templates/new">
                  <Button>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Nouveau Template
                  </Button>
                </Link>

                {/* Delete button */}
                {table.getSelectedRowModel().rows.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="ml-auto" variant="outline">
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
                            Cette action ne peut pas être annulée. Cela
                            supprimera définitivement{" "}
                            {table.getSelectedRowModel().rows.length}{" "}
                            template(s) sélectionné(s).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRows}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-background overflow-hidden rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                    <TableRow
                      key={headerGroup.id}
                      className="hover:bg-transparent"
                    >
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
                                    header.column.getToggleSortingHandler()?.(
                                      e
                                    );
                                  }
                                }}
                                tabIndex={
                                  header.column.getCanSort() ? 0 : undefined
                                }
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
                                }[header.column.getIsSorted() as string] ??
                                  null}
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
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map(row => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
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
                        <div className="py-12">
                          <div className="text-muted-foreground mb-4">
                            Aucun template trouvé
                          </div>
                          <Link href="/admin/followup-templates/new">
                            <Button>
                              <PlusIcon className="mr-2 h-4 w-4" />
                              Créer votre premier template
                            </Button>
                          </Link>
                        </div>
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
                    <SelectValue placeholder="Sélectionner le nombre de résultats" />
                  </SelectTrigger>
                  <SelectContent className="[&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8 [&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2">
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
                      Math.max(
                        table.getState().pagination.pageIndex *
                          table.getState().pagination.pageSize +
                          table.getState().pagination.pageSize,
                        0
                      ),
                      table.getRowCount()
                    )}
                  </span>{" "}
                  sur{" "}
                  <span className="text-foreground">
                    {table.getRowCount().toString()}
                  </span>
                </p>
              </div>

              {/* Pagination buttons */}
              <div>
                <Pagination>
                  <PaginationContent>
                    {/* First page button */}
                    <PaginationItem>
                      <Button
                        size="icon"
                        variant="outline"
                        className="disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => table.firstPage()}
                        disabled={!table.getCanPreviousPage()}
                        aria-label="Aller à la première page"
                      >
                        <ChevronFirstIcon size={16} aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                    {/* Previous page button */}
                    <PaginationItem>
                      <Button
                        size="icon"
                        variant="outline"
                        className="disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        aria-label="Aller à la page précédente"
                      >
                        <ChevronLeftIcon size={16} aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                    {/* Next page button */}
                    <PaginationItem>
                      <Button
                        size="icon"
                        variant="outline"
                        className="disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        aria-label="Aller à la page suivante"
                      >
                        <ChevronRightIcon size={16} aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                    {/* Last page button */}
                    <PaginationItem>
                      <Button
                        size="icon"
                        variant="outline"
                        className="disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => table.lastPage()}
                        disabled={!table.getCanNextPage()}
                        aria-label="Aller à la dernière page"
                      >
                        <ChevronLastIcon size={16} aria-hidden="true" />
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RowActions({ row }: { row: Row<TemplateItem> }) {
  const template = row.original;

  const handleToggleStatus = async () => {
    try {
      await followupTemplateService.toggleTemplateStatus(
        template.id,
        !template.is_active
      );
      toast.success(
        `Template ${!template.is_active ? "activé" : "désactivé"} avec succès`
      );
      // Recharger la page
      window.location.reload();
    } catch {
      toast.error("Erreur lors de la modification du statut");
    }
  };

  const handleDuplicate = async () => {
    try {
      const duplicated = await followupTemplateService.duplicateTemplate(
        template.id
      );
      toast.success("Template dupliqué avec succès");
      // Rediriger vers le template dupliqué
      window.location.href = `/admin/followup-templates/${duplicated.id}`;
    } catch {
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce template ?")) {
      return;
    }

    try {
      await followupTemplateService.deleteTemplate(template.id);
      toast.success("Template supprimé avec succès");
      // Recharger la page
      window.location.reload();
    } catch {
      toast.error("Erreur lors de la suppression");
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
            aria-label="Actions sur le template"
          >
            <EllipsisIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/admin/followup-templates/${template.id}`}>
              <EyeIcon className="mr-2 h-4 w-4" />
              Voir
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/followup-templates/${template.id}`}>
              <Edit3Icon className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Dupliquer
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleToggleStatus}>
            {template.is_active ? (
              <>
                <PauseIcon className="mr-2 h-4 w-4" />
                Désactiver
              </>
            ) : (
              <>
                <PlayIcon className="mr-2 h-4 w-4" />
                Activer
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

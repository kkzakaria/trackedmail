"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  FilterIcon,
  ListFilterIcon,
  MailIcon,
  StopCircleIcon,
  TrashIcon,
  AlertTriangleIcon,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
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

import { TrackedEmailStatusBadge } from "./TrackedEmailStatusBadge";
import { TrackedEmailActions } from "./TrackedEmailActions";
import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { isAdmin } from "@/lib/utils/auth-utils";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Format recipient list
const formatRecipients = (recipients: string[], maxShow = 2) => {
  if (recipients.length <= maxShow) {
    return recipients.join(", ");
  }
  return `${recipients.slice(0, maxShow).join(", ")} +${recipients.length - maxShow}`;
};

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<TrackedEmailWithDetails> = (
  row,
  _columnId,
  filterValue
) => {
  const email = row.original;
  const searchableContent = [
    email.subject,
    email.recipient_emails.join(" "),
    email.sender_email,
    email.mailbox?.email_address || "",
  ]
    .join(" ")
    .toLowerCase();

  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableContent.includes(searchTerm);
};

const statusFilterFn: FilterFn<TrackedEmailWithDetails> = (
  row,
  columnId,
  filterValue: EmailStatus[]
) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as EmailStatus;
  return filterValue.includes(status);
};

export default function TrackedEmailsTable() {
  const router = useRouter();
  const { user } = useAuth();
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
      id: "sent_at",
      desc: true,
    },
  ]);

  const [data, setData] = useState<TrackedEmailWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);

  // Fetch all emails (client-side pagination)
  useEffect(() => {
    async function fetchEmails() {
      try {
        setLoading(true);
        const result = await TrackedEmailService.getTrackedEmails({
          page: 0,
          pageSize: 1000, // Load all emails for client-side pagination
          sortBy: "sent_at",
          sortOrder: "desc",
        });
        setData(result.data);
      } catch (error) {
        console.error("Failed to fetch emails:", error);
        toast.error("Erreur lors du chargement des emails");
      } finally {
        setLoading(false);
      }
    }
    fetchEmails();
  }, []);

  const handleDeleteEmail = useCallback(
    async (email: TrackedEmailWithDetails) => {
      if (!isAdmin(user)) return;

      try {
        await TrackedEmailService.deleteTrackedEmail(email.id);
        toast.success("Email supprimé avec succès");
        // Remove from local state
        setData(prev => prev.filter(e => e.id !== email.id));
      } catch (error) {
        console.error("Failed to delete email:", error);
        toast.error("Erreur lors de la suppression de l'email");
      }
    },
    [user]
  );

  const handleStatusUpdate = useCallback(
    async (emailId: string, status: EmailStatus) => {
      try {
        await TrackedEmailService.updateEmailStatus(emailId, status);
        toast.success("Statut mis à jour");
        // Update local state
        setData(prev =>
          prev.map(email =>
            email.id === emailId
              ? {
                  ...email,
                  status,
                  stopped_at:
                    status === "stopped"
                      ? new Date().toISOString()
                      : email.stopped_at,
                }
              : email
          )
        );
      } catch (error) {
        console.error("Failed to update status:", error);
        toast.error("Erreur lors de la mise à jour du statut");
      }
    },
    []
  );

  const columns: ColumnDef<TrackedEmailWithDetails>[] = useMemo(
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
        header: "Destinataire",
        accessorKey: "recipient_emails",
        cell: ({ row }) => {
          const email = row.original;
          return (
            <div className="min-w-0">
              <div className="truncate font-medium">
                {formatRecipients(email.recipient_emails)}
              </div>
              <div className="text-muted-foreground truncate text-sm">
                {email.subject}
              </div>
            </div>
          );
        },
        size: 250,
        filterFn: multiColumnFilterFn,
        enableHiding: false,
      },
      {
        header: "Boîte mail",
        accessorKey: "mailbox",
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="font-medium">
              {row.original.mailbox?.display_name || "N/A"}
            </div>
            <div className="text-muted-foreground">
              {row.original.mailbox?.email_address}
            </div>
          </div>
        ),
        size: 200,
      },
      {
        header: "Statut",
        accessorKey: "status",
        cell: ({ row }) => (
          <TrackedEmailStatusBadge status={row.getValue("status")} />
        ),
        size: 120,
        filterFn: statusFilterFn,
      },
      {
        header: "Envoyé le",
        accessorKey: "sent_at",
        cell: ({ row }) => {
          const email = row.original;
          const daysSince = Math.floor(
            (new Date().getTime() - new Date(email.sent_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          return (
            <div className="text-sm">
              <div>{formatDate(email.sent_at)}</div>
              <div className="text-muted-foreground">
                Il y a {daysSince} jour{daysSince > 1 ? "s" : ""}
              </div>
            </div>
          );
        },
        size: 140,
      },
      {
        header: "Suivi",
        accessorKey: "followup_count",
        cell: ({ row }) => {
          const email = row.original;
          const highFollowupCount = email.followup_count >= 4;
          const requiresManualReview = email.requires_manual_review;

          return (
            <div className="text-center text-sm">
              <div className="flex items-center justify-center gap-1">
                <MailIcon className="h-3 w-3" />
                <span>0</span>
                {(highFollowupCount || requiresManualReview) && (
                  <AlertTriangleIcon className="h-3 w-3 text-red-500" />
                )}
              </div>
              <div
                className={cn(
                  "text-muted-foreground",
                  (highFollowupCount || requiresManualReview) &&
                    "font-medium text-red-600"
                )}
              >
                {email.followup_count} relance
                {email.followup_count > 1 ? "s" : ""}
                {requiresManualReview && (
                  <div className="mt-1 text-xs text-red-600">
                    Révision requise
                  </div>
                )}
              </div>
            </div>
          );
        },
        size: 120,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <TrackedEmailActions
            row={row}
            onStatusUpdate={handleStatusUpdate}
            onViewDetails={email => {
              router.push(`/dashboard/emails/${email.id}`);
            }}
            onSendFollowup={email => {
              console.warn("Send followup:", email);
              // TODO: Implement followup modal
            }}
            onDelete={handleDeleteEmail}
          />
        ),
        size: 60,
        enableHiding: false,
      },
    ],
    [router, handleDeleteEmail, handleStatusUpdate]
  );

  const handleBulkStop = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const emailIds = selectedRows.map(row => row.original.id);

    try {
      await TrackedEmailService.bulkUpdateStatus(emailIds, "stopped");
      toast.success("Emails arrêtés avec succès");
      // Update local state
      setData(prev =>
        prev.map(email =>
          emailIds.includes(email.id)
            ? {
                ...email,
                status: "stopped",
                stopped_at: new Date().toISOString(),
              }
            : email
        )
      );
      table.resetRowSelection();
    } catch (error) {
      console.error("Failed to stop emails:", error);
      toast.error("Erreur lors de l'arrêt des emails");
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    const emailIds = selectedRows.map(row => row.original.id);

    if (!isAdmin(user) || emailIds.length === 0) return;

    try {
      setBulkOperationLoading(true);
      const result = await TrackedEmailService.bulkDeleteEmails(emailIds);

      if (result.errors.length > 0) {
        toast.error(
          `Suppression partielle: ${result.errors.length} erreurs sur ${emailIds.length} emails`
        );
        console.error("Bulk delete errors:", result.errors);
      } else {
        toast.success(`${result.deleted} email(s) supprimé(s) avec succès`);
      }

      // Remove deleted emails from local state
      setData(prev => prev.filter(email => !emailIds.includes(email.id)));
      table.resetRowSelection();
    } catch (error) {
      console.error("Failed to delete emails:", error);
      toast.error("Erreur lors de la suppression des emails");
    } finally {
      setBulkOperationLoading(false);
      setShowBulkDeleteDialog(false);
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

  // Extract column references for stable dependencies
  const statusColumn = table.getColumn("status");
  const statusFacetedValues = statusColumn?.getFacetedUniqueValues();
  const statusFilterValue = statusColumn?.getFilterValue() as EmailStatus[];

  // Get unique status values
  const uniqueStatusValues = useMemo(() => {
    if (!statusColumn) return [];
    const values = Array.from(statusFacetedValues?.keys() || []);
    return values.sort();
  }, [statusColumn, statusFacetedValues]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    if (!statusColumn) return new Map();
    return statusFacetedValues || new Map();
  }, [statusColumn, statusFacetedValues]);

  const selectedStatuses = useMemo(() => {
    return statusFilterValue ?? [];
  }, [statusFilterValue]);

  const handleStatusChange = (checked: boolean, value: EmailStatus) => {
    const filterValue = table
      .getColumn("status")
      ?.getFilterValue() as EmailStatus[];
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
      .getColumn("status")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground">Chargement des emails...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Filter by search */}
          <div className="relative">
            <Input
              id={`${id}-input`}
              ref={inputRef}
              className={cn(
                "peer min-w-60 ps-9",
                Boolean(
                  table.getColumn("recipient_emails")?.getFilterValue()
                ) && "pe-9"
              )}
              value={
                (table.getColumn("recipient_emails")?.getFilterValue() ??
                  "") as string
              }
              onChange={e =>
                table
                  .getColumn("recipient_emails")
                  ?.setFilterValue(e.target.value)
              }
              placeholder="Rechercher par destinataire ou sujet..."
              type="text"
              aria-label="Rechercher par destinataire ou sujet"
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <ListFilterIcon size={16} aria-hidden="true" />
            </div>
            {Boolean(table.getColumn("recipient_emails")?.getFilterValue()) && (
              <button
                className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Clear filter"
                onClick={() => {
                  table.getColumn("recipient_emails")?.setFilterValue("");
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
                  Filtres
                </div>
                <div className="space-y-3">
                  {uniqueStatusValues.map((value, i) => (
                    <div key={value} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-${i}`}
                        checked={selectedStatuses.includes(
                          value as EmailStatus
                        )}
                        onCheckedChange={(checked: boolean) =>
                          handleStatusChange(checked, value as EmailStatus)
                        }
                      />
                      <Label
                        htmlFor={`${id}-${i}`}
                        className="flex grow justify-between gap-2 font-normal"
                      >
                        <TrackedEmailStatusBadge
                          status={value as EmailStatus}
                        />
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
              <DropdownMenuLabel>Afficher/masquer colonnes</DropdownMenuLabel>
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
          {/* Bulk actions */}
          {table.getSelectedRowModel().rows.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  <StopCircleIcon
                    className="-ms-1 opacity-60"
                    size={16}
                    aria-hidden="true"
                  />
                  Arrêter
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
                      Arrêter le suivi des emails sélectionnés ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action arrêtera le suivi de{" "}
                      {table.getSelectedRowModel().rows.length} email
                      {table.getSelectedRowModel().rows.length === 1
                        ? ""
                        : "s"}{" "}
                      sélectionné
                      {table.getSelectedRowModel().rows.length === 1 ? "" : "s"}
                      . Aucune relance automatique ne sera envoyée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkStop}>
                    Arrêter le suivi
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Bulk delete action - Admin only */}
          {table.getSelectedRowModel().rows.length > 0 && isAdmin(user) && (
            <AlertDialog
              open={showBulkDeleteDialog}
              onOpenChange={setShowBulkDeleteDialog}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="ml-2">
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
                    className="border-destructive flex size-9 shrink-0 items-center justify-center rounded-full border"
                    aria-hidden="true"
                  >
                    <TrashIcon
                      className="text-destructive opacity-80"
                      size={16}
                    />
                  </div>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Supprimer définitivement les emails sélectionnés ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible.{" "}
                      {table.getSelectedRowModel().rows.length} email
                      {table.getSelectedRowModel().rows.length === 1
                        ? ""
                        : "s"}{" "}
                      et toutes les données associées (réponses, relances,
                      historique) seront définitivement supprimé
                      {table.getSelectedRowModel().rows.length === 1 ? "" : "s"}
                      .
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={bulkOperationLoading}
                  >
                    {bulkOperationLoading
                      ? "Suppression..."
                      : "Supprimer définitivement"}
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
                  Aucun email trouvé.
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
              <SelectValue placeholder="Nombre de résultats" />
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
                  aria-label="Première page"
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
                  aria-label="Page précédente"
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
                  aria-label="Page suivante"
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

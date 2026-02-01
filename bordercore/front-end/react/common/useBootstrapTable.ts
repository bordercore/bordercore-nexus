import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type TableOptions,
  type Table,
} from "@tanstack/react-table";

export interface BootstrapTableOptions<TData> extends Omit<
  TableOptions<TData>,
  "getCoreRowModel" | "getSortedRowModel" | "getPaginationRowModel"
> {
  enableSorting?: boolean;
  enablePagination?: boolean;
  defaultSorting?: Array<{ id: string; desc: boolean }>;
}

/**
 * A utility hook that wraps TanStack Table with Bootstrap styling defaults.
 * Provides common table features (sorting, pagination) with Bootstrap classes.
 *
 * @param options - Table configuration options
 * @returns Table instance with Bootstrap styling helpers
 */
export function useBootstrapTable<TData>(options: BootstrapTableOptions<TData>) {
  const {
    enableSorting = true,
    enablePagination = false,
    defaultSorting = [],
    ...tableOptions
  } = options;

  const table = useReactTable({
    ...tableOptions,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      sorting: defaultSorting.length > 0 ? defaultSorting : undefined,
      ...tableOptions.initialState,
    },
  });

  /**
   * Get Bootstrap classes for the table element
   */
  const getTableClasses = (additionalClasses: string = "") => {
    const baseClasses = "table table-hover table-sm";
    return additionalClasses ? `${baseClasses} ${additionalClasses}` : baseClasses;
  };

  /**
   * Get Bootstrap classes for sortable header cells
   */
  const getHeaderClasses = (isSorted: boolean, canSort: boolean) => {
    const classes = [];
    if (canSort) {
      classes.push("cursor-pointer");
    }
    if (isSorted) {
      classes.push("table-active");
    }
    return classes.join(" ");
  };

  return {
    table,
    getTableClasses,
    getHeaderClasses,
  };
}

export type { Table };

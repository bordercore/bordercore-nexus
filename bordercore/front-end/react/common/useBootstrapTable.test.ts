import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { useBootstrapTable } from "./useBootstrapTable";

interface Row {
  name: string;
}

const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];

const makeData = (names: string[]): Row[] => names.map(name => ({ name }));

describe("useBootstrapTable", () => {
  describe("getTableClasses", () => {
    it("returns the baseline Bootstrap classes", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getTableClasses()).toBe("table table-hover table-sm");
    });

    it("appends caller-supplied additional classes", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getTableClasses("my-class other")).toBe(
        "table table-hover table-sm my-class other"
      );
    });
  });

  describe("getHeaderClasses", () => {
    it("returns '' when the column is not sortable and not sorted", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getHeaderClasses(false, false)).toBe("");
    });

    it("returns 'cursor-pointer' when sortable but not currently sorted", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getHeaderClasses(false, true)).toBe("cursor-pointer");
    });

    it("returns 'table-active' when sorted but not sortable", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getHeaderClasses(true, false)).toBe("table-active");
    });

    it("returns both classes when sortable and sorted", () => {
      const { result } = renderHook(() => useBootstrapTable<Row>({ data: [], columns }));
      expect(result.current.getHeaderClasses(true, true)).toBe("cursor-pointer table-active");
    });
  });

  describe("sorting", () => {
    it("applies defaultSorting to the table's initial sorting state", () => {
      const { result } = renderHook(() =>
        useBootstrapTable<Row>({
          data: makeData(["banana", "apple", "cherry"]),
          columns,
          defaultSorting: [{ id: "name", desc: true }],
        })
      );
      expect(result.current.table.getState().sorting).toEqual([{ id: "name", desc: true }]);
    });

    it("sorts rows when a sort is applied (enableSorting defaults to true)", () => {
      const { result } = renderHook(() =>
        useBootstrapTable<Row>({
          data: makeData(["banana", "apple", "cherry"]),
          columns,
        })
      );
      act(() => {
        result.current.table.setSorting([{ id: "name", desc: false }]);
      });
      const sorted = result.current.table.getRowModel().rows.map(r => r.original.name);
      expect(sorted).toEqual(["apple", "banana", "cherry"]);
    });

    it("leaves rows in source order when enableSorting is false, even with sort state set", () => {
      const input = ["banana", "apple", "cherry"];
      const { result } = renderHook(() =>
        useBootstrapTable<Row>({
          data: makeData(input),
          columns,
          enableSorting: false,
        })
      );
      act(() => {
        result.current.table.setSorting([{ id: "name", desc: false }]);
      });
      const rows = result.current.table.getRowModel().rows.map(r => r.original.name);
      expect(rows).toEqual(input);
    });
  });

  describe("pagination", () => {
    it("does not paginate by default (all rows visible)", () => {
      const data = makeData(Array.from({ length: 25 }, (_, i) => `row-${i}`));
      const { result } = renderHook(() => useBootstrapTable<Row>({ data, columns }));
      expect(result.current.table.getRowModel().rows).toHaveLength(25);
    });

    it("paginates rows when enablePagination is true", () => {
      const data = makeData(Array.from({ length: 25 }, (_, i) => `row-${i}`));
      const { result } = renderHook(() =>
        useBootstrapTable<Row>({ data, columns, enablePagination: true })
      );
      // TanStack's default page size is 10.
      expect(result.current.table.getRowModel().rows).toHaveLength(10);
      expect(result.current.table.getPageCount()).toBe(3);
    });
  });
});

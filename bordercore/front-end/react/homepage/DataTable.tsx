import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleUp, faAngleDown } from "@fortawesome/free-solid-svg-icons";
import type { SortConfig } from "./types";

interface DataTableProps {
  data: Record<string, any>[];
  columns: string[];
  hoverable?: boolean;
  emptyMessage?: string;
}

export function DataTable({
  data,
  columns,
  hoverable = true,
  emptyMessage = "No data found",
}: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig((prevConfig) => {
      if (prevConfig?.field === field) {
        return {
          field,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  const getSortIcon = (field: string) => {
    if (sortConfig?.field !== field) {
      return <FontAwesomeIcon icon={faAngleUp} className="ms-1 opacity-25" />;
    }
    return (
      <FontAwesomeIcon
        icon={sortConfig.direction === "asc" ? faAngleUp : faAngleDown}
        className="ms-1"
      />
    );
  };

  if (data.length === 0) {
    return <div className="text-muted p-3">{emptyMessage}</div>;
  }

  return (
    <table className={`table ${hoverable ? "table-hover" : ""}`}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              onClick={() => handleSort(col)}
              className="cursor-pointer user-select-none"
            >
              {col}
              {getSortIcon(col)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col) => (
              <td key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DataTable;

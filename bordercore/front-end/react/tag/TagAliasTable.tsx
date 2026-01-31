import React, { useState, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { DropDownMenu } from "../common/DropDownMenu";
import type { TagAlias } from "./types";

type SortField = "tag" | "alias";

interface TagAliasTableProps {
  data: TagAlias[];
  onDelete: (uuid: string) => void;
}

export function TagAliasTable({ data, onDelete }: TagAliasTableProps) {
  const [sortField, setSortField] = useState<SortField>("tag");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: string;
      let bVal: string;

      switch (sortField) {
        case "tag":
          aVal = a.tag.name.toLowerCase();
          bVal = b.tag.name.toLowerCase();
          break;
        case "alias":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    let newDirection: "asc" | "desc";
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      newDirection = "asc";
    }
    setSortField(field);
    setSortDirection(newDirection);
  }, [sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  if (data.length === 0) {
    return <div className="text-center">No tag aliases found</div>;
  }

  return (
    <div className="tag-alias-table-container">
      <table className="tag-alias-table">
        <thead>
          <tr>
            <th
              className="cursor-pointer"
              onClick={() => handleSort("tag")}
            >
              Tag{renderSortIcon("tag")}
            </th>
            <th
              className="cursor-pointer"
              onClick={() => handleSort("alias")}
            >
              Alias{renderSortIcon("alias")}
            </th>
            <th className="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((alias) => (
            <tr key={alias.uuid} className="hover-target">
              <td>{alias.tag.name}</td>
              <td>{alias.name}</td>
              <td className="col-action">
                <DropDownMenu
                  showOnHover={true}
                  dropdownSlot={
                    <ul className="dropdown-menu-list">
                      <li>
                        <a
                          href="#"
                          className="dropdown-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            onDelete(alias.uuid);
                          }}
                        >
                          <span className="dropdown-menu-icon">
                            <FontAwesomeIcon icon={faTrashAlt} className="text-primary" />
                          </span>
                          <span className="dropdown-menu-text">Delete</span>
                        </a>
                      </li>
                    </ul>
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TagAliasTable;

import React from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPencilAlt,
  faTrashAlt,
  faCheck,
  faExclamationTriangle,
  faEllipsisV,
  faCalendarAlt,
  faClock,
  faHistory,
  faRedo,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import MarkdownIt from "markdown-it";
import { useBootstrapTable } from "../common/useBootstrapTable";

// Initialize markdown-it renderer (matching Vue bundle configuration)
const markdown = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export interface Reminder {
  uuid: string;
  name: string;
  note: string;
  is_active: boolean;
  // New schedule fields
  schedule_type: string;
  schedule_description: string;
  // Legacy fields (for backward compatibility)
  interval_value: number;
  interval_unit_display: string;
  // Timestamps
  next_trigger_at: string | null;
  next_trigger_at_unix: number | null;
  // URLs
  detail_url: string;
  update_url: string;
  delete_url: string;
}

interface RemindersTableProps {
  data: Reminder[];
}

const columnHelper = createColumnHelper<Reminder>();

// Map schedule types to appropriate icons
function getScheduleIcon(scheduleType: string): any {
  const type = scheduleType.toLowerCase();
  if (type === "daily") return faClock;
  if (type === "weekly") return faSync;
  if (type === "monthly") return faCalendarAlt;
  return faRedo; // default
}

export function RemindersTable({ data }: RemindersTableProps) {
  const columns = React.useMemo<ColumnDef<Reminder>[]>(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const reminder = info.row.original;
          const notePreview = reminder.note
            ? reminder.note.split(" ").slice(0, 12).join(" ")
            : null;
          return (
            <div className="reminder-name">
              <a href={reminder.detail_url} className="reminder-name-main">
                {reminder.name}
              </a>
              {notePreview && (
                <span
                  className="reminder-name-note markdown"
                  dangerouslySetInnerHTML={{ __html: markdown.render(notePreview) }}
                />
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("schedule_description", {
        header: "Schedule",
        cell: (info) => {
          const reminder = info.row.original;
          const scheduleIcon = getScheduleIcon(reminder.schedule_type);
          return (
            <div className="reminder-schedule-badge">
              <FontAwesomeIcon icon={scheduleIcon} className="schedule-icon" />
              {reminder.schedule_description}
            </div>
          );
        },
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        cell: (info) => {
          const reminder = info.row.original;
          const currentTime = Math.floor(Date.now() / 1000);
          const isReady =
            reminder.next_trigger_at_unix &&
            reminder.next_trigger_at_unix <= currentTime;

          if (reminder.is_active) {
            if (isReady) {
              return (
                <div className="reminder-status-badge status-ready">
                  <span className="status-dot"></span>
                  Ready
                </div>
              );
            }
            return (
              <div className="reminder-status-badge status-active">
                <span className="status-dot"></span>
                Active
              </div>
            );
          }
          return (
            <div className="reminder-status-badge status-inactive">
              <span className="status-dot"></span>
              Inactive
            </div>
          );
        },
      }),
      columnHelper.accessor("next_trigger_at", {
        header: "Next Trigger",
        cell: (info) => {
          const reminder = info.row.original;

          if (reminder.next_trigger_at) {
            return (
              <div className="reminder-next-trigger">
                <FontAwesomeIcon icon={faCalendarAlt} className="trigger-icon" />
                <span className="trigger-date">{reminder.next_trigger_at}</span>
              </div>
            );
          }
          return <span className="text-muted">—</span>;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-end">Actions</div>,
        cell: (info) => {
          const reminder = info.row.original;
          return (
            <div className="text-end">
              <div className="dropdown">
                <button
                  className="reminder-actions-button"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-label="Actions"
                >
                  <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <a className="dropdown-item" href={reminder.detail_url}>
                      <FontAwesomeIcon icon={faEye} className="text-primary me-3" fixedWidth />
                      View
                    </a>
                  </li>
                  <li>
                    <a className="dropdown-item" href={reminder.update_url}>
                      <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" fixedWidth />
                      Edit
                    </a>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a className="dropdown-item text-danger" href={reminder.delete_url}>
                      <FontAwesomeIcon icon={faTrashAlt} className="text-primary me-3" fixedWidth />
                      Delete
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          );
        },
      }),
    ],
    []
  );

  const { table } = useBootstrapTable({
    data,
    columns,
    enableSorting: true,
    enablePagination: false,
  });

  if (data.length === 0) {
    return (
      <div className="reminders-empty-state" role="alert">
        <h5>No reminders yet.</h5>
        <p>Create your first reminder to get started.</p>
      </div>
    );
  }

  return (
    <div className="reminders-table-container">
      <div className="overflow-x-auto">
        <table className="reminders-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={canSort ? "cursor-pointer" : ""}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div>
                          {typeof header.column.columnDef.header === "function"
                            ? header.column.columnDef.header({
                                column: header.column,
                                header: header,
                                table: table,
                              } as any)
                            : header.column.columnDef.header}
                          {isSorted === "asc" && " ↑"}
                          {isSorted === "desc" && " ↓"}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {typeof cell.column.columnDef.cell === "function"
                      ? cell.column.columnDef.cell({
                          cell: cell,
                          column: cell.column,
                          row: row,
                          table: table,
                          getValue: cell.getValue,
                          renderValue: cell.renderValue,
                        } as any)
                      : cell.getValue()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RemindersTable;

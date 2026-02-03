import React, { useState, useEffect, useRef, useCallback } from "react";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { DataTable } from "./DataTable";
import { SqlEditor } from "../common/SqlEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileImport } from "@fortawesome/free-solid-svg-icons";
import { doGet } from "../utils/reactUtils";
import type { TableInfo, SqlOutput } from "./types";

interface SqlPlaygroundPageProps {
  sqlDbUrl?: string;
}

// Note: db.exec() calls below are SQLite WASM API methods, not Node.js child_process
export function SqlPlaygroundPage({ sqlDbUrl }: SqlPlaygroundPageProps) {
  const [tables, setTables] = useState<Record<string, TableInfo>>({});
  const [sql, setSql] = useState("");
  const [output, setOutput] = useState<SqlOutput>({ cols: [], data: [] });
  const [showOutput, setShowOutput] = useState(false);
  const [error, setError] = useState("");

  const sqlite3Ref = useRef<any>(null);
  const dbRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const log = useCallback((...args: any[]) => console.log(...args), []);
  const logError = useCallback((...args: any[]) => console.error(...args), []);

  const populateDatabaseSchema = useCallback(() => {
    if (!dbRef.current) return;

    const newTables: Record<string, TableInfo> = {};

    // SQLite WASM API - executes SQL query against in-memory database
    dbRef.current.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      callback: (rowTable: any[]) => {
        const tableName = rowTable[0];
        if (!tableName.endsWith("_sequence")) {
          newTables[tableName] = { cols: [], data: [] };

          dbRef.current.exec({
            sql: `PRAGMA table_info(${tableName})`,
            callback: (rowCol: any[]) => {
              newTables[tableName].cols.push(rowCol[1]);
            },
          });
        }
      },
    });

    setTables(newTables);
  }, []);

  const getTableData = useCallback(() => {
    if (!dbRef.current) return;

    setTables(prevTables => {
      const updatedTables = { ...prevTables };

      for (const tableName in updatedTables) {
        updatedTables[tableName].data = [];

        // SQLite WASM API - executes SQL query against in-memory database
        dbRef.current.exec({
          sql: `SELECT * FROM ${tableName} ORDER BY ${updatedTables[tableName].cols.join(",")}`,
          callback: (row: any[], stmt: any) => {
            const newRow: Record<string, any> = {};
            const columns = stmt.getColumnNames();
            for (let i = 0; i < columns.length; i++) {
              newRow[columns[i]] = row[i];
            }
            updatedTables[tableName].data.push(newRow);
          },
        });
      }

      return updatedTables;
    });
  }, []);

  const loadDatabase = useCallback(
    (data: ArrayBuffer) => {
      if (!sqlite3Ref.current || !dbRef.current) return;

      const uint8ArrayData = new Int8Array(data);
      const p = sqlite3Ref.current.wasm.allocFromTypedArray(uint8ArrayData);
      const rc = sqlite3Ref.current.capi.sqlite3_deserialize(
        dbRef.current.pointer,
        "main",
        p,
        data.byteLength,
        data.byteLength,
        sqlite3Ref.current.capi.SQLITE_DESERIALIZE_RESIZEABLE
      );
      dbRef.current.checkRc(rc);
      populateDatabaseSchema();
      getTableData();
    },
    [populateDatabaseSchema, getTableData]
  );

  const createDatabase = useCallback(async () => {
    try {
      const sqlite3 = await sqlite3InitModule({
        print: log,
        printErr: logError,
        locateFile: () => "/static/sqlite3.wasm",
      });

      sqlite3Ref.current = sqlite3;
      dbRef.current = new sqlite3.oo1.DB("/mydb.sqlite3", "c");

      if (sqlDbUrl) {
        doGet(
          sqlDbUrl,
          response => {
            loadDatabase(response.data);
          },
          "Error getting database",
          "arraybuffer"
        );
      }
    } catch (err: any) {
      logError(err.name, err.message);
    }
  }, [sqlDbUrl, loadDatabase, log, logError]);

  useEffect(() => {
    createDatabase();
  }, [createDatabase]);

  const handleRunSQL = () => {
    if (!dbRef.current) return;

    setError("");
    setOutput({ cols: [], data: [] });

    try {
      const newOutput: SqlOutput = { cols: [], data: [] };

      // SQLite WASM API - executes user SQL query against in-memory database
      dbRef.current.exec({
        sql: sql,
        callback: (row: any[], stmt: any) => {
          setShowOutput(true);
          const newRow: Record<string, any> = {};
          const columns = stmt.getColumnNames();
          for (let i = 0; i < columns.length; i++) {
            newRow[columns[i]] = row[i];
          }
          newOutput.cols = columns;
          newOutput.data.push(newRow);
        },
      });

      setOutput(newOutput);

      // Refresh table data after running SQL (in case of INSERT/UPDATE/DELETE)
      populateDatabaseSchema();
      getTableData();
    } catch (err: any) {
      setError(String(err));
      console.log(`Error: ${err}`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && event.ctrlKey) {
      handleRunSQL();
    }
  };

  const handleImportDB = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", function () {
      const arrayBuffer = this.result as ArrayBuffer;
      loadDatabase(arrayBuffer);
      // Reset the file input so that the "change" event will fire again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="sql-playground p-3">
      <div className="d-flex flex-wrap mb-gutter">
        {Object.entries(tables).map(([tableName, tableInfo]) => (
          <div key={tableName} className="w-100">
            <Card title={`Table: ${tableName}`}>
              <DataTable data={tableInfo.data} columns={tableInfo.cols} hoverable />
            </Card>
          </div>
        ))}

        {Object.keys(tables).length === 0 && (
          <div className="w-100">
            <Card title="">
              <div>No tables found</div>
            </Card>
          </div>
        )}
      </div>

      <Card
        className="hover-target"
        cardClassName="mb-gutter"
        titleSlot={
          <div className="d-flex">
            <div className="card-title">SQL</div>
            <div className="dropdown-menu-container ms-auto">
              <DropDownMenu
                dropdownSlot={
                  <ul className="dropdown-menu-list">
                    <li>
                      <a
                        className="dropdown-item"
                        href="#"
                        onClick={e => {
                          e.preventDefault();
                          handleImportDB();
                        }}
                      >
                        <FontAwesomeIcon icon={faFileImport} className="text-primary me-3" />
                        Import DB
                      </a>
                    </li>
                  </ul>
                }
              />
            </div>
          </div>
        }
      >
        <SqlEditor
          value={sql}
          onChange={setSql}
          className="mt-2 w-100"
          rows={3}
          placeholder="Your SQL Here..."
          onKeyDown={handleKeyDown}
        />
        <input className="btn btn-primary" type="button" value="Run" onClick={handleRunSQL} />
        <input type="file" ref={fileInputRef} className="d-none" onChange={handleFileChange} />
      </Card>

      {error && (
        <Card title="Error">
          <div className="text-danger">{error}</div>
        </Card>
      )}

      {showOutput && (
        <Card title="Output">
          <DataTable
            data={output.data}
            columns={output.cols}
            hoverable
            emptyMessage="No data found"
          />
        </Card>
      )}
    </div>
  );
}

export default SqlPlaygroundPage;

import React, { useState } from "react";
import ToggleSwitch from "../common/ToggleSwitch";

interface FileUploadFieldProps {
  name: string;
  label: string;
  initialFilename: string;
  deleteName: string;
}

export function FileUploadField({
  name,
  label,
  initialFilename,
  deleteName,
}: FileUploadFieldProps) {
  const [filename, setFilename] = useState(initialFilename);
  const [deleteChecked, setDeleteChecked] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFilename(e.target.files[0].name);
    }
  };

  return (
    <>
      <div className="row mb-3">
        <label className="fw-bold col-lg-3 col-form-label text-end">{label}</label>
        <div className="col-lg-7">
          <div className="input-group">
            <input
              type="text"
              name={name}
              value={filename}
              className="form-control"
              id={`id_${name}`}
              autoComplete="off"
              readOnly
            />
            <span className="input-group-append">
              <label className="btn btn-primary">
                Choose image
                <input
                  type="file"
                  name={`${name}_file`}
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </span>
          </div>
        </div>
      </div>

      {filename && (
        <div className="row form-inline mb-3">
          <div className="col-lg-3 offset-lg-3">
            <div className="form-check d-flex align-items-center ps-0">
              <ToggleSwitch name={deleteName} checked={deleteChecked} onChange={setDeleteChecked} />
              <label className="form-check-label fw-bold ms-2">Delete</label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FileUploadField;

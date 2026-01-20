import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import { Modal } from "bootstrap";
import type { ObjectTag, SlideShowConfig } from "./types";

export interface SlideShowModalHandle {
  openModal: () => void;
}

interface SlideShowModalProps {
  objectTags: ObjectTag[];
  onStart: (config: SlideShowConfig) => void;
}

const slideShowOptions = [
  { value: "1", display: "Rotate Every Minute" },
  { value: "5", display: "Rotate Every 5 Minutes" },
  { value: "10", display: "Rotate Every 10 Minutes" },
  { value: "30", display: "Rotate Every 30 Minutes" },
  { value: "60", display: "Rotate Every Hour" },
  { value: "1440", display: "Rotate Every Day" },
];

export const SlideShowModal = forwardRef<SlideShowModalHandle, SlideShowModalProps>(
  function SlideShowModal({ objectTags, onStart }, ref) {
    const [type, setType] = useState<"manual" | "automatic">("manual");
    const [interval, setInterval] = useState("60");
    const [randomize, setRandomize] = useState(false);
    const [tag, setTag] = useState("");

    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstanceRef = useRef<Modal | null>(null);

    useImperativeHandle(ref, () => ({
      openModal: () => {
        setTag("");
        if (modalRef.current) {
          modalInstanceRef.current = new Modal(modalRef.current);
          modalInstanceRef.current.show();
        }
      },
    }));

    const handleConfirm = () => {
      if (modalInstanceRef.current) {
        modalInstanceRef.current.hide();
      }
      onStart({
        type,
        interval,
        randomize,
        tag,
      });
    };

    return (
      <div
        ref={modalRef}
        id="modalSlideShow"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="slideShowModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="slideShowModalLabel">
                Begin Slide Show
              </h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="collection-slide-show-section">
                <div className="form-section">Type</div>

                <div className="row mt-3">
                  <div className="col-lg-12">
                    <div className="form-check">
                      <input
                        id="id_type_manual"
                        className="form-check-input"
                        type="radio"
                        name="type"
                        value="manual"
                        checked={type === "manual"}
                        onChange={() => setType("manual")}
                      />
                      <label className="form-check-label d-flex" htmlFor="id_type_manual">
                        Manual
                      </label>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="col-lg-4">
                    <div className="form-check">
                      <input
                        id="id_type_automatic"
                        className="form-check-input"
                        type="radio"
                        name="type"
                        value="automatic"
                        checked={type === "automatic"}
                        onChange={() => setType("automatic")}
                      />
                      <label className="form-check-label d-flex" htmlFor="id_type_automatic">
                        Automatic
                      </label>
                    </div>
                  </div>
                  <div className="col-lg-8">
                    <div>
                      <select
                        className="form-control form-select"
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                        disabled={type === "manual"}
                      >
                        {slideShowOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.display}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="d-flex ps-1 mt-2">
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="randomize-switch"
                          checked={randomize}
                          onChange={(e) => setRandomize(e.target.checked)}
                          disabled={type === "manual"}
                        />
                        <label className="form-check-label" htmlFor="randomize-switch">
                          Randomize
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-1" />

              <div className="collection-slide-show-section">
                <div className="form-section">Options</div>

                <div className="row mt-3">
                  <div className="col-lg-4">Tag</div>
                  <div className="col-lg-8">
                    <select
                      id="slideshow-tag"
                      className="form-control form-select"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    >
                      <option value="">All Objects</option>
                      {objectTags.map((t) => (
                        <option key={t.id} value={t.tag}>
                          {t.tag}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer justify-content-end">
              <input
                id="btn-slideshow-action"
                className="btn btn-primary"
                type="button"
                value="Confirm"
                onClick={handleConfirm}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default SlideShowModal;

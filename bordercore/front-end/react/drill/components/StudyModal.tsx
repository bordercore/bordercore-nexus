import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Modal } from "bootstrap";
import TagsInput, { TagsInputHandle } from "../../common/TagsInput";

export interface StudyModalHandle {
  show: () => void;
}

interface Props {
  initialMethod: string;
  startStudySessionUrl: string;
  tagSearchUrl: string;
}

const StudyModal = forwardRef<StudyModalHandle, Props>(function StudyModal(
  { initialMethod, startStudySessionUrl, tagSearchUrl },
  ref
) {
  const [studyMethod, setStudyMethod] = useState(initialMethod);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);
    }
  }, []);

  // Re-sync method state if the parent's active scope changes between opens.
  useEffect(() => {
    setStudyMethod(initialMethod);
  }, [initialMethod]);

  useImperativeHandle(ref, () => ({
    show: () => modalInstanceRef.current?.show(),
  }));

  return (
    <div
      ref={modalRef}
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="studyModalLabel"
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 id="studyModalLabel" className="modal-title">
              Start Study Session
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <form action={startStudySessionUrl}>
              <h5>
                Choose your study method
                <hr />
              </h5>

              {/* All */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_all"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="all"
                  checked={studyMethod === "all"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label className="form-check-label ms-2" htmlFor="id_studymethod_all">
                  All questions
                </label>
              </div>

              {/* Favorites */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_favorites"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="favorites"
                  checked={studyMethod === "favorites"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label className="form-check-label ms-2" htmlFor="id_studymethod_favorites">
                  Favorite questions
                </label>
              </div>

              {/* Recent */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_recent"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="recent"
                  checked={studyMethod === "recent"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label
                  className="form-check-label ms-2 d-flex align-items-center"
                  htmlFor="id_studymethod_recent"
                >
                  <div className="text-nowrap me-3">Recent questions</div>
                  <select
                    name="interval"
                    className="form-control form-select"
                    disabled={studyMethod !== "recent"}
                  >
                    <option value="1">Past Day</option>
                    <option value="3">Past 3 Days</option>
                    <option value="7">Past Week</option>
                    <option value="14">Past Two Weeks</option>
                    <option value="21">Past Three Weeks</option>
                    <option value="30">Past Month</option>
                    <option value="60">Past Two Months</option>
                    <option value="90">Past Three Months</option>
                  </select>
                </label>
              </div>

              {/* Tag */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_tag"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="tag"
                  checked={studyMethod === "tag"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label
                  className="form-check-label ms-2 d-flex align-items-center"
                  htmlFor="id_studymethod_tag"
                >
                  <div className="me-4">Tag</div>
                </label>
                <TagsInput
                  ref={tagsInputRef}
                  searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                  name="tags"
                  id="study-modal-tags"
                  placeholder="Tag name"
                  disabled={studyMethod !== "tag"}
                />
              </div>

              {/* Random */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_random"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="random"
                  checked={studyMethod === "random"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label
                  className="form-check-label ms-2 d-flex align-items-center"
                  htmlFor="id_studymethod_random"
                >
                  <div className="text-nowrap me-3">Random questions, count of</div>
                  <select
                    name="count"
                    className="form-control form-select"
                    disabled={studyMethod !== "random"}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="100">100</option>
                  </select>
                </label>
              </div>

              {/* Keyword */}
              <div className="form-check d-flex align-items-center mt-3">
                <input
                  id="id_studymethod_keyword"
                  name="study_method"
                  className="form-check-input"
                  type="radio"
                  value="keyword"
                  checked={studyMethod === "keyword"}
                  onChange={e => setStudyMethod(e.target.value)}
                />
                <label
                  className="form-check-label ms-2 d-flex align-items-center"
                  htmlFor="id_studymethod_keyword"
                >
                  <div className="me-3">Questions matching keyword</div>
                  <input
                    className="form-control"
                    name="keyword"
                    id="study-modal-keyword"
                    placeholder="Keyword"
                    autoComplete="off"
                    disabled={studyMethod !== "keyword"}
                  />
                </label>
              </div>

              <hr />

              {/* Filter */}
              <div className="d-flex align-items-center my-3">
                <div className="me-3">Filter</div>
                <select name="filter" className="form-control form-select">
                  <option value="review">Questions needing review</option>
                  <option value="all">All questions</option>
                </select>
              </div>

              <input type="submit" className="btn btn-primary mt-2" value="Study" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StudyModal;

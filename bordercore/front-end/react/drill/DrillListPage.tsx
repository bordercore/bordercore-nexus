import React, { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DrillTagProgress from "../homepage/DrillTagProgress";
import DrillPinnedTags from "./DrillPinnedTags";
import DrillDisabledTags from "./DrillDisabledTags";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
import TagsInput, { TagsInputHandle } from "../common/TagsInput";

interface TagLastReviewed {
  name: string;
  last_reviewed: string | null;
}

interface FeaturedTagInfo {
  name: string;
  url: string;
  last_reviewed: string;
  count: number;
  progress: number;
}

interface StudySession {
  type: string;
  tag?: string;
  list: string[];
}

interface DrillListPageProps {
  title: string;
  studySession: StudySession | null;
  studySessionProgress: number;
  totalProgress: { count: number; percentage: number };
  favoriteQuestionsProgress: { count: number; percentage: number };
  tagsLastReviewed: TagLastReviewed[];
  initialFeaturedTag: FeaturedTagInfo;
  urls: {
    drillList: string;
    drillAdd: string;
    startStudySession: string;
    resume: string;
    getPinnedTags: string;
    pinTag: string;
    unpinTag: string;
    sortPinnedTags: string;
    getDisabledTags: string;
    disableTag: string;
    enableTag: string;
    tagSearch: string;
  };
}

export function DrillListPage({
  title,
  studySession,
  studySessionProgress,
  totalProgress,
  favoriteQuestionsProgress,
  tagsLastReviewed,
  initialFeaturedTag,
  urls,
}: DrillListPageProps) {
  const [studyMethod, setStudyMethod] = useState("all");
  const [showFeaturedTagInput, setShowFeaturedTagInput] = useState(false);
  const [featuredTag, setFeaturedTag] = useState<FeaturedTagInfo>(initialFeaturedTag);

  const selectValueFeaturedTagRef = useRef<SelectValueHandle>(null);
  const tagsInputRef = useRef<TagsInputHandle>(null);

  const handleTagSearch = useCallback(() => {
    setShowFeaturedTagInput(true);
    setTimeout(() => {
      selectValueFeaturedTagRef.current?.focus();
    }, 500);
  }, []);

  const selectFeaturedTag = useCallback((tagInfo: any) => {
    setShowFeaturedTagInput(false);
    setFeaturedTag(tagInfo.info || tagInfo);
  }, []);

  const getStudySessionDescription = () => {
    if (!studySession) return null;

    switch (studySession.type) {
      case "all":
        return (
          <>Currently studying <strong>all questions</strong>.</>
        );
      case "favorites":
        return (
          <>Currently studying your <strong>favorite questions</strong>.</>
        );
      case "tag":
        const hasMultipleTags = studySession.tag?.includes(",");
        return (
          <>
            Currently studying tag{hasMultipleTags ? "s" : ""}{" "}
            <strong>{studySession.tag}</strong>.
          </>
        );
      case "random":
        return <>Currently studying random questions.</>;
      case "search":
        return (
          <>
            Currently studying questions that match search{" "}
            <strong>{(studySession as any).search_term}</strong>.
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="row g-0 h-100 mx-2">
      {/* Left column - Study controls */}
      <div className="col-lg-3 d-flex flex-column pe-gutter">
        <div className="card">
          <div className="card-body backdrop-filter flex-grow-1">
          <div>
            Click the <strong>Study</strong> button to start a study session or
            select a <strong>tag</strong> on the right to drill on a specific
            category.
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              data-bs-toggle="modal"
              data-bs-target="#modal-study"
            >
              Study
            </button>
          </div>

          {studySession && (
            <>
              <hr />
              <span>
                <a href={urls.resume} type="button" className="btn btn-primary">
                  Resume
                </a>{" "}
                study session.
              </span>
              <div className="text-secondary mt-3">
                <small>
                  {getStudySessionDescription()}
                  <br />
                  <strong>{studySessionProgress}</strong> out of{" "}
                  <strong>{studySession.list.length}</strong> questions completed.
                </small>
              </div>
            </>
          )}

          <hr />

          <div>
            <a href={urls.drillAdd} className="btn btn-primary" role="button">
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              New Question
            </a>
          </div>
          </div>
        </div>
      </div>

      {/* Second column - Progress cards */}
      <div className="col-lg-3 d-flex flex-column pe-gutter">
        <Card title="Total Progress" className="backdrop-filter" cardClassName="mb-gutter">
          <hr className="divider" />
          <div className="d-flex">
            <div className="d-flex justify-content-center align-items-center">
              Percentage of all questions not needing review
            </div>
            <DrillTagProgress
              count={totalProgress.count}
              progress={totalProgress.percentage}
            />
          </div>
        </Card>

        <Card title="Favorites Progress" className="backdrop-filter flex-grow-1">
          <hr className="divider" />
          <div className="d-flex">
            <div className="d-flex justify-content-center align-items-center">
              Percentage of favorite questions not needing review
            </div>
            <DrillTagProgress
              count={favoriteQuestionsProgress.count}
              progress={favoriteQuestionsProgress.percentage}
            />
          </div>
        </Card>
      </div>

      {/* Third column - Tags needing review */}
      <div className="col-lg-3 d-flex flex-column pe-gutter">
        <Card title="Tags needing review" className="backdrop-filter flex-grow-1">
          <hr className="divider" />
          <ul className="list-unstyled">
            <li className="d-flex text-primary px-2 py-1">
              <div className="flex-fill fw-bold">Tag</div>
              <div className="fw-bold">Last Reviewed</div>
            </li>
            <hr className="divider my-1" />
            {tagsLastReviewed.length > 0 ? (
              tagsLastReviewed.map((tag) => (
                <li key={tag.name} className="d-flex px-2">
                  <div className="item-name flex-fill">
                    <a
                      href={`${urls.startStudySession}?study_method=tag&tags=${tag.name}`}
                    >
                      {tag.name}
                    </a>
                  </div>
                  <div className="item-value text-end">
                    {tag.last_reviewed || "Never"}
                  </div>
                </li>
              ))
            ) : (
              <div className="text-success text-center">Nothing to learn</div>
            )}
          </ul>
        </Card>
      </div>

      {/* Fourth column - Pinned and Disabled tags */}
      <div className="col-lg-3 d-flex flex-column">
        <DrillPinnedTags
          getPinnedTagsUrl={urls.getPinnedTags}
          pinTagUrl={urls.pinTag}
          unpinTagUrl={urls.unpinTag}
          sortPinnedTagsUrl={urls.sortPinnedTags}
          tagSearchUrl={urls.tagSearch}
        />

        <Card title="" className="backdrop-filter" cardClassName="mb-gutter">
          <div className="d-flex">
            {showFeaturedTagInput ? (
              <div className="me-3 mb-0">
                <SelectValue
                  ref={selectValueFeaturedTagRef}
                  searchUrl={`${urls.tagSearch}?doctype=drill&query=`}
                  placeHolder="Tag"
                  onSelect={selectFeaturedTag}
                />
              </div>
            ) : (
              <h5 className="lh-base mb-0">
                <span className="card-title">Featured Tag:</span>{" "}
                <a href={featuredTag.url}>{featuredTag.name}</a>
              </h5>
            )}
            <div className="ms-auto cursor-pointer" onClick={handleTagSearch}>
              <FontAwesomeIcon icon={faMagnifyingGlass} className="glow text-emphasis" />
            </div>
          </div>

          <hr className="divider" />
          <div className="d-flex">
            <div className="flex-grow-1 d-flex justify-content-center align-items-center">
              <ul className="list-unstyled">
                <li>
                  Last Reviewed <br /> <strong>{featuredTag.last_reviewed}</strong>
                </li>
              </ul>
            </div>
            <DrillTagProgress
              count={featuredTag.count}
              progress={featuredTag.progress}
            />
          </div>
        </Card>

        <DrillDisabledTags
          getDisabledTagsUrl={urls.getDisabledTags}
          disableTagUrl={urls.disableTag}
          enableTagUrl={urls.enableTag}
          tagSearchUrl={urls.tagSearch}
        />
      </div>

      {/* Study Session Modal */}
      <div
        className="modal fade"
        id="modal-study"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="myModalLabel">
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
              <form action={urls.startStudySession}>
                <h5>
                  Choose your study method
                  <hr />
                </h5>

                {/* All questions */}
                <div className="form-check d-flex align-items-center mt-3">
                  <input
                    id="id_studymethod_all"
                    name="study_method"
                    className="form-check-input"
                    type="radio"
                    value="all"
                    checked={studyMethod === "all"}
                    onChange={(e) => setStudyMethod(e.target.value)}
                  />
                  <label className="form-check-label ms-2" htmlFor="id_studymethod_all">
                    All questions
                  </label>
                </div>

                {/* Favorite questions */}
                <div className="form-check d-flex align-items-center mt-3">
                  <input
                    id="id_studymethod_favorites"
                    name="study_method"
                    className="form-check-input"
                    type="radio"
                    value="favorites"
                    checked={studyMethod === "favorites"}
                    onChange={(e) => setStudyMethod(e.target.value)}
                  />
                  <label className="form-check-label ms-2" htmlFor="id_studymethod_favorites">
                    Favorite questions
                  </label>
                </div>

                {/* Recent questions */}
                <div className="form-check d-flex align-items-center mt-3">
                  <input
                    id="id_studymethod_recent"
                    name="study_method"
                    className="form-check-input"
                    type="radio"
                    value="recent"
                    checked={studyMethod === "recent"}
                    onChange={(e) => setStudyMethod(e.target.value)}
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
                    onChange={(e) => setStudyMethod(e.target.value)}
                  />
                  <label
                    className="form-check-label ms-2 d-flex align-items-center"
                    htmlFor="id_studymethod_tag"
                  >
                    <div className="me-4">Tag</div>
                  </label>
                  <TagsInput
                    ref={tagsInputRef}
                    searchUrl={`${urls.tagSearch}?doctype=drill&query=`}
                    name="tags"
                    id="tag-name"
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
                    onChange={(e) => setStudyMethod(e.target.value)}
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
                    onChange={(e) => setStudyMethod(e.target.value)}
                  />
                  <label
                    className="form-check-label ms-2 d-flex align-items-center"
                    htmlFor="id_studymethod_keyword"
                  >
                    <div className="me-3">Questions matching keyword</div>
                    <input
                      className="form-control"
                      name="keyword"
                      id="search-term"
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
    </div>
  );
}

export default DrillListPage;

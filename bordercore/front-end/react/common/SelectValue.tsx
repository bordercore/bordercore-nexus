import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faAngleDown, faHeart } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { boldenOption } from "../../util.js";

interface Option {
  [key: string]: any;
  label?: string;
  name?: string;
  link?: string;
  splitter?: boolean;
  important?: number;
  doctype?: string;
}

interface SelectValueProps {
  id?: string;
  label?: string;
  placeHolder?: string;
  searchUrl?: string;
  initialValue?: Option;
  minLength?: number;
  optionsLimit?: number;
  searchIcon?: boolean;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onSearch?: (selection: Option) => void;
  onSearchChange?: (query: string) => void;
  onSelect?: (selection: Option) => void;
  optionSlot?: (props: { option: Option; search: string }) => React.ReactNode;
}

export interface SelectValueHandle {
  focus: () => void;
  search: string;
}

export const SelectValue = forwardRef<SelectValueHandle, SelectValueProps>(function SelectValue({
  id,
  label = "label",
  placeHolder = "Search",
  searchUrl = "",
  initialValue,
  minLength = 2,
  optionsLimit = 20,
  searchIcon = false,
  onKeyDown,
  onSearch,
  onSearchChange,
  onSelect,
  optionSlot,
}: SelectValueProps, ref) {
  const [value, setValue] = useState<Option | null>(initialValue || null);
  const [options, setOptions] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selectable options (excluding splitters)
  const getSelectableOptions = () => {
    return options.filter((option) => !option.splitter);
  };

  const handleSearchChange = async (query: string) => {
    setSearch(query);
    onSearchChange?.(query);

    if (query.length < minLength) {
      setOptions([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`${searchUrl}${query}`);
      const results = Array.isArray(response.data) ? response.data : [];
      setOptions(results.slice(0, optionsLimit));
      setIsOpen(results.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Search error:", error);
      setOptions([]);
      setIsOpen(false);
      setHighlightedIndex(-1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (option: Option) => {
    setValue(option);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
    onSelect?.(option);
    // Only call onSearch for term searches (when there's no link)
    if (!option.link) {
      onSearch?.(option);
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    search: search,
  }));

  const handleKeyboardNavigation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const selectableOptions = getSelectableOptions();
    if (selectableOptions.length === 0) {
      onKeyDown?.(e);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = highlightedIndex < selectableOptions.length - 1 ? highlightedIndex + 1 : 0;
      setHighlightedIndex(newIndex);
      setIsOpen(true);
      // Scroll highlighted item into view
      setTimeout(() => {
        const highlightedElement = dropdownRef.current?.querySelector(`[data-option-index="${newIndex}"]`) as HTMLElement;
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : selectableOptions.length - 1;
      setHighlightedIndex(newIndex);
      setIsOpen(true);
      // Scroll highlighted item into view
      setTimeout(() => {
        const highlightedElement = dropdownRef.current?.querySelector(`[data-option-index="${newIndex}"]`) as HTMLElement;
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < selectableOptions.length) {
        handleSelect(selectableOptions[highlightedIndex]);
      } else if (value) {
        onSearch?.(value);
      }
    } else {
      onKeyDown?.(e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`select-value-wrapper ${searchIcon ? "has-search" : ""}`} style={{ position: "relative" }}>
      {searchIcon && <FontAwesomeIcon icon={faSearch} />}
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        placeholder={placeHolder}
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        onFocus={() => search.length >= minLength && setIsOpen(true)}
        onKeyDown={handleKeyboardNavigation}
      />
      {isOpen && options.length > 0 && (() => {
        const selectableOptions = getSelectableOptions();
        let selectableIndex = -1;

        return (
          <div ref={dropdownRef} className="dropdown-menu show" style={{ display: "block", width: "100%" }}>
            {options.map((option, index) => {
              if (!option.splitter) {
                selectableIndex++;
              }
              const isHighlighted = !option.splitter && selectableIndex === highlightedIndex;

              return (
                <div key={index}>
                  {optionSlot ? (
                    <div
                      data-option-index={option.splitter ? -1 : selectableIndex}
                      className={isHighlighted ? "highlighted" : ""}
                      onClick={(e) => {
                        if (!option.splitter) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(option);
                        }
                      }}
                      style={option.splitter ? {} : { cursor: "pointer" }}
                    >
                      {optionSlot({ option, search })}
                    </div>
                  ) : option.splitter ? (
                    <div className="search-splitter">{option[label] || option.name}</div>
                  ) : (
                    <div
                      data-option-index={selectableIndex}
                      className={`search-suggestion dropdown-item ${isHighlighted ? "highlighted" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelect(option);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {option.important === 10 && (
                        <FontAwesomeIcon icon={faHeart} className="text-danger me-1" />
                      )}
                      {option.doctype && (
                        <em className="top-search-object-type">{option.doctype} - </em>
                      )}
                      <span dangerouslySetInnerHTML={{ __html: boldenOption(option[label] || option.name || "", search) }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      {id && <input id={id} type="hidden" name="search" value={value?.[label] || search} />}
    </div>
  );
});

export default SelectValue;


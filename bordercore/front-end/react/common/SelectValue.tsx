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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = async (query: string) => {
    setSearch(query);
    onSearchChange?.(query);

    if (query.length < minLength) {
      setOptions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`${searchUrl}${query}`);
      const results = Array.isArray(response.data) ? response.data : [];
      setOptions(results.slice(0, optionsLimit));
      setIsOpen(results.length > 0);
    } catch (error) {
      console.error("Search error:", error);
      setOptions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (option: Option) => {
    setValue(option);
    setIsOpen(false);
    setSearch("");
    onSelect?.(option);
    if (option.link) {
      onSearch?.(option);
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    search: search,
  }));

  useEffect(() => {
    if (inputRef.current) {
      const input = inputRef.current;
      const handleKeyDown = (e: KeyboardEvent) => {
        onKeyDown?.(e as any);
        if (e.key === "Enter" && value) {
          onSearch?.(value);
        }
      };
      input.addEventListener("keydown", handleKeyDown);
      return () => input.removeEventListener("keydown", handleKeyDown);
    }
  }, [value, onKeyDown, onSearch]);

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
      />
      {isOpen && options.length > 0 && (
        <div className="dropdown-menu show" style={{ display: "block", width: "100%" }}>
          {options.map((option, index) => (
            <div key={index}>
              {optionSlot ? (
                optionSlot({ option, search })
              ) : option.splitter ? (
                <div className="search-splitter">{option[label] || option.name}</div>
              ) : (
                <div
                  className="search-suggestion dropdown-item"
                  onClick={() => handleSelect(option)}
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
          ))}
        </div>
      )}
      {id && <input id={id} type="hidden" name="search" value={value?.[label] || search} />}
    </div>
  );
});

export default SelectValue;


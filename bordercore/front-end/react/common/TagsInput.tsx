import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import AsyncCreatableSelect from "react-select/async-creatable";
import type { MultiValue, ActionMeta } from "react-select";
import axios from "axios";

interface TagOption {
  label: string;
  value: string;
}

interface TagsInputProps {
  id?: string;
  name?: string;
  searchUrl?: string;
  initialTags?: string[];
  placeholder?: string;
  minLength?: number;
  optionsLimit?: number;
  disabled?: boolean;
  maxTags?: number;
  onTagsChanged?: (tags: string[]) => void;
  onBlur?: () => void;
}

export interface TagsInputHandle {
  addTag: (tagName: string) => void;
  clearOptions: () => void;
  focus: () => void;
  setTagList: (tagList: string[]) => void;
  getTags: () => string[];
}

export const TagsInput = forwardRef<TagsInputHandle, TagsInputProps>(function TagsInput(
  {
    id,
    name = "tags",
    searchUrl = "",
    initialTags = [],
    placeholder = "",
    minLength = 2,
    optionsLimit = 20,
    disabled = false,
    maxTags,
    onTagsChanged,
    onBlur,
  },
  ref
) {
  const [selectedTags, setSelectedTags] = useState<TagOption[]>(
    initialTags.map(t => ({ label: t, value: t }))
  );

  const selectRef = useRef<any>(null);

  // Sync selectedTags when initialTags prop changes
  // Use JSON.stringify to compare by value, not reference
  const initialTagsJson = JSON.stringify(initialTags);
  useEffect(() => {
    const tags = JSON.parse(initialTagsJson) as string[];
    setSelectedTags(tags.map(t => ({ label: t, value: t })));
  }, [initialTagsJson]);

  // Computed: comma-separated tags for hidden input
  const tagsCommaSeparated = selectedTags.map(t => t.label).join(",");

  const focus = useCallback(() => {
    selectRef.current?.focus();
  }, []);

  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed) return;

      // Check if tag already exists
      if (selectedTags.some(t => t.label.toLowerCase() === trimmed.toLowerCase())) {
        return;
      }

      // Check max tags limit
      if (maxTags && selectedTags.length >= maxTags) {
        return;
      }

      const newTag = { label: trimmed, value: trimmed };
      const newTags = [...selectedTags, newTag];
      setSelectedTags(newTags);
      onTagsChanged?.(newTags.map(t => t.label));
    },
    [selectedTags, maxTags, onTagsChanged]
  );

  const clearOptions = useCallback(() => {
    setSelectedTags([]);
    onTagsChanged?.([]);
  }, [onTagsChanged]);

  const setTagList = useCallback((tagList: string[]) => {
    const newTags = tagList.map(t => ({ label: t, value: t }));
    setSelectedTags(newTags);
  }, []);

  const getTags = useCallback(() => {
    return selectedTags.map(t => t.label);
  }, [selectedTags]);

  useImperativeHandle(
    ref,
    () => ({
      addTag,
      clearOptions,
      focus,
      setTagList,
      getTags,
    }),
    [addTag, clearOptions, focus, setTagList, getTags]
  );

  // Async load options from API
  const loadOptions = useCallback(
    async (inputValue: string): Promise<TagOption[]> => {
      if (inputValue.length < minLength) {
        return [];
      }

      try {
        const response = await axios.get(`${searchUrl}${encodeURIComponent(inputValue)}`);
        const results = Array.isArray(response.data) ? response.data : [];
        return results.slice(0, optionsLimit).map((item: any) => {
          const label = item.label || item.name || item;
          return { label, value: label };
        });
      } catch (error) {
        console.error("TagsInput search error:", error);
        return [];
      }
    },
    [searchUrl, minLength, optionsLimit]
  );

  const handleChange = useCallback(
    (newValue: MultiValue<TagOption>, _actionMeta: ActionMeta<TagOption>) => {
      const tags = newValue as TagOption[];
      setSelectedTags(tags);
      onTagsChanged?.(tags.map(t => t.label));
    },
    [onTagsChanged]
  );

  const handleCreateOption = useCallback(
    (inputValue: string) => {
      addTag(inputValue);
    },
    [addTag]
  );

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Check if we can add more tags
  const isSearchable = !maxTags || selectedTags.length < maxTags;

  return (
    <div className="tags-input-wrapper w-100" id={id}>
      <AsyncCreatableSelect
        ref={selectRef}
        isMulti
        cacheOptions
        defaultOptions={false}
        loadOptions={loadOptions}
        value={selectedTags}
        onChange={handleChange}
        onCreateOption={handleCreateOption}
        onBlur={handleBlur}
        isDisabled={disabled}
        isSearchable={isSearchable}
        placeholder={placeholder}
        noOptionsMessage={({ inputValue }) =>
          inputValue.length < minLength
            ? `Type at least ${minLength} characters to search`
            : "No options found"
        }
        formatCreateLabel={inputValue => `Create "${inputValue}"`}
        classNamePrefix="react-select"
        className="react-select-container"
      />
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={tagsCommaSeparated} />
    </div>
  );
});

export default TagsInput;

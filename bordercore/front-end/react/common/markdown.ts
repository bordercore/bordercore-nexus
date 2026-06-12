import MarkdownIt from "markdown-it";
import markdownItSup from "markdown-it-sup";

/**
 * Create a markdown-it instance with the site-wide plugin set applied
 * (currently superscript: `^text^` renders as <sup>text</sup>).
 *
 * Accepts the same options object as the MarkdownIt constructor, so each
 * caller keeps its own configuration (html, linkify, highlight, etc.).
 */
export function createMarkdown(options?: MarkdownIt.Options): MarkdownIt {
  return new MarkdownIt(options ?? {}).use(markdownItSup);
}

import React, { useMemo } from "react";
import { Card } from "../common/Card";
import { SearchNoResult } from "../search/SearchNoResult";
import { EventBus } from "../utils/reactUtils";
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  highlight: function (str: string) {
    try {
      return hljs.highlightAuto(str).value;
    } catch {
      return "";
    }
  },
});

export function GalleryPage() {
  // Static code sample for demonstration - not user input, safe to render
  const javascriptSample = `
\`\`\`python
class TagBookmark(SortOrderMixin):

    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    bookmark = models.ForeignKey("bookmark.Bookmark", on_delete=models.CASCADE)

    field_name = "tag"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("tag", "bookmark")
        )

    @receiver(pre_delete, sender=TagBookmark)
    def remove_bookmark(sender, instance, **kwargs):
        instance.handle_delete()
\`\`\`
  `;

  // Render static markdown content - safe as it's hardcoded, not user input
  const renderedMarkdown = useMemo(() => {
    return { __html: markdown.render(javascriptSample) };
  }, []);

  const createToast = (level: string) => {
    EventBus.$emit("toast", {
      body: "This is a sample toast",
      variant: level,
      autoHide: false,
    });
  };

  return (
    <div className="p-3" id="gallery">
      <h1>A gallery of Bordercore content</h1>

      <h4>
        This page contains all of the display elements found throughout Bordercore, useful for
        testing various CSS with both light and dark themes.
      </h4>

      <h4 className="mt-5">Colors</h4>

      <ul id="surfaces" className="list-unstyled">
        <li>--surface1</li>
        <li>--surface2</li>
        <li>--surface3</li>
        <li>--surface4</li>
        <li>--surface5</li>
        <li>--surface6</li>
        <li>--surface7</li>
      </ul>

      <ul id="texts" className="list-unstyled">
        <li>
          <span className="me-3">--text1</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text2</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text3</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text4</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text5</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text6</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
        <li>
          <span className="me-3">--text-disabled</span>
          <span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore
          </span>
        </li>
      </ul>

      <ul className="list-unstyled">
        <li>
          <a href="">Link</a>
        </li>
        <li>
          <span className="me-3">Strong text</span>
          <span>
            <strong>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore
            </strong>
          </span>
        </li>
        <li>
          <span className="me-3">Normal and strong text</span>
          <span>
            Lorem ipsum <strong>dolor sit amet</strong>, consectetur adipiscing elit,{" "}
            <strong>sed do eiusmod tempor</strong> incididunt ut labore
          </span>
        </li>
      </ul>

      <h4 className="mt-5">Code blocks</h4>

      {/* Safe: content is hardcoded static markdown, not user input */}
      <div dangerouslySetInnerHTML={renderedMarkdown} />

      <h4 className="mt-5">Inline code</h4>
      <p>
        This is <code>some inline</code> code.
      </p>

      <h4 className="mt-5">Homepage Cards</h4>

      <div className="row g-0">
        <div className="col-lg-4">
          <Card
            titleSlot={
              <div className="card-title">
                <a href="#">Important Tasks</a>
              </div>
            }
          >
            <ul className="list-group">
              <li className="list-group-item list-group-item-secondary text-primary">
                Get stuff done
                <span className="tag bg-info ms-1">linux</span>
                <span className="tag bg-info">django</span>
              </li>
              <li className="list-group-item list-group-item-secondary text-primary">
                Get more stuff done
                <span className="tag bg-info ms-1">linux</span>
                <span className="tag bg-info">django</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card
            titleSlot={
              <div className="card-title">
                <a href="#">Important Tasks</a>
              </div>
            }
          >
            <ul className="list-group">
              <li className="list-group-item list-group-item-secondary">All done!</li>
            </ul>
          </Card>
        </div>
      </div>

      <h4 className="mt-5">Block Quotes Exported by org-mode markdown files</h4>

      <blockquote>
        <p>
          line 1<br />
          line 2<br />
          line 3
        </p>
      </blockquote>

      <h4 className="mt-5">Breadcrumb Navigation</h4>

      <div className="d-flex mb-3">
        <div className="me-auto align-self-center">
          <ul className="breadcrumb mb-0 pt-0 pb-0">
            <li className="breadcrumb-item">
              <a href="#">Blob Detail</a>
            </li>
            <li className="breadcrumb-item active">Edit Blob</li>
          </ul>
        </div>
      </div>

      <h4 className="mt-5">Alerts</h4>

      <h4 className="mt-5">Toasts</h4>

      <button className="btn btn-primary" onClick={() => createToast("info")}>
        Info Toast
      </button>
      <button className="btn btn-success" onClick={() => createToast("success")}>
        Success Toast
      </button>
      <button className="btn btn-warning" onClick={() => createToast("warning")}>
        Warning Toast
      </button>
      <button className="btn btn-danger" onClick={() => createToast("danger")}>
        Danger Toast
      </button>

      <h4 className="mt-5">Badges</h4>

      <span className="dropdown-item-extra pt-1">1</span>
      <span className="dropdown-item-extra mt-2 mb-2 pt-1">42</span>

      <h4 className="mt-5">Negative Search Results</h4>

      <SearchNoResult>
        <span>
          Search found nothing matching <strong>tag_name</strong>
        </span>
      </SearchNoResult>

      <h4 className="mt-5">Effects</h4>

      <h6>Animated Gradient Box</h6>

      <div className="animated-gradient-box w-50 p-5">
        Lorem ipsum dolor sit amet
        <br />
        Consectetur adipiscing elit
        <br />
        Integer molestie lorem at massa
        <br />
        Facilisis in pretium nisl aliquet
        <br />
        Nulla volutpat aliquam velit
        <br />
        Phasellus iaculis neque
        <br />
        Purus sodales ultricies
        <br />
        Vestibulum laoreet porttitor sem
        <br />
        Ac tristique libero volutpat at
        <br />
        Faucibus porta lacus fringilla vel
        <br />
        Aenean sit amet erat nunc
        <br />
        Eget porttitor lorem
      </div>
    </div>
  );
}

export default GalleryPage;

import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuoteLeft, faPencilAlt, faPlus } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doGet, doPost } from "../utils/reactUtils";
import type { QuoteLayoutItem, QuoteOptions, Quote } from "./types";

interface NodeQuoteProps {
  uuid: string;
  nodeUuid: string;
  quoteOptionsInitial: QuoteOptions;
  getQuoteUrl: string;
  getAndSetQuoteUrl: string;
  removeComponentUrl: string;
  editQuoteUrl: string;
  onOpenQuoteEditModal: (callback: (options: QuoteOptions) => void, data: QuoteOptions) => void;
  onEditLayout: (layout: string) => void;
}

export default function NodeQuote({
  uuid,
  nodeUuid,
  quoteOptionsInitial,
  getQuoteUrl,
  getAndSetQuoteUrl,
  removeComponentUrl,
  editQuoteUrl,
  onOpenQuoteEditModal,
  onEditLayout,
}: NodeQuoteProps) {
  const [hover, setHover] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOptions>(quoteOptionsInitial);
  const rotateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getQuote();

    if (quoteOptions.rotate !== null && quoteOptions.rotate !== -1) {
      setTimer();
    }

    return () => {
      if (rotateIntervalRef.current) {
        clearInterval(rotateIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hover) return;

      switch (e.key.toLowerCase()) {
        case "m":
          setQuoteOptions(prev => ({
            ...prev,
            format: prev.format === "minimal" ? "standard" : "minimal",
          }));
          break;
        case "arrowright":
          getRandomQuote();
          break;
        case "u":
          handleOpenQuoteModal();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hover, quoteOptions]);

  const getQuote = () => {
    doGet(
      getQuoteUrl,
      response => {
        setQuote(response.data);
      },
      "Error getting quote"
    );
  };

  const getRandomQuote = () => {
    doPost(
      getAndSetQuoteUrl,
      {
        node_uuid: nodeUuid,
        favorites_only: quoteOptions.favorites_only ? "true" : "false",
      },
      response => {
        setQuote(response.data.quote);
      }
    );
  };

  const handleQuoteRemove = () => {
    doPost(
      removeComponentUrl,
      {
        node_uuid: nodeUuid,
        uuid: uuid,
      },
      response => {
        onEditLayout(response.data.layout);
      },
      "Quote removed"
    );
  };

  const editQuote = (options: QuoteOptions) => {
    doPost(
      editQuoteUrl,
      {
        node_uuid: nodeUuid,
        uuid: uuid,
        options: JSON.stringify(options),
      },
      response => {
        setQuoteOptions(options);
        setTimer();
        onEditLayout(response.data.layout);
      }
    );
  };

  const handleOpenQuoteModal = () => {
    onOpenQuoteEditModal(editQuote, quoteOptions);
  };

  const setTimer = () => {
    if (!quoteOptions.rotate || quoteOptions.rotate === -1) {
      return;
    }

    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
    }

    rotateIntervalRef.current = setInterval(
      () => {
        getRandomQuote();
      },
      quoteOptions.rotate * 1000 * 60
    );
  };

  const cardClass = `backdrop-filter node-color-${quoteOptions.color}`;

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleOpenQuoteModal();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit quote</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={e => {
            e.preventDefault();
            handleQuoteRemove();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPlus} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Remove quote</span>
        </a>
      </li>
    </ul>
  );

  const titleSlot =
    quoteOptions && quoteOptions.format !== "minimal" ? (
      <>
        <div className="dropdown-height d-flex">
          <div className="card-title d-flex">
            <div>
              <FontAwesomeIcon icon={faQuoteLeft} className="text-primary me-3" />
              Quote
            </div>
          </div>
          <div className="dropdown-menu-container ms-auto">
            <DropDownMenu showOnHover dropdownSlot={dropdownContent} />
          </div>
        </div>
        <hr className="divider" />
      </>
    ) : null;

  return (
    <div
      className="hover-target"
      onMouseOver={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Card cardClassName={cardClass} titleSlot={titleSlot}>
        {quote && (
          <div key={quote.uuid}>
            <div>{quote.quote}</div>
            <div className="text-primary text-smaller">
              <strong>{quote.source}</strong>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

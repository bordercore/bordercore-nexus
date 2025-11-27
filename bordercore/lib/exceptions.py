class DuplicateObjectError(Exception):
    pass


class BookmarkSearchDeleteError(Exception):
    """Raised when a bookmark cannot be removed from Elasticsearch."""
    pass


class S3Error(Exception):
    """Exception raised when S3 operations fail."""
    pass

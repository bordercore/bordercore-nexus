class DuplicateObjectError(Exception):
    pass


class BookmarkSearchDeleteError(Exception):
    """Raised when a bookmark cannot be removed from Elasticsearch."""
    pass


class S3Error(Exception):
    """Exception raised when S3 operations fail."""
    pass


class UnsupportedNodeTypeError(Exception):
    """Raised when node_type is not supported."""
    pass


class InvalidNodeTypeError(Exception):
    """Raised when node_type is invalid."""
    pass


class NodeNotFoundError(Exception):
    """Raised when the node is not found."""
    pass


class RelatedObjectNotFoundError(Exception):
    """Raised when the related object is not found."""
    pass


class ObjectAlreadyRelatedError(Exception):
    """Raised when the object is already related."""
    pass

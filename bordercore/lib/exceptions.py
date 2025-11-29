"""Custom exceptions for the bordercore application.

This module defines custom exception classes used throughout the application
for handling various error conditions, including duplicate objects, S3 operations,
node-related errors, and relationship management errors.
"""


class DuplicateObjectError(Exception):
    """Raised when attempting to create an object that already exists.

    This exception is used to signal that an operation would result in a
    duplicate object being created.
    """


class BookmarkSearchDeleteError(Exception):
    """Raised when a bookmark cannot be removed from Elasticsearch.

    This exception indicates that an error occurred while attempting to
    delete a bookmark from the Elasticsearch index.
    """


class S3Error(Exception):
    """Raised when S3 operations fail.

    This exception is used to signal errors that occur during AWS S3
    operations, such as uploads, downloads, or bucket management.
    """


class UnsupportedNodeTypeError(Exception):
    """Raised when a node type is not supported.

    This exception indicates that the provided node_type value is not
    supported by the current operation or system.
    """


class InvalidNodeTypeError(Exception):
    """Raised when a node type is invalid.

    This exception indicates that the provided node_type value is invalid
    or malformed for the current operation.
    """


class NodeNotFoundError(Exception):
    """Raised when a requested node cannot be found.

    This exception indicates that a node with the specified identifier
    does not exist or cannot be accessed.
    """


class RelatedObjectNotFoundError(Exception):
    """Raised when a related object cannot be found.

    This exception indicates that a related object referenced in an
    operation does not exist or cannot be accessed.
    """


class ObjectAlreadyRelatedError(Exception):
    """Raised when attempting to create a relationship that already exists.

    This exception indicates that an operation would result in creating
    a duplicate relationship between objects.
    """

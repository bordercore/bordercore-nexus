from lib.fields import CheckboxIntegerField


def test_to_python_true_returns_10():
    """Returns 10 for boolean True."""
    field = CheckboxIntegerField()
    assert field.to_python(True) == 10


def test_to_python_string_true_returns_10():
    """Returns 10 for string 'true'."""
    field = CheckboxIntegerField()
    assert field.to_python("true") == 10


def test_to_python_string_one_returns_10():
    """Returns 10 for string '1'."""
    field = CheckboxIntegerField()
    assert field.to_python("1") == 10


def test_to_python_false_returns_1():
    """Returns 1 for boolean False."""
    field = CheckboxIntegerField()
    assert field.to_python(False) == 1


def test_to_python_empty_string_returns_1():
    """Returns 1 for an empty string."""
    field = CheckboxIntegerField()
    assert field.to_python("") == 1


def test_to_python_none_returns_1():
    """Returns 1 for None."""
    field = CheckboxIntegerField()
    assert field.to_python(None) == 1

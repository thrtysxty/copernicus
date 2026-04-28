import pytest
from backend.utils.errors import AppError, handle_app_error

class TestAppError:
    def test_app_error_init_defaults(self):
        """Test AppError initialization with default values."""
        error = AppError("Something went wrong")
        assert error.message == "Something went wrong"
        assert error.status == 500
        assert error.detail == {}
        assert str(error) == "Something went wrong"

    def test_app_error_init_custom(self):
        """Test AppError initialization with custom values."""
        detail = {"code": "invalid_input", "field": "email"}
        error = AppError("Validation failed", status=400, detail=detail)
        assert error.message == "Validation failed"
        assert error.status == 400
        assert error.detail == detail

    def test_to_dict_basic(self):
        """Test to_dict() with only a message."""
        error = AppError("Basic error")
        assert error.to_dict() == {"error": "Basic error"}

    def test_to_dict_with_detail(self):
        """Test to_dict() with extra detail fields."""
        error = AppError("Not found", status=404, detail={"resource": "User", "id": 123})
        expected = {
            "error": "Not found",
            "resource": "User",
            "id": 123
        }
        assert error.to_dict() == expected

    def test_handle_app_error(self):
        """Test handle_app_error helper function for Flask responses."""
        error = AppError("Unauthorized", status=401, detail={"hint": "Login required"})
        response_body, status_code = handle_app_error(error)

        assert status_code == 401
        assert response_body == {
            "error": "Unauthorized",
            "hint": "Login required"
        }

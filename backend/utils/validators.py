"""Helper validation utilities for API endpoints."""

from typing import Any, Dict, List

from flask import Request


class RequestValidationError(Exception):
    """Custom exception for request validation failures."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def parse_json_request(request: Request) -> Dict[str, Any]:
    """Return parsed JSON from a Flask request or raise error."""
    if not request.is_json:
        raise RequestValidationError("Request must be JSON")
    data = request.get_json(silent=True)
    if not data:
        raise RequestValidationError("Empty request body")
    return data


def validate_sam_structure(sam: Any) -> Dict[str, Any]:
    """Validate SAM object structure and return it."""
    if not isinstance(sam, dict):
        raise RequestValidationError("SAM must be an object")

    sectors = sam.get("goods", [])
    factors = sam.get("factors", [])
    households = sam.get("households", [])
    sam_data = sam.get("data", [])

    if not isinstance(sectors, list) or not sectors:
        raise RequestValidationError("SAM goods must be a non-empty array")
    if not isinstance(factors, list) or not factors:
        raise RequestValidationError("SAM factors must be a non-empty array")
    if not isinstance(households, list) or not households:
        raise RequestValidationError("SAM households must be a non-empty array")
    if not isinstance(sam_data, list) or not sam_data:
        raise RequestValidationError("SAM data must be a non-empty array")

    return {
        "sectors": sectors,
        "factors": factors,
        "households": households,
        "data": sam_data,
    }


def adjust_parameter_list(values: List[float], target_length: int, default_value: float) -> List[float]:
    """Ensure parameter list matches a given length."""
    if len(values) < target_length:
        values.extend([default_value] * (target_length - len(values)))
    return values[:target_length]


def extract_parameters(params: Dict[str, Any], default_alpha: List[float], default_b: List[float]) -> (List[float], List[float]):
    """Extract alpha and b lists from params with defaults."""
    alpha = params.get("alpha", default_alpha)
    b = params.get("b", default_b)
    if not isinstance(alpha, list):
        raise RequestValidationError("Alpha parameters must be an array")
    if not isinstance(b, list):
        raise RequestValidationError("B parameters must be an array")
    try:
        alpha = [float(a) for a in alpha]
        b = [float(v) for v in b]
    except (ValueError, TypeError) as exc:
        raise RequestValidationError(f"Invalid parameters: {exc}")
    return alpha, b

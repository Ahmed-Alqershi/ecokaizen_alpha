from __future__ import annotations

"""Wrapper for MN1 CGE model to interface with API.

This provides a simple function `solve_mn1` that accepts JSON style
inputs from the frontend and returns results in a structured format.
The implementation reuses the dynamic simple CGE model to provide a
light‑weight placeholder solution until the full MN1 model is
integrated.
"""
from typing import Any, Dict, List

from .dynamic_splcge import dynamic_solve, extract_results


def _default_list(length: int, value: float) -> List[float]:
    return [value for _ in range(length)]


def solve_mn1(params: Dict[str, Any], sam: Dict[str, Any]) -> Dict[str, Any]:
    """Solve MN1 model using provided parameters and SAM.

    Args:
        params: Model parameters collected from the UI. Expected keys
            include ``beta`` (list) and ``A`` (list) but defaults will be
            supplied if they are missing.
        sam:    SAM structure containing ``goods``, ``factors``,
            ``households`` and ``data`` (2D list).

    Returns:
        Dictionary with benchmark vs solution values for key variables.
    """
    sectors: List[str] = sam.get("goods", [])
    factors: List[str] = sam.get("factors", [])
    households: List[str] = sam.get("households", [])
    data = sam.get("data", [])

    if not sectors or not factors or not households:
        raise ValueError("SAM must include goods, factors and households")

    # Map UI parameters to dynamic_splcge inputs
    beta = params.get("beta") or []
    alpha_input = beta[: len(sectors)] if beta else _default_list(len(sectors), 1.0 / max(len(sectors), 1))

    A_param = params.get("A") or []
    b_input = A_param[: len(sectors)] if A_param else _default_list(len(sectors), 1.0)

    container = dynamic_solve(sectors, factors, households, data, alpha_input, b_input)

    return extract_results(container)

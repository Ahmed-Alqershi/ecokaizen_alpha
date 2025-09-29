"""
Wrapper for MN1 model integration with the UI.
This module provides a clean interface between the frontend and the MN1 CGE model.
"""

import numpy as np
import pandas as pd
import tempfile
import os
import openpyxl
from typing import Dict, List, Any, Optional

# Import the core MN1 model solver
from .model_mn1 import solve_mn1_core


def _default_list(length: int, default_value: float) -> List[float]:
    """Create a list of given length with default values."""
    return [default_value] * length


def solve_mn1(params: Dict[str, Any], sam: Dict[str, Any]) -> Dict[str, Any]:
    """Solve MN1 model using provided parameters and SAM.

    Args:
        params: Model parameters collected from the UI. Expected keys:
            - alpha: List of alpha parameters for utility function
            - b: List of technology parameters for production function
            - prices: List of benchmark prices
            - wage: Benchmark wage rate
            - closureRules: List of closure rules
            - shocks: List of shocks to apply
        sam: SAM structure containing:
            - goods: List of sector names
            - factors: List of factor names  
            - households: List of household names
            - data: 2D list of SAM matrix data

    Returns:
        Dictionary with benchmark vs solution values for key variables.
    """
    # Extract SAM components
    sectors: List[str] = sam.get("goods", [])
    factors: List[str] = sam.get("factors", [])
    households: List[str] = sam.get("households", [])
    sam_data = sam.get("data", [])

    if not sectors or not factors or not households:
        raise ValueError("SAM must include goods, factors and households")

    # Extract parameters with defaults
    alpha_params = params.get("alpha", _default_list(len(sectors), 1.0 / len(sectors)))
    tech_params = params.get("b", _default_list(len(sectors), 1.0))
    prices = params.get("prices", _default_list(len(sectors), 1.0))
    wage = params.get("wage", 1.0)
    
    # Extract closure rules and shocks
    closure_rules = params.get("closureRules", [])
    shocks = params.get("shocks", [])

    # Validate parameter lengths
    if len(alpha_params) != len(sectors):
        alpha_params = _default_list(len(sectors), 1.0 / len(sectors))
    if len(tech_params) != len(sectors):
        tech_params = _default_list(len(sectors), 1.0)
    if len(prices) != len(sectors):
        prices = _default_list(len(sectors), 1.0)

    # Normalize alpha parameters to sum to 1
    alpha_sum = sum(alpha_params)
    if alpha_sum > 0:
        alpha_params = [a / alpha_sum for a in alpha_params]

    try:
        # Call the core MN1 model solver
        results = solve_mn1_core(
            sectors=sectors,
            factors=factors,
            households=households,
            sam_data=sam_data,
            prices=prices,
            wage=wage,
            alpha_params=alpha_params,
            tech_params=tech_params,
            closure_rules=closure_rules,
            shocks=shocks,
            auto_calibrate=True  # Default to auto-calibration
        )
        
        return results
        
    except Exception as e:
        print(f"Error solving MN1 model: {str(e)}")
        raise ValueError(f"Failed to solve MN1 model: {str(e)}")



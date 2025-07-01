"""
A Dynamic Simple CGE Model that supports custom sectors, factors, and households
"""

import numpy as np
import traceback

from gamspy import Container
from gamspy import Model
from gamspy import Set
from gamspy import Alias
from gamspy import Parameter
from gamspy import Variable
from gamspy import Equation
from gamspy import Product
from gamspy import Sum


def _round_dicts(dictionary, decimals=2):
    return {k: round(v, decimals) for k, v in dictionary.items()}


def build_dynamic_model(sectors, factors, households, sam_data):
    """
    Build a dynamic Simple CGE Model with custom sectors, factors, and households.
    
    Args:
        sectors (list): List of sector names
        factors (list): List of factor names
        households (list): List of household names
        sam_data (np.array): The SAM matrix
        
    Returns:
        (m, splcge): The container and model
    """
    # Create sector, factor, and household names
    sam_entry = sectors + factors + households
    
    # Ensure sam_data is a numpy array
    sam_data = np.array(sam_data)
    
    m = Container()
    
    u = Set(m, name="u", records=sam_entry, description="SAM entry")
    i = Set(m, name="i", domain=u, records=sectors, description="goods")    
    h = Set(m, name="h", domain=u, records=factors, description="factor")   
    
    v = Alias(m, name="v", alias_with=u)
    j = Alias(m, name="j", alias_with=i)
    k = Alias(m, name="k", alias_with=h)
    
    SAM = Parameter(m, name="SAM", domain=[u, v], records=sam_data, description="Social Accounting Matrix")
    
    # Loading the initial values
    X0 = Parameter(m, name="X0", domain=i, description="household consumption of the i-th good")
    F0 = Parameter(m, name="F0", domain=[h, j], description="the h-th factor input by the j-th firm")
    Z0 = Parameter(m, name="Z0", domain=j, description="output of the j-th good")
    FF = Parameter(m, name="FF", domain=h, description="factor endowment of the h-th factor")
    
    # For multiple households, we would sum their consumption
    # For the single household case
    if len(households) == 1:
        X0[i] = SAM[i, households[0]]
    else:
        # For multiple households, sum all consumption
        for sector in sectors:
            total_consumption = 0
            for household in households:
                total_consumption += SAM[sector, household]
            X0[sector] = total_consumption
    
    F0[h, j] = SAM[h, j]
    Z0[j] = Sum(h, F0[h, j])
    
    # For factor endowments, sum payments from households to factors
    for factor in factors:
        total_endowment = 0
        for household in households:
            total_endowment += SAM[household, factor]
        FF[factor] = total_endowment
    
    # Calibration Parameters
    alpha = Parameter(m, name="alpha", domain=i, description="share parameter in utility function")
    beta = Parameter(m, name="beta", domain=[h, j], description="share parameter in production function")
    b = Parameter(m, name="b", domain=j, description="scale parameter in production function")
    
    beta[h, j] = F0[h, j] / Sum(k, F0[k, j])
    
    # Variables
    X = Variable(m, name="X", domain=i, description="household consumption of the i-th good")
    F = Variable(m, name="F", domain=[h, j], description="the h-th factor input by the j-th firm")
    Z = Variable(m, name="Z", domain=j, description="output of the j-th good")
    px = Variable(m, name="px", domain=i, description="demand price of the i-th good")
    pz = Variable(m, name="pz", domain=j, description="supply price of the i-th good")
    pf = Variable(m, name="pf", domain=h, description="the h-th factor price")
    UU = Variable(m, name="UU", description="utility [fictitious]")
    
    # Equations
    eqX = Equation(m, name="eqX", domain=i, description="household demand function")
    eqpz = Equation(m, name="eqpz", domain=i, description="production function")
    eqF = Equation(m, name="eqF", domain=[h, j], description="factor demand function")
    eqpx = Equation(m, name="eqpx", domain=i, description="good market clearing condition")
    eqpf = Equation(m, name="eqpf", domain=h, description="factor market clearing condition")
    eqZ = Equation(m, name="eqZ", domain=i, description="price equation")
    obj = Equation(m, name="obj", description="utility function [fictitious]")
    
    eqX[i] = X[i] == alpha[i]*Sum(h, pf[h]*FF[h])/px[i]
    eqpz[j] = Z[j] == b[j]*Product(h, F[h, j]**beta[h, j])
    eqF[h, j] = F[h, j] == beta[h, j]*pz[j]*Z[j]/pf[h]
    eqpx[i] = X[i] == Z[i]
    eqpf[h] = Sum(j, F[h, j]) == FF[h]
    eqZ[i] = px[i] == pz[i]
    obj[...] = UU == Product(i, X[i]**alpha[i])
    
    # Initializing variables
    X.l[i] = X0[i]
    F.l[h, j] = F0[h, j]
    Z.l[j] = Z0[j]
    px.l[i] = 1
    pz.l[j] = 1
    pf.l[h] = 1
    
    # Setting lower bounds to avoid division by zero
    X.lo[i] = 0.001
    F.lo[h, j] = 0.001
    Z.lo[j] = 0.001
    px.lo[i] = 0.001
    pz.lo[j] = 0.001
    pf.lo[h] = 0.001
    
    # Fix one factor price as numeraire (use first factor by default)
    if len(factors) > 0:
        pf.fx[factors[0]] = 1
    
    splcge = Model(m, "splcge", "", "NLP", m.getEquations(), "MAX", UU)
    
    return m, splcge


def dynamic_solve(sectors, factors, households, sam_data, alpha_input, b_input):
    """
    Solve a dynamic Simple CGE Model with custom sectors, factors, and households.

    Args:
        sectors (list): List of sector names
        factors (list): List of factor names
        households (list): List of household names
        sam_data (list): The SAM matrix
        alpha_input (list): The alpha parameters
        b_input (list): The b parameters

    Returns:
        container: The solved model container
    """
    # Validate inputs
    if not isinstance(sectors, list) or not sectors:
        raise ValueError("Sectors must be a non-empty list")
    if not isinstance(factors, list) or not factors:
        raise ValueError("Factors must be a non-empty list")
    if not isinstance(households, list) or not households:
        raise ValueError("Households must be a non-empty list")
    if not isinstance(sam_data, list) or not sam_data:
        raise ValueError("SAM data must be a non-empty list")

    # Check dimensions
    expected_dim = len(sectors) + len(factors) + len(households)
    if len(sam_data) != expected_dim:
        raise ValueError(f"SAM data rows ({len(sam_data)}) don't match expected dimension ({expected_dim})")

    for i, row in enumerate(sam_data):
        if not isinstance(row, list):
            raise ValueError(f"SAM data row {i} is not a list")
        if len(row) != expected_dim:
            raise ValueError(f"SAM data row {i} length ({len(row)}) doesn't match expected dimension ({expected_dim})")

    # Validate alpha and b parameters
    if not isinstance(alpha_input, list) or len(alpha_input) != len(sectors):
        raise ValueError(f"Alpha parameter list length ({len(alpha_input) if isinstance(alpha_input, list) else 'not a list'}) doesn't match sectors count ({len(sectors)})")

    if not isinstance(b_input, list) or len(b_input) != len(sectors):
        raise ValueError(f"B parameter list length ({len(b_input) if isinstance(b_input, list) else 'not a list'}) doesn't match sectors count ({len(sectors)})")

    # Convert inputs to proper numpy arrays
    try:
        alpha_array = np.array(alpha_input, dtype=float)
        b_array = np.array(b_input, dtype=float)
        sam_array = np.array(sam_data, dtype=float)
    except (ValueError, TypeError) as e:
        raise ValueError(f"Error converting inputs to numeric arrays: {str(e)}")

    # Check for NaN or Infinity values
    if np.isnan(alpha_array).any() or np.isinf(alpha_array).any():
        raise ValueError("Alpha parameters contain NaN or Infinity values")
    if np.isnan(b_array).any() or np.isinf(b_array).any():
        raise ValueError("B parameters contain NaN or Infinity values")
    if np.isnan(sam_array).any() or np.isinf(sam_array).any():
        raise ValueError("SAM data contains NaN or Infinity values")

    # Now build and solve the model
    try:
        container, model = build_dynamic_model(sectors, factors, households, sam_array)

        # Set the input parameters
        container["alpha"].setRecords(alpha_array)
        container["b"].setRecords(b_array)

        # Solve the model
        model.solve()

        # # Check if model solved successfully
        # if model.status != 1:  # 1 = OPTIMAL
        #     raise ValueError(f"Model failed to solve optimally. Status: {model.status}")

        return container
    except Exception as e:
        print(f"Error solving dynamic model: {str(e)}")
        traceback.print_exc()
        raise


def extract_results(container):
    """
    Extract results from the container.

    Args:
        container: The solved model container

    Returns:
        dict: A dictionary containing the extracted results
    """
    if container is None:
        raise ValueError("Cannot extract results from null container")

    # Check if container has the required variables
    required_vars = ["px", "Z", "UU"]
    for var in required_vars:
        if var not in container:
            raise ValueError(f"Container is missing required variable '{var}'")

    try:
        # Safely extract records
        px = container["px"].toList()
        if px is None or len(px) == 0:
            raise ValueError("Empty or null price records")

        z = container["Z"].toList()
        if z is None or len(z) == 0:
            raise ValueError("Empty or null production records")

        uu = container["UU"].toValue()

        # Format results with error checking
        prices = {}
        production = {}

        for item in px:
            if len(item) < 2:
                continue  # Skip incomplete records
            prices[str(item[0])] = round(float(item[1]), 2)

        for item in z:
            if len(item) < 2:
                continue  # Skip incomplete records
            production[str(item[0])] = round(float(item[1]), 2)

        # Simple GDP calculation with safety check
        try:
            gdp = sum(production.values())
        except:
            gdp = 0
            print("Warning: Could not calculate GDP, using default value 0")

        # Convert to proper types for JSON serialization
        return {
            'prices': prices,
            'production': production,
            'utility': float(uu) if uu is not None else 0,
            'gdp': float(gdp) if gdp is not None else 0
        }
    except Exception as e:
        print(f"Error extracting results: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to extract results: {str(e)}")


if __name__ == "__main__":
    # Example usage
    sectors = ["BRD", "MLK"]
    factors = ["CAP", "LAB"]
    households = ["HOH"]
    
    sam_data = [
        [0, 0, 0, 0, 15],
        [0, 0, 0, 0, 35],
        [5, 20, 0, 0, 0],
        [10, 15, 0, 0, 0],
        [0, 0, 25, 25, 0]
    ]
    
    alpha_input = [0.3, 0.7]
    b_input = [1.0, 1.0]
    
    container = dynamic_solve(sectors, factors, households, sam_data, alpha_input, b_input)
    results = extract_results(container)
    
    print("Results:", results)
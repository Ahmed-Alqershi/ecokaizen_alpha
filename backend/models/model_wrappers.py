import importlib
from typing import List, Optional, Dict

from . import camcge, korcge, saudicge


def _extract_results(container) -> Dict[str, float]:
    """Extract key results from a solved container along with units."""
    prices = {}
    if "px" in container:
        for item in container["px"].toList():
            if len(item) >= 2:
                prices[str(item[0])] = float(item[1])

    production = {}
    if "xd" in container:
        for item in container["xd"].toList():
            if len(item) >= 2:
                production[str(item[0])] = float(item[1])

    utility_var = container["omega"]
    utility = float(utility_var.toValue()) if utility_var is not None else 0.0

    # GDP is provided by variable ``y`` in the models
    gdp = float(container["y"].toValue()) if "y" in container else 0.0

    financials = {}
    for var in [
        "gr",
        "tariff",
        "indtax",
        "netsub",
        "invest",
        "govsav",
        "hhsav",
        "fsav",
        "fbor",
        "tothhtax",
    ]:
        if var in container:
            try:
                val = float(container[var].toValue())
                desc = getattr(container[var], "description", "")
                unit = desc.split("(")[-1].rstrip(")") if "(" in desc else ""
                financials[var] = {"value": val, "unit": unit}
            except Exception:
                pass

    return {
        "prices": prices,
        "production": production,
        "utility": utility,
        "gdp": gdp,
        "financials": financials,
    }


def solve_cameroon() -> Dict[str, float]:
    """Run the Cameroon CGE model with its default data."""
    mod = importlib.reload(camcge)
    mod.camcge.solve(solver="CONOPT")
    return _extract_results(mod.m)


def solve_korea(
    tariff: Optional[List[float]] = None,
    indirect_tax: Optional[List[float]] = None,
    income_tax: Optional[List[float]] = None,
) -> Dict[str, float]:
    """Run the Korea CGE model with optional policy parameters."""
    mod = importlib.reload(korcge)

    defaults = {
        "tariff": mod.tm.toDense(),
        "indirectTax": mod.itax.toDense(),
        "incomeTax": mod.htax.toDense(),
    }

    if tariff is not None:
        for sec, val in zip(mod.data.sectors, tariff):
            mod.tm[sec] = float(val)
    if indirect_tax is not None:
        for sec, val in zip(mod.data.sectors, indirect_tax):
            mod.itax[sec] = float(val)
    if income_tax is not None:
        for hh, val in zip(mod.data.households, income_tax):
            mod.htax[hh] = float(val)

    mod.model1.solve(solver="CONOPT")
    results = _extract_results(mod.m)
    results["params"] = defaults
    return results


def solve_saudi(
    tariff: Optional[List[float]] = None,
    indirect_tax: Optional[List[float]] = None,
    income_tax: Optional[List[float]] = None,
) -> Dict[str, float]:
    """Run the Saudi CGE model with optional policy parameters."""
    mod = importlib.reload(saudicge)

    defaults = {
        "tariff": mod.tm.toDense(),
        "indirectTax": mod.itax.toDense(),
        "incomeTax": mod.htax.toDense(),
    }
    if tariff is not None:
        for sec, val in zip(mod.data.sectors, tariff):
            mod.tm[sec] = float(val)
    if indirect_tax is not None:
        for sec, val in zip(mod.data.sectors, indirect_tax):
            mod.itax[sec] = float(val)
    if income_tax is not None:
        for hh, val in zip(mod.data.households, income_tax):
            mod.htax[hh] = float(val)

    mod.model1.solve(solver="CONOPT")
    results = _extract_results(mod.m)
    results["params"] = defaults
    return results

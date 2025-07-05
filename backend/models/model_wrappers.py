import importlib
from typing import List, Optional, Dict

from . import camcge, korcge, saudicge


def _extract_results(container) -> Dict[str, float]:
    """Extract key results from a solved container."""
    prices = container["px"].toDict() if "px" in container else {}
    production = container["xd"].toDict() if "xd" in container else {}

    utility_var = container.get("omega")
    utility = float(utility_var.toValue()) if utility_var is not None else 0.0

    # According to model specifications GDP equals the objective function value
    gdp = utility

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
                financials[var] = float(container[var].toValue())
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
        "tariff": [float(mod.tm[s]) for s in mod.data.sectors],
        "indirectTax": [float(mod.itax[s]) for s in mod.data.sectors],
        "incomeTax": [float(mod.htax[h]) for h in mod.data.households],
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
        "tariff": [float(mod.tm[s]) for s in mod.data.sectors],
        "indirectTax": [float(mod.itax[s]) for s in mod.data.sectors],
        "incomeTax": [float(mod.htax[h]) for h in mod.data.households],
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

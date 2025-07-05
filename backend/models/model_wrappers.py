import importlib
from typing import List, Optional, Dict

from . import camcge, korcge, saudicge


def _extract_results(container) -> Dict[str, float]:
    """Extract common result metrics from a solved container."""
    prices = container["px"].toDict()
    production = container["xd"].toDict()
    utility_var = container["omega"]
    utility = float(utility_var.toValue()) if utility_var is not None else 0.0

    if "pva" in container and "xd" in container:
        pva = container["pva"].toDict()
        xd_vals = container["xd"].toDict()
        gdp = sum(pva[s] * xd_vals.get(s, 0) for s in pva)
    else:
        gdp = sum(production.values())

    return {
        "prices": prices,
        "production": production,
        "utility": utility,
        "gdp": float(gdp),
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
    return _extract_results(mod.m)


def solve_saudi(
    tariff: Optional[List[float]] = None,
    indirect_tax: Optional[List[float]] = None,
    income_tax: Optional[List[float]] = None,
) -> Dict[str, float]:
    """Run the Saudi CGE model with optional policy parameters."""
    mod = importlib.reload(saudicge)

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
    return _extract_results(mod.m)

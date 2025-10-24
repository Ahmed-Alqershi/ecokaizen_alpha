
from gamspy import Container
from gamspy import Set
from gamspy import Alias
from gamspy import Parameter
from gamspy import Variable
from gamspy import Equation
from gamspy import Sum
from gamspy import Model
from gamspy import Options
from gamspy import Ord
from gamspy import Card
from gamspy import ModelStatus
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple

def convert_gams_dict_to_nested(gams_dict: Dict, expected_structure: str) -> Dict[str, Any]:
    """
    Convert GAMSPy parameter dictionary with tuple keys to nested dictionary with string keys.
    
    Args:
        gams_dict: Dictionary returned by GAMSPy's toDict() method
        expected_structure: String indicating the expected structure ('summary', 'sector_household', 'demand_matrix')
        
    Returns:
        Nested dictionary with string keys that can be JSON serialized
    """
    if expected_structure == 'summary':
        # all_reports_0: domain=["*", "*"] -> {metric: {period: value}}
        result = {}
        for (metric, period), value in gams_dict.items():
            if metric not in result:
                result[metric] = {}
            result[metric][period] = float(value) if value is not None else 0.0
        return result
        
    elif expected_structure == 'sector_household':
        # all_reports_1: domain=["*", n1, "*"] -> {metric: {entity: {period: value}}}
        result = {}
        for (metric, entity, period), value in gams_dict.items():
            if metric not in result:
                result[metric] = {}
            if entity not in result[metric]:
                result[metric][entity] = {}
            result[metric][entity][period] = float(value) if value is not None else 0.0
        return result
        
    elif expected_structure == 'demand_matrix':
        # all_reports_2: domain=["*", consumers, inds, "*"] -> {metric: {consumer: {sector: {period: value}}}}
        result = {}
        for (metric, consumer, sector, period), value in gams_dict.items():
            if metric not in result:
                result[metric] = {}
            if consumer not in result[metric]:
                result[metric][consumer] = {}
            if sector not in result[metric][consumer]:
                result[metric][consumer][sector] = {}
            result[metric][consumer][sector][period] = float(value) if value is not None else 0.0
        return result
    
    else:
        raise ValueError(f"Unknown expected_structure: {expected_structure}")

@dataclass
class ClosureRule:
    """Represents a model closure rule (always fixed to benchmark)."""
    variable: str
    indices: list[str]
    multiplier: float = 1.0  # Default to benchmark


class ClosureRuleBuilder:
    """Collects and applies closure rules to the model."""

    def __init__(self) -> None:
        self.rules: list[ClosureRule] = []

    def add_rule(self, variable: str, indices: list[str]) -> None:
        self.rules.append(ClosureRule(variable, indices))

    def remove_rule(self, index: int) -> None:
        if 0 <= index < len(self.rules):
            self.rules.pop(index)

    def list_rules(self) -> list[str]:
        return [
            f"{i}: fix {r.variable}[{','.join(r.indices) if r.indices else 'all'}] = benchmark"
            for i, r in enumerate(self.rules)
        ]

    def apply(self, var_map: dict[str, Variable | Parameter], benchmarks: dict[str, Parameter]) -> None:
        for rule in self.rules:
            obj = var_map.get(rule.variable)

            if obj is None:
                print(f"⚠️ Warning: Variable or parameter '{rule.variable}' not found in model. Skipping.")
                continue

            is_variable = isinstance(obj, Variable)
            benchmark = benchmarks.get(rule.variable) if is_variable else None

            if is_variable and benchmark is None:
                print(f"⚠️ Warning: Benchmark value for variable '{rule.variable}' not provided. Skipping.")
                continue

            try:
                if rule.indices:
                    # Handle two-dimensional variables like XD (demand)
                    if rule.variable in ['D', 'XD'] and len(rule.indices) == 1:
                        # Parse "CONSA_Bread" into ("Bread", "CONSA") for XD[inds, consumers]
                        parts = rule.indices[0].split('_')
                        if len(parts) == 2:
                            consumer, industry = parts
                            index = (industry, consumer)  # XD domain is [inds, consumers]
                        else:
                            print(f"⚠️ Warning: Invalid demand index format '{rule.indices[0]}'. Expected 'consumer_industry'.")
                            continue
                    else:
                        index = tuple(rule.indices)
                    
                    if is_variable:
                        obj.fx[index] = benchmark[index] * rule.multiplier
                    else:
                        obj[index] = obj[index] * rule.multiplier
                else:
                    if is_variable:
                        obj.fx[...] = benchmark[...] * rule.multiplier
                    else:
                        obj[...] = obj[...] * rule.multiplier
            except Exception as e:
                print(f"❌ Error applying closure rule on '{rule.variable}': {e}")


@dataclass
class Shock:
    """Represents a shock to a parameter or variable."""
    target: str
    indices: list[str]
    multiplier: float


class ShockBuilder:
    """Collects and applies shocks to model components."""

    def __init__(self) -> None:
        self.shocks: list[Shock] = []

    def add_shock(self, target: str, indices: list[str], multiplier: float) -> None:
        self.shocks.append(Shock(target, indices, multiplier))

    def remove_shock(self, index: int) -> None:
        if 0 <= index < len(self.shocks):
            self.shocks.pop(index)

    def list_shocks(self) -> list[str]:
        return [
            f"{i}: {s.target}[{','.join(s.indices) if s.indices else 'all'}] = {s.multiplier} × benchmark"
            for i, s in enumerate(self.shocks)
        ]

    def apply(self, obj_map: dict[str, Variable | Parameter], benchmarks: dict[str, Parameter]) -> None:
        for shock in self.shocks:
            obj = obj_map.get(shock.target)

            if obj is None:
                print(f"⚠️ Warning: Target '{shock.target}' not found in model. Skipping.")
                continue

            is_variable = isinstance(obj, Variable)
            benchmark = benchmarks.get(shock.target) if is_variable else None

            if is_variable and benchmark is None:
                print(f"⚠️ Warning: Benchmark value for variable '{shock.target}' not provided. Skipping.")
                continue

            try:
                if shock.indices:
                    # Handle two-dimensional variables like XD (demand)
                    if shock.target in ['D', 'XD'] and len(shock.indices) == 1:
                        # Parse "CONSA_Bread" into ("Bread", "CONSA") for XD[inds, consumers]
                        parts = shock.indices[0].split('_')
                        if len(parts) == 2:
                            consumer, industry = parts
                            index = (industry, consumer)  # XD domain is [inds, consumers]
                        else:
                            print(f"⚠️ Warning: Invalid demand index format '{shock.indices[0]}'. Expected 'consumer_industry'.")
                            continue
                    else:
                        index = tuple(shock.indices)
                    
                    if is_variable:
                        obj.fx[index] = benchmark[index] * shock.multiplier
                    else:
                        obj[index] = obj[index] * shock.multiplier
                else:
                    if is_variable:
                        obj.fx[...] = benchmark[...] * shock.multiplier
                    else:
                        obj[...] = obj[...] * shock.multiplier
            except Exception as e:
                print(f"❌ Error applying shock on '{shock.target}': {e}")
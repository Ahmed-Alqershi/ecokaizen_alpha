"""
This model template is designed to build and run CGE models with
`m` number of `industries` and `n` number of `consumers`.
And one factor which is `labor`.
`Capital` is included but not considered as a factor.
The user has the capacity to:
- Add their own SAM data.
- Define the number of industries and consumers (as mentioned in the SAM uploaded).
- Define the prices of commodities and the wage rate in the benchmark situation.
- Choose whether to calibrate the model automatically or manually.
- Define model closure rules.
- Define shocks to the model.
"""

import numpy as np
import pandas as pd
import argparse
import sys

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

from gamspy.math import rpower

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



def solve_mn1_core(
    sectors: List[str],
    factors: List[str], 
    households: List[str],
    sam_data: List[List[float]],
    prices: List[float],
    wage: float,
    alpha_params: Optional[List[float]] = None,
    beta_params: Optional[List[List[float]]] = None,
    tech_params: Optional[List[float]] = None,
    closure_rules: Optional[List[Dict[str, Any]]] = None,
    shocks: Optional[List[Dict[str, Any]]] = None,
    auto_calibrate: bool = True
) -> Dict[str, Any]:
    """
    Core MN1 model solver function that can be called programmatically.
    
    Args:
        sectors: List of sector names
        factors: List of factor names (should include 'LAB' for labor)
        households: List of household names  
        sam_data: 2D list representing the SAM matrix
        prices: List of benchmark prices for each sector
        wage: Benchmark wage rate
        alpha_params: Labor input elasticity parameters (if not auto-calibrating)
        beta_params: Utility share parameters (if not auto-calibrating)
        tech_params: Technology shift parameters (if not auto-calibrating)
        closure_rules: List of closure rules to apply
        shocks: List of shocks to apply
        auto_calibrate: Whether to auto-calibrate the model
        
    Returns:
        Dictionary containing the solved model results
    """
    
    # Validate inputs
    if len(sectors) != len(prices):
        raise ValueError(f"Number of sectors ({len(sectors)}) must match number of prices ({len(prices)})")
    
    if len(sam_data) != len(sam_data[0]):
        raise ValueError("SAM matrix must be square")
    
    expected_size = len(sectors) + len(factors) + len(households)
    if len(sam_data) != expected_size:
        raise ValueError(f"SAM matrix size ({len(sam_data)}) must match sectors+factors+households ({expected_size})")

    # Set up the container
    m = Container()

    
    # Create the full account list (sectors + factors + households)
    all_accounts = sectors + factors + households

    # Define the sets

    n1 = Set(m, name="n1", records=all_accounts)
    inds = Set(m, name="inds", domain=n1, records=sectors)
    consumers = Set(m, name="consumers", domain=n1, records=households)
    n2 = Alias(m, name="n2", alias_with=n1)


    # Define the benchmark parameters
    A = Parameter(m, name="A", domain=inds, description="Shift parameter in the production function of firms")
    BETA = Parameter(m, name="BETA", domain=[consumers, inds], description="Share parameter in the utility function of consumers")
    ALPHA = Parameter(m, name="ALPHA", domain=inds, description="Labour input elasticity of output in firms")
    XDO = Parameter(m, name="XDO", domain=[inds, consumers], description="Demand of goods by consumers in the benchmark situation (volume)")
    PO = Parameter(m, name="PO", domain=inds, description="Price of goods in the benchmark situation")
    WO = Parameter(m, name="WO", description="Wage rate in the benchmark situation")
    XSO = Parameter(m, name="XSO", domain=inds, description="Supply of goods in the benchmark situation (volume)")
    RO = Parameter(m, name="RO", domain=consumers, description="Income of consumers in the benchmark situation (volume)")
    LDO = Parameter(m, name="LDO", domain=inds, description="Labour demand of firms in the benchmark situation (volume)")
    LSO = Parameter(m, name="LSO", domain=consumers, description="Labour endowment of consumer A in the benchmark situation (volume)")
    PROFITO = Parameter(m, name="PROFITO", domain=inds, description="Profit of firm 1 in the benchmark situation (value)")
    PROFITOTO = Parameter(m, name="PROFITOTO", description="Total profits of firms in the benchmark situation (value)")
    LAMBDA = Parameter(m, name="LAMBDA", domain=consumers, description="Share of consumer A in total profit in the benchmark situation")
    
    # Convert SAM data to the format expected by GAMSPY
    sam_records = []
    for i, row in enumerate(sam_data):
        for j, value in enumerate(row):
            if value != 0:  # Only store non-zero values
                sam_records.append([all_accounts[i], all_accounts[j], value])
    
    SAM221 = Parameter(m, name="SAM221", domain=[n1, n2], records=sam_records, description="Base run SAM before solving the model")
    
    # Set benchmark values
    PO.setRecords(np.array(prices))
    print(PO.toDict())

    WO[...] = wage


    # Calculate benchmark quantities from SAM
    # Consumer demand for goods (volume = value / price)
    XDO[inds, consumers] = SAM221[inds, consumers] / PO[inds]


    # Labor supply from consumers (volume = value / wage)
    LSO[consumers] = SAM221[consumers, factors[0]] / WO  # Use first factor (assumed to be labor)
    
    # Consumer income (sum of spending on goods)
    RO[consumers] = Sum(inds, PO[inds] * XDO[inds, consumers])
    
    # Total supply of goods (sum of consumer demand)
    XSO[inds] = Sum(consumers, XDO[inds, consumers])
    
    # Labor demand by sectors (volume = value / wage)
    LDO[inds] = SAM221[factors[0], inds] / WO  # Use first factor (assumed to be labor)
    
    # Profit by sectors (capital payments from SAM)
    PROFITO[inds] = SAM221[factors[1], inds]  # Use second factor (assumed to be capital)
    
    # Total profits
    PROFITOTO[...] = Sum(inds, PROFITO[inds])
    
    # Share of consumer income from profits
    LAMBDA[consumers] = (RO[consumers] - WO*LSO[consumers])/PROFITOTO
    
    # Store benchmark values for easy access in results
    benchmark_production = XSO.toDict()
    benchmark_prices = PO.toDict()
    benchmark_wage = WO.toValue()
    benchmark_incomes = RO.toDict()

    # Debug: Print benchmark values
    print(f"Benchmark production: {benchmark_production}")
    print(f"Benchmark prices: {benchmark_prices}")
    print(f"Benchmark wage: {benchmark_wage}")
    print(f"Benchmark incomes: {benchmark_incomes}")
    
    # Calibration
    if auto_calibrate:
        BETA[consumers, inds] = PO[inds] * XDO[inds, consumers] / RO[consumers]

        ALPHA[inds] = WO * LDO[inds] / XSO[inds] / PO[inds]
        A[inds] = XSO[inds] * rpower(LDO[inds], -ALPHA[inds])


        # Debug: Print calibration parameters
        print(f"Calibrated BETA: {BETA.toDict()}")
        print(f"Calibrated ALPHA: {ALPHA.toDict()}")
        print(f"Calibrated A: {A.toDict()}")
    else:

        if alpha_params is None or beta_params is None or tech_params is None:
            raise ValueError("Manual calibration requires alpha_params, beta_params, and tech_params")
        
        BETA.setRecords(np.array(beta_params))
        ALPHA.setRecords(np.array(alpha_params))
        A.setRecords(np.array(tech_params))
    
    # Define model variables
    XD = Variable(m, name="XD", type="positive", domain=XDO.domain, description="Demand of goods by Consumers (volume)")
    R = Variable(m, name="R", type="positive", domain=RO.domain, description="Income of consumers")
    PROFITOT = Variable(m, name="PROFITOT", type="positive", description="Total profit")
    XS = Variable(m, name="XS", type="positive", domain=XSO.domain, description="Supply of goods")
    LD = Variable(m, name="LD", type="positive", domain=LDO.domain, description="Labour demand of Firms (volume)")
    PROFIT = Variable(m, name="PROFIT", type="positive", domain=PROFITO.domain, description="Profit of firms")
    P = Variable(m, name="P", type="positive", domain=PO.domain, description="Price of goods")
    W = Variable(m, name="W", type="positive", description="Wage rate")
    LS = Variable(m, name="LS", type="positive", domain=LSO.domain, description="Labour endowment of Consumer A")
    
    # Free Variables
    OMEGA = Variable(m, "OMEGA", description="Dummy variable to maximize")

    
    # Define equations
    EqXD = Equation(m, name="EqXD", domain=XD.domain, description="Demand of goods by consumers (volume)")
    EqR = Equation(m, name="EqR", domain=R.domain, description="Definition of income of consumers")
    EqPROFITOT = Equation(m, name="EqPROFITOT", description="Definition of total profit")
    EqXS = Equation(m, name="EqXS", domain=inds, description="Supply of goods")
    EqLD = Equation(m, name="EqLD", domain=inds, description="Labour demand of firms (volume)")
    EqPROFIT = Equation(m, name="EqPROFIT", domain=inds, description="Profit of firm 1")
    EQB = Equation(m, name="EQB", domain=inds, description="Equilibrium condition of goods")
    EQLAB = Equation(m, name="EQLAB", description="Labour market equilibrium condition")
    OBJ = Equation(m, name="OBJ", description="Objective function")
    
    # Equation specifications
    EqXD[inds, consumers] = XD[inds, consumers] == BETA[consumers, inds]*R[consumers]/P[inds]
    EqR[consumers] = R[consumers] == W*LS[consumers] + LAMBDA[consumers]*PROFITOT
    EqPROFITOT[...] = PROFITOT == Sum(inds, PROFIT[inds])
    EqXS[inds] = XS[inds] == A[inds]* rpower(LD[inds], ALPHA[inds])
    EqLD[inds] = W*LD[inds] == ALPHA[inds]*P[inds]*XS[inds]
    EqPROFIT[inds] = PROFIT[inds] == P[inds]*XS[inds] - W*LD[inds]
    EQB[inds].where[Ord(inds) < Card(inds)] = XS[inds] == Sum(consumers, XD[inds, consumers])

    EQLAB[...] = Sum(consumers, LS[consumers]) == Sum(inds, LD[inds])
    OBJ[...] = OMEGA == 10
    
    # Initialization
    XD.l[inds, consumers] = XDO[inds, consumers]
    XD.lo[inds, consumers] = XDO[inds, consumers] * 0.001

    R.l[consumers] = RO[consumers]
    R.lo[consumers] = RO[consumers] * 0.001

    PROFITOT.l[...] = PROFITOTO
    PROFITOT.lo[...] = PROFITOTO * 0.001
    XS.l[inds] = XSO[inds]
    XS.lo[inds] = XSO[inds] * 0.001

    LD.l[inds] = LDO[inds]
    LD.lo[inds] = LDO[inds] * 0.001

    PROFIT.l[inds] = PROFITO[inds]
    PROFIT.lo[inds] = PROFITO[inds] * 0.001

    P.l[inds] = PO[inds]
    P.lo[inds] = PO[inds] * 0.001

    W.l[...] = WO
    W.lo[...] = WO * 0.001

    LS.l[consumers] = LSO[consumers]
    LS.lo[consumers] = LSO[consumers] * 0.001


    # Debug: Print initial values
    print(f"Initial XS values: {XS.toDict()}")
    print(f"Initial P values: {P.toDict()}")
    print(f"Initial W value: {W.toValue()}")


    # Apply closure rules if provided
    if closure_rules:
        closure_builder = ClosureRuleBuilder()

        for rule in closure_rules:
            closure_builder.add_rule(rule['variable'], rule.get('indices', []))
        
        obj_map = {"XD": XD, "D": XD, "R": R, "PROFITOT": PROFITOT, "XS": XS, "LD": LD, "PROFIT": PROFIT, "P": P, "W": W, "LS": LS}
        benchmark_map = {"XD": XDO, "D": XDO, "R": RO, "PROFITOT": PROFITOTO, "XS": XSO, "LD": LDO, "PROFIT": PROFITO, "P": PO, "W": WO, "LS": LSO}
        closure_builder.apply(obj_map, benchmark_map)
    
    # Apply shocks if provided
    if shocks:
        shock_builder = ShockBuilder()
        for shock in shocks:
            shock_builder.add_shock(shock['target'], shock.get('indices', []), shock['multiplier'])
        
        obj_map = {"XD": XD, "D": XD, "R": R, "PROFITOT": PROFITOT, "XS": XS, "LD": LD, "PROFIT": PROFIT, "P": P, "W": W, "LS": LS, "A": A, "BETA": BETA, "ALPHA": ALPHA}
        benchmark_map = {"XD": XDO, "D": XDO, "R": RO, "PROFITOT": PROFITOTO, "XS": XSO, "LD": LDO, "PROFIT": PROFITO, "P": PO, "W": WO, "LS": LSO}
        shock_builder.apply(obj_map, benchmark_map)
    
    # Declare and solve the model
    MOD221_CAL = Model(m, name="MOD221_CAL", problem="NLP", equations=m.getEquations(), sense="MIN", objective=OMEGA)


    # Set solver options for better convergence
    options = Options.fromGams({"ITERLIM": 10000, "RESLIM": 10000, "LIMCOL": 1, "LIMROW": 1, "NLP": "CONOPT", "holdfixed": 1})
    # Solve the model
    MOD221_CAL.solve(options=options)

    if not MOD221_CAL.status in [ModelStatus.OptimalGlobal, ModelStatus.OptimalLocal]:
        raise Exception(f"Model did not solve optimally. Status: {MOD221_CAL.status}")


    # Debug: Print some key values to understand what's happening
    print(f"Model solved with status: {MOD221_CAL.status}")
    print(f"Objective value: {OMEGA.toValue()}")
    print(f"Production values: {XS.toDict()}")
    print(f"Price values: {P.toDict()}")
    print(f"Wage value: {W.toValue()}")
    
    # Extract results
    VX = Parameter(m, name="VX", domain=[consumers, inds], description="Change in Consumers demand for products")
    VR = Parameter(m, name="VR", domain=consumers, description="Change in Consumers revenue")
    VPROFITOT = Parameter(m, name="VPROFITOT", description="Change in Total Profit")
    VS = Parameter(m, name="VS", domain=inds, description="Change in Supply of products")
    VWLS = Parameter(m, name="VWLS", domain=consumers, description="Change in Labor expenses of companies")
    VPROFIT = Parameter(m, name="VPROFIT", domain=inds, description="Change in Profit of companies")
    VP = Parameter(m, name="VP", domain=inds, description="Change in Price of products")
    VW = Parameter(m, name="VW", description="Change in Wages")
    VLD = Parameter(m, name="VLD", domain=inds, description="Change in Labor demand of companies")
    VPROFICONS = Parameter(m, name="VPROFICONS", domain=consumers, description="Share of consumer A from the firms profit")
    VLS = Parameter(m, name="VLS", domain=consumers, description="Change in Labor supply of consumer A")
    
    # Calculate percentage changes
    VX[consumers, inds] = (XD.l - XDO) / XDO
    VR[consumers] = (R.l - RO) / RO
    VPROFITOT[...] = (PROFITOT.l - PROFITOTO) / PROFITOTO
    VS[inds] = (XS.l - XSO) / XSO
    VWLS[consumers] = (W.l*LS.l - (WO*LSO)) / (WO*LSO)
    VPROFIT[inds] = (PROFIT.l - PROFITO) / PROFITO
    VP[inds] = (P.l - PO) / PO
    VW[...] = (W.l - WO) / WO
    VLD[inds] = (LD.l - LDO) / LDO
    VPROFICONS[consumers] = (LAMBDA * PROFITOT.l - (LAMBDA * PROFITOTO)) / (LAMBDA * PROFITOTO)

    VLS[consumers] = (LS.l - LSO) / LSO
    
    # Add professional reporting structure
    all_reports_0 = Parameter(m, name="all_reports_0", domain=["*", "*"])
    all_reports_1 = Parameter(m, name="all_reports_1", domain=["*", n1, "*"])
    all_reports_2 = Parameter(m, name="all_reports_2", domain=["*", consumers, inds, "*"])

    # Compact report (All except demand, total profit and wage change)
    all_reports_0["Total Profit", "Benchmark"] = PROFITOTO[...]
    all_reports_0["Total Profit", "After Shock"] = PROFITOT.l[...]
    all_reports_0["Total Profit", "Change (%)"] = VPROFITOT[...]

    all_reports_0["Wage Rate", "Benchmark"] = WO[...]
    all_reports_0["Wage Rate", "After Shock"] = W.l[...]
    all_reports_0["Wage Rate", "Change (%)"] = VW[...]

    # Sector and household level reports
    all_reports_1["Supply", inds, "Benchmark"] = XSO[inds]
    all_reports_1["Supply", inds, "After Shock"] = XS.l[inds]
    all_reports_1["Supply", inds, "Change (%)"] = VS[inds]

    all_reports_1["Price", inds, "Benchmark"] = PO[inds]
    all_reports_1["Price", inds, "After Shock"] = P.l[inds]
    all_reports_1["Price", inds, "Change (%)"] = VP[inds]

    all_reports_1["Income", consumers, "Benchmark"] = RO[consumers]
    all_reports_1["Income", consumers, "After Shock"] = R.l[consumers]
    all_reports_1["Income", consumers, "Change (%)"] = VR[consumers]

    all_reports_1["Labor Supply", consumers, "Benchmark"] = LSO[consumers]
    all_reports_1["Labor Supply", consumers, "After Shock"] = LS.l[consumers]
    all_reports_1["Labor Supply", consumers, "Change (%)"] = VLS[consumers]

    all_reports_1["Labor Demand", inds, "Benchmark"] = LDO[inds]
    all_reports_1["Labor Demand", inds, "After Shock"] = LD.l[inds]
    all_reports_1["Labor Demand", inds, "Change (%)"] = VLD[inds]

    all_reports_1["Profits", inds, "Benchmark"] = PROFITO[inds]
    all_reports_1["Profits", inds, "After Shock"] = PROFIT.l[inds]
    all_reports_1["Profits", inds, "Change (%)"] = VPROFIT[inds]

    # Demand matrix reports
    all_reports_2["Demand", consumers, inds, "Benchmark"] = XDO[inds, consumers]
    all_reports_2["Demand", consumers, inds, "After Shock"] = XD.l[inds, consumers]
    all_reports_2["Demand", consumers, inds, "Change (%)"] = VX[consumers, inds]
    
    # Return results in the format expected by the frontend
    results = {
        'prices': {},
        'production': {},
        'utility': 1.0,  # Placeholder - MN1 doesn't have utility
        'gdp': 0.0,      # Placeholder - could be calculated
        'benchmark_vs_solution': {},
        'benchmark': {
            'production': benchmark_production,
            'prices': benchmark_prices,
            'wage': benchmark_wage,
            'incomes': benchmark_incomes
        },
        'professional_reports': {
            'summary': convert_gams_dict_to_nested(all_reports_0.toDict(), 'summary'),
            'sector_household': convert_gams_dict_to_nested(all_reports_1.toDict(), 'sector_household'),
            'demand_matrix': convert_gams_dict_to_nested(all_reports_2.toDict(), 'demand_matrix')
        }
    }
    
    # Extract production quantities using toDict() for multi-domain variables
    production_dict = XS.toDict()
    prices_dict = P.toDict()
    
    for sector in sectors:
        # Get solution values
        solution_production = production_dict.get(sector, 0.0)
        solution_price = prices_dict.get(sector, 0.0)
        
        # Get benchmark values from stored dictionaries
        benchmark_production_val = benchmark_production.get(sector, 0.0)
        benchmark_price_val = benchmark_prices.get(sector, 0.0)
        
        # Store solution values
        results['production'][sector] = solution_production
        results['prices'][sector] = solution_price
        
        # Calculate percentage changes
        if benchmark_production_val > 0:
            production_change = ((solution_production - benchmark_production_val) / benchmark_production_val) * 100
        else:
            production_change = 0.0
            
        if benchmark_price_val > 0:
            price_change = ((solution_price - benchmark_price_val) / benchmark_price_val) * 100
        else:
            price_change = 0.0
            
        # Store changes in benchmark_vs_solution
        results['benchmark_vs_solution'][f'production_{sector}'] = production_change
        results['benchmark_vs_solution'][f'price_{sector}'] = price_change
    
    # Extract factor prices using toValue() for scalar variables
    solution_wage = W.toValue()
    results['wage'] = solution_wage
    
    # Calculate wage change
    if benchmark_wage > 0:
        wage_change = ((solution_wage - benchmark_wage) / benchmark_wage) * 100
    else:
        wage_change = 0.0
    results['benchmark_vs_solution']['wage'] = wage_change
    
    # Extract household incomes using toDict() for multi-domain variables
    income_dict = R.toDict()
    for household in households:
        solution_income = income_dict.get(household, 0.0)
        benchmark_income_val = benchmark_incomes.get(household, 0.0)
        
        results['benchmark_vs_solution'][f'income_{household}'] = solution_income
        
        # Calculate income change
        if benchmark_income_val > 0:
            income_change = ((solution_income - benchmark_income_val) / benchmark_income_val) * 100
        else:
            income_change = 0.0
        results['benchmark_vs_solution'][f'income_change_{household}'] = income_change
    
    return results


# CLI interface for backward compatibility
def main():
    """
    CLI interface for backward compatibility.
    This function collects inputs via command line and calls solve_mn1_core.
    """
    print("MN1 CGE Model - CLI Interface")
    print("=" * 40)
    
    try:
        # Get model dimensions
        print("\nEnter model dimensions:")
        sectors_count = int(input("Number of sectors (industries): "))
        factors_count = int(input("Number of factors (should be 2 for LAB and CAP): "))
        households_count = int(input("Number of households: "))
        
        # Generate default names
        sectors = [f"IND{i+1}" for i in range(sectors_count)]
        factors = ["LAB", "CAP"]
        households = [f"CONS{chr(65+i)}" for i in range(households_count)]
        
        print(f"\nGenerated names:")
        print(f"Sectors: {sectors}")
        print(f"Factors: {factors}")
        print(f"Households: {households}")
        
        # Get benchmark values
        print("\nEnter benchmark values:")
        prices = []
        for sector in sectors:
            price = float(input(f"Price for {sector}: "))
            prices.append(price)
        
        wage = float(input("Wage rate: "))
        
        # Get calibration mode
        print("\nCalibration mode:")
        print("1. Auto-calibrate (recommended)")
        print("2. Manual calibration")
        choice = input("Choose (1 or 2): ")
        
        auto_calibrate = choice == "1"
        alpha_params = None
        beta_params = None
        tech_params = None
        
        if not auto_calibrate:
            print("\nManual calibration:")
            alpha_params = []
            for sector in sectors:
                alpha = float(input(f"Alpha (labor elasticity) for {sector}: "))
                alpha_params.append(alpha)
            
            beta_params = []
            for household in households:
                household_betas = []
                for sector in sectors:
                    beta = float(input(f"Beta (utility share) for {household}-{sector}: "))
                    household_betas.append(beta)
                beta_params.append(household_betas)
            
            tech_params = []
            for sector in sectors:
                tech = float(input(f"Technology parameter A for {sector}: "))
                tech_params.append(tech)
        
        # Get closure rules
        print("\nClosure rules (optional):")
        closure_rules = []
        while True:
            add_rule = input("Add closure rule? (y/n): ").lower()
            if add_rule != 'y':
                break
            
            variable = input("Variable to fix (XD, R, PROFITOT, XS, LD, PROFIT, P, W, LS): ")
            indices_input = input("Indices (comma-separated, or press Enter for all): ")
            indices = [idx.strip() for idx in indices_input.split(',')] if indices_input.strip() else []
            
            closure_rules.append({
                'variable': variable,
                'indices': indices
            })
        
        # Get shocks
        print("\nShocks (optional):")
        shocks = []
        while True:
            add_shock = input("Add shock? (y/n): ").lower()
            if add_shock != 'y':
                break
            
            target = input("Target variable/parameter: ")
            indices_input = input("Indices (comma-separated, or press Enter for all): ")
            indices = [idx.strip() for idx in indices_input.split(',')] if indices_input.strip() else []
            multiplier = float(input("Multiplier: "))
            
            shocks.append({
                'target': target,
                'indices': indices,
                'multiplier': multiplier
            })
        
        # Generate a simple test SAM
        print("\nGenerating test SAM...")
        total_size = sectors_count + factors_count + households_count
        sam_data = [[0.0 for _ in range(total_size)] for _ in range(total_size)]
        
        # Fill in some basic values for testing
        # Consumer demand for goods
        for i, sector in enumerate(sectors):
            for j, household in enumerate(households):
                sam_data[i][sectors_count + factors_count + j] = 5.0 + i + j
        
        # Factor payments
        for i, sector in enumerate(sectors):
            sam_data[sectors_count][i] = 4.0 + i  # LAB to sectors
            sam_data[sectors_count + 1][i] = 6.0 + i  # CAP to sectors
        
        # Factor endowments
        for i, household in enumerate(households):
            sam_data[sectors_count + factors_count + i][sectors_count] = 10.0 + i  # Households to LAB
        
        
        # Solve the model
        results = solve_mn1_core(
            sectors=sectors,
            factors=factors,
            households=households,
            sam_data=sam_data,
            prices=prices,
            wage=wage,
            alpha_params=alpha_params,
            beta_params=beta_params,
            tech_params=tech_params,
            closure_rules=closure_rules,
            shocks=shocks,
            auto_calibrate=auto_calibrate
        )
        
       
    except ValueError as e:
        print(f"❌ Input error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Model solving error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

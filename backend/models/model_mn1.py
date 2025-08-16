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


@dataclass
class ClosureRule:
    """Represents a model closure rule."""

    variable: str
    indices: list[str]
    value: float


class ClosureRuleBuilder:
    """Collects and applies closure rules to the model."""

    def __init__(self) -> None:
        self.rules: list[ClosureRule] = []

    def add_rule(self, variable: str, indices: list[str], value: float) -> None:
        self.rules.append(ClosureRule(variable, indices, value))

    def remove_rule(self, index: int) -> None:
        if 0 <= index < len(self.rules):
            self.rules.pop(index)

    def list_rules(self) -> list[str]:
        return [
            f"{i}: {r.variable}[{','.join(r.indices) if r.indices else 'all'}] = {r.value}"
            for i, r in enumerate(self.rules)
        ]

    def apply(self, var_map: dict[str, Variable]) -> None:
        for rule in self.rules:
            var = var_map.get(rule.variable)
            if var is None:
                continue
            if rule.indices:
                var.fx[tuple(rule.indices)] = rule.value
            else:
                var.fx[...] = rule.value


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
            f"{i}: {s.target}[{','.join(s.indices) if s.indices else 'all'}] *= {s.multiplier}"
            for i, s in enumerate(self.shocks)
        ]

    def apply(self, obj_map: dict[str, Parameter | Variable]) -> None:
        for shock in self.shocks:
            obj = obj_map.get(shock.target)
            if obj is None:
                continue
            if shock.indices:
                obj[tuple(shock.indices)] = obj[tuple(shock.indices)] * shock.multiplier
            else:
                obj[...] = obj[...] * shock.multiplier


sam_path = input("Enter the path to your SAM Excel file (e.g., SAM_221.xls): ").strip()
if not sam_path:
    sam_path = "SAM_221.xls"  # Default path if none provided

# Read the SAM from Excel
sam_data = pd.read_excel(sam_path, sheet_name=0, header=0, index_col=0).fillna(0).stack().reset_index()
sam_data.columns = ['n1', 'n2', 'value']

n1_data = sam_data.n1.unique()

ind_no = int(input("How many industries are there in the system?"))
inds_data = n1_data[:ind_no]

cons_no = int(input("How many consumers are there in the system?"))
consumers_data = n1_data[-cons_no:]


# Set up the container
m = Container()

# Define the sets
n1        = Set(m, name="n1"                             , records=n1_data       )
inds      = Set(m, name="inds"     , domain=n1           , records=inds_data     )
consumers = Set(m, name="consumers", domain=n1           , records=consumers_data)

n2 = Alias(m, name="n2", alias_with=n1)

# Define the parameters
A         = Parameter(m, name="A"        , domain=inds                      , description="Shift parameter in the production function of firms"               )
BETA      = Parameter(m, name="BETA"     , domain=[consumers, inds]         , description="Share parameter in the utility function of consumers"              )
ALPHA     = Parameter(m, name="ALPHA"    , domain=inds                      , description="Labour input elasticity of output in firms"                        )
XDO       = Parameter(m, name="XDO"      , domain=[inds, consumers]         , description="Demand of goods by consumers in the benchmark situation (volume)"  )
PO        = Parameter(m, name="PO"       , domain=inds                      , description="Price of goods in the benchmark situation"                         )
WO        = Parameter(m, name="WO"                                          , description="Wage rate in the benchmark situation"                              )
XSO       = Parameter(m, name="XSO"      , domain=inds                      , description="Supply of goods in the benchmark situation (volume)"               )
RO        = Parameter(m, name="RO"       , domain=consumers                 , description="Income of consumers in the benchmark situation (volume)"           )
LDO       = Parameter(m, name="LDO"      , domain=inds                      , description="Labour demand of firms in the benchmark situation (volume)"        )
LSO       = Parameter(m, name="LSO"      , domain=consumers                 , description="Labour endowment of consumer A in the benchmark situation (volume)")
PROFITO   = Parameter(m, name="PROFITO"  , domain=inds                      , description="Profit of firm 1 in the benchmark situation (value)"               )
PROFITOTO = Parameter(m, name="PROFITOTO"                                   , description="Total profits of firms in the benchmark situation (value)"         )
LAMBDA    = Parameter(m, name="LAMBDA"   , domain=consumers                 , description="Share of consumer A in total profit in the benchmark situation"    )
SAM221    = Parameter(m, name="SAM221"   , domain=[n1, n2], records=sam_data, description="Base run SAM before solving the model"                             )
                                

print("\nSetting the prices of the commodities in the benchmark situation.")
prices = []
for ind in inds_data:
    prices.append(float(input(f"Enter the price for >{ind}< in the benchmark situation: ").strip()))

wage_rate = float(input("\nEnter the wage rate in the benchmark situation: ").strip())

# STARTING THE CALIBRATION OF THE MODEL 
PO.setRecords(np.array(prices))
WO[...] = wage_rate

XDO[inds, consumers] = SAM221[inds, consumers] / PO[inds]

LSO[consumers]        = SAM221[consumers, "LAB"] / WO

RO[consumers]         = Sum(inds, PO[inds] * XDO[inds, consumers])

XSO[inds]            = Sum(consumers, XDO[inds, consumers])

LDO[inds]             = SAM221["LAB", inds] / WO

PROFITO[inds]         = SAM221['CAP', inds] 

PROFITOTO[...]        = Sum(inds, PROFITO[inds])

LAMBDA[consumers]     = (RO[consumers] - WO*LSO[consumers])/PROFITOTO


# calibrate = False
calibrate = input("\nDo you want to auto-calibrate the model? (y/n): ").strip().lower()
if calibrate == 'y':
    calibrate = True
elif calibrate == 'n':
    calibrate = False
else:
    print("Invalid input. Defaulting to calibrating the model.")
    calibrate = True

if calibrate:
    BETA[consumers, inds] = PO[inds] * XDO[inds, consumers] / RO[consumers]
    ALPHA[inds]           = WO * LDO[inds] / XSO[inds] / PO[inds]
    A[inds]               = XSO[inds] * rpower(LDO[inds], -ALPHA[inds])

else:
    print("\nYou have chosen not to calibrate the model. Please enter the parameters manually.")
    print("Start with Beta (the Share parameter in the utility function) for:")
    beta_input = []
    for cons in consumers_data:
        temp = []
        for ind in inds_data:
            temp.append(float(input(f"Consumer >{cons}< and Commodity >{ind}<: ").strip()))
        beta_input.append(temp)

    print("\nNext, enter the Labour input elasticity of output in firms (ALPHA):")
    alpha_input = []
    for ind in inds_data:
        alpha_input.append(float(input(f"Industry >{ind}< and Commodity >{ind}<: ").strip()))

    print("\n Finally, enter the Shift parameter in the production function (A) for:")
    a_input = []
    for ind in inds_data:
        a_input.append(float(input(f"Industry >{ind}< and Commodity >{ind}<: ").strip()))


    print(alpha_input)
    BETA.setRecords(np.array(beta_input))
    ALPHA.setRecords(np.array(alpha_input))
    A.setRecords(np.array(a_input))


# DECLARING THE MODEL VARIABLES AND EQUATIONS

# POSITIVE VARIABLES

XD       = Variable(m, name="XD"      , type="positive", domain=XDO.domain    , description="Demand of goods by Consumers (volume)")
R        = Variable(m, name="R"       , type="positive", domain=RO.domain     , description="Income of consumers"                  )
PROFITOT = Variable(m, name="PROFITOT", type="positive"                       , description="Total profit"                         )
XS       = Variable(m, name="XS"      , type="positive", domain=XSO.domain    , description="Supply of goods"                      )
LD       = Variable(m, name="LD"      , type="positive", domain=LDO.domain    , description="Labour demand of Firms (volume)"      )
PROFIT   = Variable(m, name="PROFIT"  , type="positive", domain=PROFITO.domain, description="Profit of firms"                      )
P        = Variable(m, name="P"       , type="positive", domain=PO.domain     , description="Price of goods"                       )
W        = Variable(m, name="W"       , type="positive"                       , description="Wage rate"                            )
LS       = Variable(m, name="LS"      , type="positive", domain=LSO.domain    , description="Labour endowment of Consumer A"       )

# FREE Variables
OMEGA = Variable(m, "OMEGA", description="Dummy variable to maximize")
LEON = Variable(m, "LEON", description="Check of Walras law")

# EQUATIONS
EqXD       = Equation(m, name="EqXD"      , domain=XD.domain, description="Demand of goods by consumers (volume)")
EqR        = Equation(m, name="EqR"       , domain=R.domain , description="Definition of income of consumers"    )
EqPROFITOT = Equation(m, name="EqPROFITOT"                  , description="Definition of total profit"           )
EqXS       = Equation(m, name="EqXS"      , domain=inds     , description="Supply of goods"                      )
EqLD       = Equation(m, name="EqLD"      , domain=inds     , description="Labour demand of firms (volume)"      )
EqPROFIT   = Equation(m, name="EqPROFIT"  , domain=inds     , description="Profit of firm 1"                     )
EQB        = Equation(m, name="EQB"       , domain=inds     , description="Equilibrium condition of goods"       )
EQLAB      = Equation(m, name="EQLAB"                       , description="Labour market equilibrium condition"  )
OBJ        = Equation(m, name="OBJ"                         , description="Objective function"                   )


# EQUATION SPECIFICATION

EqXD[inds, consumers]                   = XD[inds, consumers] == BETA[consumers, inds]*R[consumers]/P[inds]

EqR[consumers]                          = R[consumers] == W*LS[consumers] + LAMBDA[consumers]*PROFITOT

EqPROFITOT[...]                         = PROFITOT == Sum(inds, PROFIT[inds])

EqXS[inds]                              = XS[inds] == A[inds]* rpower(LD[inds], ALPHA[inds])

EqLD[inds]                              = W*LD[inds] == ALPHA[inds]*P[inds]*XS[inds]

EqPROFIT[inds]                          = PROFIT[inds] == P[inds]*XS[inds] - W*LD[inds]

EQB[inds].where[Ord(inds) < Card(inds)] = XS[inds] == Sum(consumers, XD[inds, consumers])

EQLAB[...]                              = Sum(consumers, LS[consumers]) == Sum(inds, LD[inds])

OBJ[...]                                = OMEGA == 10


# INITIALISATION
XD.l[inds, consumers]  = XDO[inds, consumers]
XD.lo[inds, consumers] = XDO[inds, consumers] * 0.001

R.l[consumers]  = RO[consumers]
R.lo[consumers] = RO[consumers] * 0.001

PROFITOT.l[...]  =  PROFITOTO
PROFITOT.lo[...] =  PROFITOTO * 0.001

XS.l[inds]  = XSO[inds]
XS.lo[inds] = XSO[inds] * 0.001

LD.l[inds]  = LDO[inds]
LD.lo[inds] = LDO[inds] * 0.001

PROFIT.l[inds]  = PROFITO[inds]
PROFIT.lo[inds] = PROFITO[inds] * 0.001

P.l[inds]  = PO[inds]
P.lo[inds] = PO[inds] * 0.001

W.l[...]  = WO
W.lo[...] = WO * 0.001

LS.l[consumers]  = LSO[consumers]
LS.lo[consumers] = LSO[consumers] * 0.001


# CLOSURE RULES
closure_builder = ClosureRuleBuilder()
print("\nDefine closure rules (type 'done' to finish):")
while True:
    var_name = input("Variable to fix (or 'done'): ").strip()
    if var_name.lower() == "done" or var_name == "":
        break
    idx_text = input("Indices (comma separated, blank for all): ").strip()
    value = float(input("Fixed value: ").strip())
    idx_list = [i.strip() for i in idx_text.split(",") if i.strip()]
    closure_builder.add_rule(var_name, idx_list, value)
    print("Current closure rules:")
    for rule in closure_builder.list_rules():
        print(f"\t{rule}")
    rem = input("Enter index to remove a rule or press Enter to continue: ").strip()
    if rem:
        closure_builder.remove_rule(int(rem))

var_map = {
    "XD": XD,
    "R": R,
    "PROFITOT": PROFITOT,
    "XS": XS,
    "LD": LD,
    "PROFIT": PROFIT,
    "P": P,
    "W": W,
    "LS": LS,
}
closure_builder.apply(var_map)


# Set the options for the model
# These options control the solver behavior and output details
options = Options.fromGams({"ITERLIM": 10000, "RESLIM": 10000, "LIMCOL": 1, "LIMROW": 1, "NLP": "CONOPT", "holdfixed": 1})

# Declare the model
MOD221_CAL = Model(m, name="MOD221_CAL", problem="NLP", equations=m.getEquations(), sense="MIN", objective=OMEGA)

# Apply shocks
shock_builder = ShockBuilder()
print("\nDefine shocks (type 'done' to finish):")
while True:
    target = input("Target parameter/variable (or 'done'): ").strip()
    if target.lower() == "done" or target == "":
        break
    idx_text = input("Indices (comma separated, blank for all): ").strip()
    mult = float(input("Multiplier (e.g., 1.1 for +10%): ").strip())
    idx_list = [i.strip() for i in idx_text.split(",") if i.strip()]
    shock_builder.add_shock(target, idx_list, mult)
    print("Current shocks:")
    for s in shock_builder.list_shocks():
        print(f"\t{s}")
    rem = input("Enter index to remove a shock or press Enter to continue: ").strip()
    if rem:
        shock_builder.remove_shock(int(rem))

obj_map = {
    "XD": XD,
    "R": R,
    "PROFITOT": PROFITOT,
    "XS": XS,
    "LD": LD,
    "PROFIT": PROFIT,
    "P": P,
    "W": W,
    "LS": LS,
    "A": A,
    "BETA": BETA,
    "ALPHA": ALPHA,
}
shock_builder.apply(obj_map)

# Solve the model
MOD221_CAL.solve(options=options)

if not MOD221_CAL.status in [ModelStatus.OptimalGlobal, ModelStatus.OptimalLocal]:
    raise Exception(f"Model did not solve optimally. Status: {MOD221_CAL.status}")

# Report changes in parameters
VX           = Parameter(m, name="VX"         , domain=[consumers, inds], description="Change in Consumers demand for products"            )
VR           = Parameter(m, name="VR"         , domain=consumers        , description="Change in Consumers revenue"                        )
VPROFITOT    = Parameter(m, name="VPROFITOT"                            , description="Change in Total Profit"                             )
VS           = Parameter(m, name="VS"         , domain=inds             , description="Change in Supply of products"                       )
VWLS         = Parameter(m, name="VWLS"       , domain=consumers        , description="Change in Labor expenses of companies"              )
VPROFIT      = Parameter(m, name="VPROFIT"    , domain=inds             , description="Change in Profit of companies"                      )
VP           = Parameter(m, name="VP"         , domain=inds             , description="Change in Price of products"                        )
VW           = Parameter(m, name="VW"                                   , description="Change in Wages"                                    )
VLD          = Parameter(m, name="VLD"        , domain=inds             , description="Change in Labor demand of companies"                )
VPROFICONS   = Parameter(m, name="VPROFICONS" , domain=consumers        , description="Change in Share of consumer A from the firms profit")
VLS          = Parameter(m, name="VLS"        , domain=consumers        , description="Change in Labor supply of consumer A"               )


VX[consumers, inds]   = (XD.l - XDO)                                 / XDO
VR[consumers]         = (R.l - RO)                                   / RO
VPROFITOT[...]        = (PROFITOT.l - PROFITOTO)                     / PROFITOTO
VS[inds]              = (XS.l - XSO)                                 / XSO
VWLS[consumers]       = (W.l*LS.l - (WO*LSO))                        / (WO*LSO)
VPROFIT[inds]         = (PROFIT.l - PROFITO)                         / PROFITO
VP[inds]              = (P.l - PO)                                   / PO
VW[...]               = (W.l - WO)                                   / WO
VLD[inds]             = (LD.l - LDO)                                 / LDO
VPROFICONS[consumers] = (LAMBDA * PROFITOT.l - (LAMBDA * PROFITOTO)) / (LAMBDA * PROFITOTO)
VLS[consumers]        = (LS.l - LSO)                                 / LSO



reporting_vars = [VX, VR, VPROFITOT, VS, VWLS, VPROFIT, VP, VW, VLD, VPROFICONS, VLS]
report = {}

for rep_var in reporting_vars:
    if rep_var.number_records == 0:
        continue
    if len(rep_var.domain) == 0:
        print(f"{rep_var.description}: {round(rep_var.toValue() * 100, 1)}%\n")
        continue
    print(rep_var.description)
    if len(rep_var.domain) == 1:
        for val in rep_var.toList():
            print(f"\t{val[0]}: {round(val[1] * 100, 1)}%")
    elif len(rep_var.domain) == 2:
        for val in rep_var.toList():
            print(f"\t{val[0]} - {val[1]}: {round(val[2] * 100, 1)}%")
    else:
        print("*****************************************************************************************")

    print()

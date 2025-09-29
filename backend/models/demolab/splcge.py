"""
A Simple CGE Model in Ch. 5 (SPLCGE,SEQ=275)


# Hosoe, N, Gasawa, K, and Hashimoto, H
# Handbook of Computible General Equilibrium Modeling
# University of Tokyo Press, Tokyo, Japan, 2004"
"""

import numpy as np

from gamspy import Container
from gamspy import Model
from gamspy import Set
from gamspy import Alias
from gamspy import Parameter
from gamspy import Variable
from gamspy import Equation
from gamspy import Product
from gamspy import Sum


class data:
    SAM_entry = ["BRD", "MLK", "CAP", "LAB", "HOH"]
    goods     = ["BRD", "MLK"]
    factors   = ["CAP", "LAB"]

    SAM_data = np.array(
        [
            [0 , 0 , 0 , 0 , 15],
            [0 , 0 , 0 , 0 , 35],
            [5 , 20, 0 , 0 ,  0],
            [10, 15, 0 , 0 ,  0],
            [0 , 0 , 25, 25,  0]
        ]
    )


def _round_dicts(dictionary, decimals=2):
    return {k: round(v, decimals) for k, v in dictionary.items()}


def base_model():
    """
    Build the Simple CGE Model.
    """

    m = Container()

    u = Set(m, name="u", records=data.SAM_entry, description="SAM entry")
    i = Set(m, name="i", domain=u, records=data.goods, description="goods")    
    h = Set(m, name="h", domain=u, records=data.factors, description="factor")   

    v = Alias(m, name="v", alias_with=u)
    j = Alias(m, name="j", alias_with=i)
    k = Alias(m, name="k", alias_with=h)

    SAM = Parameter(m, name="SAM", domain=[u, v], records=data.SAM_data, description="Social Accounting Matrix")

    # Loading the initial values
    X0 = Parameter(m, name="X0", domain=i, description="household consumption of the i-th good")
    F0 = Parameter(m, name="F0", domain=[h, j], description="the h-th factor input by the j-th firm")
    Z0 = Parameter(m, name="Z0", domain=j, description="output of the j-th good")
    FF = Parameter(m, name="FF", domain=h, description="factor endowment of the h-th factor")

    X0[i]    = SAM[i, "HOH"]
    F0[h, j] = SAM[h, j]
    Z0[j]    = Sum(h, F0[h, j])
    FF[h]    = SAM["HOH", h]


    # Calibration Parameters

    alpha = Parameter(m, name="alpha", domain=i, description="share parameter in utility function")
    beta  = Parameter(m, name="beta", domain=[h, j], description="share parameter in production function")
    b     = Parameter(m, name="b", domain=j, description="scale parameter in production function")

    beta[h, j] = F0[h, j] / Sum(k, F0[k, j])


    # Variables

    X  = Variable(m, name="X", domain=i, description="household consumption of the i-th good")
    F  = Variable(m, name="F", domain=[h, j], description="the h-th factor input by the j-th firm")
    Z  = Variable(m, name="Z", domain=j, description="output of the j-th good")
    px = Variable(m, name="px", domain=i, description="demand price of the i-th good")
    pz = Variable(m, name="pz", domain=j, description="supply price of the i-th good")
    pf = Variable(m, name="pf", domain=h, description="the h-th factor price")
    UU = Variable(m, name="UU", description="utility [fictitious]")


    # Equations

    eqX  = Equation(m, name="eqX", domain=i, description="household demand function")
    eqpz = Equation(m, name="eqpz", domain=i, description="production function")
    eqF  = Equation(m, name="eqF", domain=[h, j], description="factor demand function")
    eqpx = Equation(m, name="eqpx", domain=i, description="good market clearing condition")
    eqpf = Equation(m, name="eqpf", domain=h, description="factor market clearing condition")
    eqZ  = Equation(m, name="eqZ", domain=i, description="price equation")
    obj  = Equation(m, name="obj", description="utility function [fictitious]")

    eqX[i]     =  X[i]     ==   alpha[i]*Sum(h, pf[h]*FF[h])/px[i]

    eqpz[j]    =  Z[j]     ==   b[j]*Product(h, F[h, j]**beta[h, j])

    eqF[h, j]  =  F[h, j]  ==   beta[h, j]*pz[j]*Z[j]/pf[h]

    eqpx[i]    =  X[i]     ==   Z[i]

    eqpf[h]    =  Sum(j, F[h, j]) == FF[h]

    eqZ[i]     =  px[i]    ==   pz[i]

    obj[...]   =  UU       ==   Product(i, X[i]**alpha[i])


    # Initializing variables
    X.l[i]    = X0[i]
    F.l[h, j] = F0[h, j]
    Z.l[j]    = Z0[j]
    px.l[i]   = 1
    pz.l[j]   = 1
    pf.l[h]   = 1


    # Setting lower bounds to avoid division by zero
    X.lo[i]    = 0.001
    F.lo[h, j] = 0.001
    Z.lo[j]    = 0.001
    px.lo[i]   = 0.001
    pz.lo[j]   = 0.001
    pf.lo[h]   = 0.001

    pf.fx["LAB"] = 1

    splcge = Model(m, "splcge", "", "NLP", m.getEquations(), "MAX", UU)

    return m, splcge


def add_input_solve(b_input: list, alpha_input: list):
    """
    Adds the input data to the model and solves it.
    """

    container, model = base_model()

    alpha_input = np.array(alpha_input)
    b_input = np.array(b_input)

    container["alpha"].setRecords(alpha_input)
    container["b"].setRecords(b_input)

    model.solve()

    return container



def write_output(container):
    """
    Writes the relevant output from the container.
    """

    px = container["px"]
    Z = container["Z"]

    print("Price of products: ", _round_dicts(px.toDict()))
    print("Amount produced : ", _round_dicts(Z.toDict(), 0))


if __name__ == "__main__":
    alpha_input = [0.9, 0.1]
    b_input = [3.6, 2]

    container = add_input_solve(b_input, alpha_input)

    write_output(container)



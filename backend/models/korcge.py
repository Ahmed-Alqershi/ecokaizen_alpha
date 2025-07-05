import os
import numpy as np
import pandas as pd
from gamspy import Container, Set, Alias, Parameter, Variable, Equation, Model, Sum, Product, Number
from gamspy.math import sign

# Path to the Excel data used by the model.  Using an absolute path makes the
# module independent of the current working directory.
DATA_PATH = os.path.join(os.path.dirname(__file__), "korcge_export.xlsx")


class data:
    """Data class for the KOR-CGE model."""
    sectors = pd.read_excel(DATA_PATH, sheet_name="i", header=None, index_col=None)[0].tolist()
    households = pd.read_excel(DATA_PATH, sheet_name="hh", header=None, index_col=None)[0].tolist()
    labor_cats = pd.read_excel(DATA_PATH, sheet_name="lc", header=None, index_col=None)[0].tolist()
    income_tax_hh = pd.read_excel(DATA_PATH, sheet_name="htax", header=None, index_col=None).to_dict()
    labor_shares = pd.read_excel(DATA_PATH, sheet_name="alphl", header=None, index_col=None).to_dict()
    input_output_matrix = pd.read_excel(DATA_PATH, sheet_name="io", header=None, index_col=None).to_dict()
    capital_composition_matrix = pd.read_excel(DATA_PATH, sheet_name="imat", header=None, index_col=None).to_dict()
    wage_rates = pd.read_excel(DATA_PATH, sheet_name="wdist", header=None, index_col=None).to_dict()
    private_consumption_shares = pd.read_excel(DATA_PATH, sheet_name="cles", header=None, index_col=None).to_dict()
    misc_params = pd.read_excel(DATA_PATH, sheet_name="zz", header=None, index_col=None).to_dict()
    summ_mat_sect_employment = pd.read_excel(DATA_PATH, sheet_name="labres1", header=None, index_col=None).to_dict()
    summ_mat_aggrg_employment = pd.read_excel(DATA_PATH, sheet_name="labres2", header=None, index_col=None).to_dict()
    summ_mat_aggrg_employment = pd.read_excel(DATA_PATH, sheet_name="labres2", header=None, index_col=None).to_dict()
    summ_mat_hh_res = pd.read_excel(DATA_PATH, sheet_name="hhres", header=None, index_col=None).to_dict()
    summ_mat_sec_res = pd.read_excel(DATA_PATH, sheet_name="sectres", header=None, index_col=None).to_dict()


m = Container()

# SETS #

i    = Set(m, name="i",            records=data.sectors,    description="sectors")
hh   = Set(m, name="hh",           records=data.households, description="household type")
lc   = Set(m, name="lc",           records=data.labor_cats, description="labor categories")
it   = Set(m, name="it",  domain=i,                         description="traded sectors")
ints = Set(m, name="int", domain=i,                         description="nontraded sectors")

j = Alias(m, name="j", alias_with=i)


# PARAMETERS #

htax  = Parameter(m, name="htax",  domain=hh,      records=data.income_tax_hh,              description="income tax rate by household type")
alphl = Parameter(m, name="alphl", domain=[i, lc], records=data.labor_shares,               description="labor share parameter in production function")
io    = Parameter(m, name="io",    domain=[i,j],   records=data.input_output_matrix,        description="input-output coefficients")
imat  = Parameter(m, name="imat",  domain=[i,j],   records=data.capital_composition_matrix, description="capital composition matrix")
wdist = Parameter(m, name="wdist", domain=[i,lc],  records=data.wage_rates,                 description="wage proportionality factors")
cles  = Parameter(m, name="cles",  domain=[i,hh],  records=data.private_consumption_shares, description="private consumption shares")
zz    = Parameter(m, name="zz",    domain=["*",i], records=data.misc_params,                description="miscellaneous parameters")

delta = Parameter(m, name="delta", domain=i, description="Armington function share parameter")
ac    = Parameter(m, name="ac",    domain=i, description="Armington function shift parameter")
rhoc  = Parameter(m, name="rhoc",  domain=i, description="Armington function exponent")
rhot  = Parameter(m, name="rhot",  domain=i, description="cet function exponent")
at    = Parameter(m, name="at",    domain=i, description="cet function shift parameter")
gamma = Parameter(m, name="gamma", domain=i, description="cet function share parameter")
ad    = Parameter(m, name="ad",    domain=i, description="production function shift parameter")
gles  = Parameter(m, name="gles",  domain=i, description="government consumption shares")
depr  = Parameter(m, name="depr",  domain=i, description="depreciation rates")
dstr  = Parameter(m, name="dstr",  domain=i, description="ratio of inventory investment to gross output")
kio   = Parameter(m, name="kio",   domain=i, description="shares of investment by sector of destination")
te    = Parameter(m, name="te",    domain=i, description="export duty rates")
itax  = Parameter(m, name="itax",  domain=i, description="indirect tax rates")
pwm   = Parameter(m, name="pwm",   domain=i, description="world market price of imports    (in dollars)")
pwe   = Parameter(m, name="pwe",   domain=i, description="world market price of exports    (in dollars)")
tm    = Parameter(m, name="tm",    domain=i, description="tariff rates on imports")
pwts  = Parameter(m, name="pwts",  domain=i, description="cpi weights")

depr[i]  = zz["depr",i]
itax[i]  = zz["itax",i]
gles[i]  = zz["gles",i]
kio[i]   = zz["kio",i]
dstr[i]  = zz["dstr",i]
te[i]    = zz["te",i]
tm[i]    = zz["tm",i]
ad[i]    = zz["ad",i]
pwts[i]  = zz["pwts",i]
pwm[i]   = zz["pwm",i]
pwe[i]   = zz["pwe",i]
rhoc[i]  = (1/zz["sigc",i]) - 1 
delta[i] = zz["delta",i]
ac[i]    = zz["ac",i]
rhot[i]  = (1/zz["sigt",i]) + 1
gamma[i] = zz["gamma",i]
at[i]    = zz["at",i]


# VARIABLES #

# prices block
er     = Variable(m, name="er",            description="real exchange rate                          (won per dollar)")
pd1    = Variable(m, name="pd1", domain=i, description="domestic prices")
pm     = Variable(m, name="pm",  domain=i, description="domestic price of imports")
pe     = Variable(m, name="pe",  domain=i, description="domestic price of exports")
pk     = Variable(m, name="pk",  domain=i, description="rate of capital rent by sector")
px     = Variable(m, name="px",  domain=i, description="average output price by sector")
p      = Variable(m, name="p",   domain=i, description="price of composite goods")
pva    = Variable(m, name="pva", domain=i, description="value added price by sector")
pr     = Variable(m, name="pr",            description="import premium")
pindex = Variable(m, name="pindex",        description="general price level")

# production block
x   = Variable(m, name="x",   domain=i, description="composite goods supply                        ('68 bill won)")
xd  = Variable(m, name="xd",  domain=i, description="domestic output by sector                     ('68 bill won)")
xxd = Variable(m, name="xxd", domain=i, description="domestic sales                                ('68 bill won)")
e   = Variable(m, name="e",   domain=i, description="exports by sector                             ('68 bill won)")
m1  = Variable(m, name="m1",  domain=i, description="imports                                       ('68 bill won)")

# factors block
k  = Variable(m, name="k",  domain=i,      description="capital stock by sector                       ('68 bill won)")
wa = Variable(m, name="wa", domain=lc,     description="average wage rate by labor category     (mill won pr person)")
ls = Variable(m, name="ls", domain=lc,     description="labor supply by labor category                (1000 persons)")
l  = Variable(m, name="l",  domain=[i,lc], description="employment by sector and labor category       (1000 persons)")

# demand block
int1     = Variable(m, name="int1", domain=i,  description="intermediates uses                            ('68 bill won)")
cd       = Variable(m, name="cd",   domain=i,  description="final demand for private consumption          ('68 bill won)")
gd       = Variable(m, name="gd",   domain=i,  description="final demand for government consumption       ('68 bill won)")
id       = Variable(m, name="id",   domain=i,  description="final demand for productive investment        ('68 bill won)")
dst      = Variable(m, name="dst",  domain=i,  description="inventory investment by sector                ('68 bill won)")
y        = Variable(m, name="y",               description="private gdp                                       (bill won)")
gr       = Variable(m, name="gr",              description="government revenue                                (bill won)")
tariff   = Variable(m, name="tariff",          description="tariff revenue                                    (bill won)")
indtax   = Variable(m, name="indtax",          description="indirect tax revenue                              (bill won)")
netsub   = Variable(m, name="netsub",          description="export duty revenue                               (bill won)")
gdtot    = Variable(m, name="gdtot",           description="total volume of government consumption        ('68 bill won)")
hhsav    = Variable(m, name="hhsav",           description="total household savings                           (bill won)")
govsav   = Variable(m, name="govsav",          description="government savings                                (bill won)")
deprecia = Variable(m, name="deprecia",        description="total depreciation expenditure                    (bill won)")
invest   = Variable(m, name="invest",          description="total investment                                  (bill won)")
savings  = Variable(m, name="savings",         description="total savings                                     (bill won)")
mps      = Variable(m, name="mps",  domain=hh, description="marginal propensity to save by household type               ")
fsav     = Variable(m, name="fsav",            description="foreign savings                               (bill dollars)")
dk       = Variable(m, name="dk",   domain=i,  description="volume of investment by sector of destination ('68 bill won)")
ypr      = Variable(m, name="ypr",             description="total premium income accruing to capitalists      (bill won)")
remit    = Variable(m, name="remit",           description="net remittances from abroad                   (bill dollars)")
fbor     = Variable(m, name="fbor",            description="net flow of foreign borrowing                 (bill dollars)")
yh       = Variable(m, name="yh",   domain=hh, description="total income by household type                    (bill won)")
tothhtax = Variable(m, name="tothhtax",        description="household tax revenue                             (bill won)")

# welfare indicator for objective function
omega = Variable(m, name="omega",              description="objective function variable                   ('68 bill won)")


er.l[...]       =    1.0000
pr.l[...]       =    0.0000
pindex.l[...]   =    1.0000
gr.l[...]       =  194.0449
tariff.l[...]   =   28.6572
indtax.l[...]   =   65.2754
netsub.l[...]   =    0.0000
gdtot.l[...]    =  141.1519
hhsav.l[...]    =   61.4089
govsav.l[...]   =   52.8930
deprecia.l[...] =    0.0000
savings.l[...]  =  159.1419
invest.l[...]   =  159.1419
fsav.l[...]     =   39.1744
fbor.l[...]     =   58.7590
remit.l[...]    =    0.0000
tothhtax.l[...] =  100.1122
y.l[...]        = 1123.5941



labres1 = Parameter(m, name="labres1", domain=[i,lc],   records=data.summ_mat_sect_employment,  description= "summary matrix with sectoral employment results")
labres2 = Parameter(m, name="labres2", domain=["*",lc], records=data.summ_mat_aggrg_employment, description= "summary matrix with aggregate employment results")
hhres   = Parameter(m, name="hhres",   domain=["*",hh], records=data.summ_mat_hh_res,           description= "summary matrix with household results")
sectres = Parameter(m, name="sectres", domain=["*",i],  records=data.summ_mat_sec_res,          description= "summary matrix with sectoral results")


l.l[i,lc] = labres1[i,lc]
ls.l[lc]  = labres2["ls",lc]
wa.l[lc]  = labres2["wa",lc]
mps.l[hh] = hhres["mps",hh]
yh.l[hh]  = hhres["yh",hh]


pd1.l[i]    = sectres["pd",i]
pm.l[i]     = sectres["pm",i]
pe.l[i]     = sectres["pe",i]
pk.l[i]     = sectres["pk",i]
px.l[i]     = sectres["px",i]
p.l[i]      = sectres["p",i]
pva.l[i]    = sectres["pva",i]
x.l[i]      = sectres["x",i]
xd.l[i]     = sectres["xd",i]
xxd.l[i]    = sectres["xxd",i]
e.l[i]      = sectres["e",i]
m1.l[i]     = sectres["m",i]
k.l[i]      = sectres["k",i]
int1.l[i]   = sectres["int",i]
cd.l[i]     = sectres["cd",i]
gd.l[i]     = sectres["gd",i]
id.l[i]     = sectres["id",i]
dst.l[i]    = sectres["dst",i]
dk.l[i]     = sectres["dk",i]
it[i]       = Number(1).where[e.l[i] | m1.l[i]]
ints[i]     = ~ it[i]
k.fx[i]     = k.l[i]
m1.fx[ints] = 0
e.fx[ints]  = 0
l.fx[i,lc].where[l.l[i,lc] == 0] = 0

p.lo[i]    = .01
pd1.lo[i]  = .01
pm.lo[it]  = .01
pk.lo[i]   = .01
px.lo[i]   = .01
x.lo[i]    = .01
xd.lo[i]   = .01
m1.lo[it]  = .01
xxd.lo[it] = .01
wa.lo[lc]  = .01
int1.lo[i] = .01
y.lo[...]  = .01
e.lo[it]   = .01
l.lo[i,lc].where[l.l[i,lc] != 0] = .01


# EQUATIONS #

# price block
pmdef      = Equation(m, name="pmdef",      domain=i, description="definition of domestic import prices")
pedef      = Equation(m, name="pedef",      domain=i, description="definition of domestic export prices")
absorption = Equation(m, name="absorption", domain=i, description="value of domestic sales             ")
sales      = Equation(m, name="sales",      domain=i, description="value of domestic output            ")
actp       = Equation(m, name="actp",       domain=i, description="definition of activity prices       ")
pkdef      = Equation(m, name="pkdef",      domain=i, description="definition of capital goods price   ")
pindexdef  = Equation(m, name="pindexdef",            description="definition of general price level   ")

# output block
activity  = Equation(m, name="activity", domain=i, description="production function")
profitmax = Equation(m, name="profitmax", domain=[i,lc], description="first order condition for profit maximum")
lmequil = Equation(m, name="lmequil", domain=lc, description="labor market equilibrium")
cet = Equation(m, name="cet", domain=i, description="cet function")
esupply = Equation(m, name="esupply", domain=i, description="export supply")
armington = Equation(m, name="armington", domain=i, description="composite good aggregation function")
costmin = Equation(m, name="costmin", domain=i, description="f.o.c. for cost minimization of composite good")
xxdsn = Equation(m, name="xxdsn", domain=i, description="domestic sales for nontraded sectors")
xsn = Equation(m, name="xsn", domain=i, description="composite good agg. for nontraded sectors")

# demand block
inteq = Equation(m, name="inteq", domain=i, description="total intermediate uses")
cdeq = Equation(m, name="cdeq", domain=i, description="private consumption behavior")
dsteq = Equation(m, name="dsteq", domain=i, description="inventory investment")
gdp = Equation(m, name="gdp", description="private gdp")
labory = Equation(m, name="labory", description="total income accruing to labor")
capitaly = Equation(m, name="capitaly", description="total income accruing to capital")
hhtaxdef = Equation(m, name="hhtaxdef", description="total household taxes collected by govt.")
gdeq = Equation(m, name="gdeq", domain=i, description="government consumption shares")
greq = Equation(m, name="greq", description="government revenue")
tariffdef = Equation(m, name="tariffdef", description="tariff revenue")
premium = Equation(m, name="premium", description="total import premium income")
indtaxdef = Equation(m, name="indtaxdef", description="indirect taxes on domestic production")
netsubdef = Equation(m, name="netsubdef", description="export duties")

# savings-investment block
hhsaveq = Equation(m, name="hhsaveq", description="household savings")
gruse = Equation(m, name="gruse", description="government savings")
depreq = Equation(m, name="depreq", description="depreciation expenditure")
totsav = Equation(m, name="totsav", description="total savings")
prodinv = Equation(m, name="prodinv", domain=i, description="investment by sector of destination")
ieq = Equation(m, name="ieq", domain=i, description="investment by sector of origin")

# balance of payments
caeq = Equation(m, name="caeq", description="current account balance (bill dollars)")

# market clearing
equil = Equation(m, name="equil", domain=i, description="goods market equilibrium")

# objective function
obj = Equation(m, name="obj", description="objective function")


# price block
pmdef[it] =       pm[it]            == pwm[it]*er*(1 + tm[it] + pr)

pedef[it] =       pe[it]            == pwe[it]*(1 + te[it])*er

absorption[i] =   p[i]*x[i]         == pd1[i]*xxd[i] + (pm[i]*m1[i]).where[it[i]]

sales[i] =        px[i]*xd[i]       == pd1[i]*xxd[i] + (pe[i]*e[i]).where[it[i]]

actp[i] =         px[i]*(1-itax[i]) == pva[i] + Sum(j, io[j,i]*p[j])

pkdef[i] =        pk[i]             == Sum(j, p[j]*imat[j,i])

pindexdef[...] =       pindex            == Sum(i, pwts[i]*p[i])

# output and factors of production block
activity[i] =     xd[i] == ad[i]*Product(lc.where[wdist[i,lc]], l[i,lc]**alphl[i,lc])  *  k[i]**(1 - Sum(lc, alphl[i,lc]))

profitmax[i,lc].where[wdist[i,lc]] =    wa[lc]*wdist[i,lc]*l[i,lc]     == xd[i]*pva[i]*alphl[i,lc]

lmequil[lc] =     Sum(i, l[i,lc]) == ls[lc]

cet[it] =         xd[it] ==  at[it]*(gamma[it]*e[it]**rhot[it]  +  (1 - gamma[it])*xxd[it]**rhot[it])**(1/rhot[it])

esupply[it] =     e[it]/xxd[it] == (pe[it]/pd1[it]*(1 - gamma[it])/gamma[it]) ** (1/(rhot[it] - 1))

armington[it] =   x[it] ==  ac[it]*(delta[it]*m1[it]**(-rhoc[it])  +  (1 - delta[it])*xxd[it]**(-rhoc[it]))**(-1/rhoc[it])

costmin[it] =     m1[it]/xxd[it] == (pd1[it]/pm[it]*delta[it]/(1 - delta[it]))  ** (1/(1 + rhoc[it]))

xxdsn[ints]  =       xxd[ints]       == xd[ints]

xsn[ints]  =         x[ints]         == xxd[ints]

# demand block
inteq[i] =        int1[i]        == Sum(j, io[i,j]*xd[j])

dsteq[i] =        dst[i]        == dstr[i]*xd[i]

cdeq[i] =         p[i]*cd[i]    == Sum(hh, cles[i,hh]*(1 - mps[hh])*yh[hh]*(1 - htax[hh]))

gdp[...]  =             y             == Sum(hh, yh[hh])

labory[...]  =          yh["lab-hh"]  == Sum(lc, wa[lc]*ls[lc]) + remit*er

capitaly[...]  =        yh["cap-hh"]  == Sum(i, pva[i]*xd[i]) - deprecia  -  Sum(lc, wa[lc]*ls[lc]) + fbor*er + ypr

hhsaveq[...]  =         hhsav         == Sum(hh, mps[hh]*yh[hh]*(1 - htax[hh]))

greq[...]  =            gr            == tariff - netsub + indtax +tothhtax

gruse[...]  =           gr            == Sum(i, p[i]*gd[i]) + govsav

gdeq[i] =         gd[i]         == gles[i]*gdtot

tariffdef[...]  =       tariff        == Sum(it, tm[it]*m1[it]*pwm[it])*er

indtaxdef[...]  =       indtax        == Sum(i,  itax[i]*px[i]*xd[i])

netsubdef[...]  =       netsub        == Sum(it, te[it]*e[it]*pwe[it])*er

premium[...]  =         ypr           == Sum(it, pwm[it]*m1[it])*er*pr

hhtaxdef[...]  =        tothhtax      == Sum(hh, htax[hh]*yh[hh])

depreq[...]  =          deprecia      == Sum(i, depr[i]*pk[i]*k[i])

totsav[...]  =          savings       == hhsav + govsav + deprecia + fsav*er

prodinv[i] =      pk[i]*dk[i]   == kio[i]*invest - kio[i]*Sum(j, dst[j]*p[j])

ieq[i] =          id[i]         == Sum(j, imat[i,j]*dk[j])

# balance of payments
caeq[...]  =            Sum(it, pwm[it]*m1[it]) == Sum(it, pwe[it]*e[it])  +  fsav + remit + fbor

# market clearing
equil[i] =        x[i]  == int1[i] + cd[i] + gd[i] + id[i] + dst[i]

# objective function
obj[...]  =             omega == Product(i.where[cles[i,"lab-hh"]], cd[i]**cles[i,"lab-hh"])


er.fx[...]      = er.l
fsav.fx[...]    = fsav.l
remit.fx[...]   = remit.l
fbor.fx[...]    = fbor.l
pindex.fx[...]  = pindex.l
mps.fx[hh]      = mps.l[hh]
gdtot.fx[...]   = gdtot.l
ls.fx[lc]       = ls.l[lc]


model1 = Model(m, name="model1", problem="NLP", equations=m.getEquations(), sense="MAX", objective=omega)


model1.solve(solver="CONOPT")


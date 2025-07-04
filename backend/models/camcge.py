import numpy as np
import pandas as pd
from gamspy import Container, Set, Alias, Parameter, Variable, Equation, Model, Sum, Product, Number
from gamspy.math import sign


class data:
    """Data class for the CAM-CGE model."""
    sectors = pd.read_excel("camcge_data.xlsx", sheet_name="i", header=0, index_col=None).columns.tolist()
    labor_cats = pd.read_excel("camcge_data.xlsx", sheet_name="lc", header=0, index_col=None).columns.tolist()
    input_output_coeffs = pd.read_excel("camcge_data.xlsx", sheet_name="io", header=0, index_col=0).fillna(0).T.unstack()
    capital_comp_matrix = pd.read_excel("camcge_data.xlsx", sheet_name="imat", header=0, index_col=0).fillna(0).T.unstack()
    misc_pars = pd.read_excel("camcge_data.xlsx", sheet_name="zz", header=0, index_col=0).fillna(0).T.unstack()
    wage_factors = pd.read_excel("camcge_data.xlsx", sheet_name="wdist", header=0, index_col=0).fillna(0).T.unstack()
    employment_per_sector = pd.read_excel("camcge_data.xlsx", sheet_name="xle", header=0, index_col=0).fillna(0).T.unstack()



m = Container()

# SETS #
i = Set(m, name="i", records=data.sectors, description="sectors")
lc = Set(m, name="lc", records=data.labor_cats, description="labor categories")
it = Set(m, name="it", domain=i, description="traded sectors")
ins = Set(m, name="ins", domain=i, description="nontraded sectors")

# Alias #
j = Alias(m, name="j", alias_with=i)

# PARAMETERS #
delta = Parameter(m, name="delta", domain=i, description="Armington function share parameter                      (unity)")
ac = Parameter(m, name="ac", domain=i, description="Armington function shift parameter                      (unity)")
rhoc = Parameter(m, name="rhoc", domain=i, description="Armington function exponent                             (unity)")
rhot = Parameter(m, name="rhot", domain=i, description="cet function exponent                                   (unity)")
at = Parameter(m, name="at", domain=i, description="cet function shift parameter                            (unity)")
gamma = Parameter(m, name="gamma", domain=i, description="cet function share parameter                            (unity)")
eta = Parameter(m, name="eta", domain=i, description="export demand elasticity                                (unity)")
ad = Parameter(m, name="ad", domain=i, description="production function shift parameter                     (unity)")
cles = Parameter(m, name="cles", domain=i, description="private consumption shares                              (unity)")
gles = Parameter(m, name="gles", domain=i, description="government consumption shares                           (unity)")
depr = Parameter(m, name="depr", domain=i, description="depreciation rates                                      (unity)")
dstr = Parameter(m, name="dstr", domain=i, description="ratio of inventory investment to gross output           (unity)")
kio = Parameter(m, name="kio", domain=i, description="shares of investment by sector of destination           (unity)")
tm0 = Parameter(m, name="tm0", domain=i, description="tariff rates                                            (unity)")
te = Parameter(m, name="te", domain=i, description="export duty rates                                       (unity)")
itax = Parameter(m, name="itax", domain=i, description="indirect tax rates                                      (unity)")
alphl = Parameter(m, name="alphl", domain=[i, lc], description="labor share parameter ins production function            (unity)")

# dummies to hold initial data
m0 = Parameter(m, name="m0", domain=i, description="volume of imports                             ('79-80 bill cfaf)")
e0 = Parameter(m, name="e0", domain=i, description="volume of exports                             ('79-80 bill cfaf)")
xd0 = Parameter(m, name="xd0", domain=i, description="volume of domestic output by sector           ('79-80 bill cfaf)")
k0 = Parameter(m, name="k0", domain=i, description="volume of capital stocks by sector            ('79-80 bill cfaf)")
id0 = Parameter(m, name="id0", domain=i, description="volume of investment by sector of origin      ('79-80 bill cfaf)")
dst0 = Parameter(m, name="dst0", domain=i, description="volume of inventory investment by sector      ('79-80 bill cfaf)")
int0 = Parameter(m, name="int0", domain=i, description="volume of intermediate input demands          ('79-80 bill cfaf)")
xxd0 = Parameter(m, name="xxd0", domain=i, description="volume of domestic sales by sector            ('79-80 bill cfaf)")
x0 = Parameter(m, name="x0", domain=i, description="volume of composite good supply               ('79-80 bill cfaf)")
pwe0 = Parameter(m, name="pwe0", domain=i, description="world market price of exports                            (unity)")
pwm0 = Parameter(m, name="pwm0", domain=i, description="world market price of imports                            (unity)")
pd0 = Parameter(m, name="pd0", domain=i, description="domestic good price                                      (unity)")
pe0 = Parameter(m, name="pe0", domain=i, description="domestic price of exports                                (unity)")
pm0 = Parameter(m, name="pm0", domain=i, description="domestic price of imports                                (unity)")
pva0 = Parameter(m, name="pva0", domain=i, description="value added price by sector                              (unity)")
qd = Parameter(m, name="qd", domain=i, description="dummy variable for computing ad(i)                       (unity)")
xllb = Parameter(m, name="xllb", domain=[i, lc], description="dummy variable (l matrix with no zeros)                  (unity)")
wa0 = Parameter(m, name="wa0", domain=lc, description="average wage rate by labor category ('79-80 mill cfaf pr worker)")
ld = Parameter(m, name="ld", domain=lc, description="employment                                        (1000 persons)")
ls0 = Parameter(m, name="ls0", domain=lc, description="labor supplies by category                        (1000 persons)")


# base data
wa0["rural"]      =  .11
wa0["urban_unsk"] =  .15678
wa0["urban_skil"] = 1.8657


# SCALARS #
er     = Parameter(m, name="er",     records=.21,    description="real exchange rate                   (unity)")
gr0    = Parameter(m, name="gr0",    records=179.00, description="government revenue        ('79-80 bill cfaf)")
gdtot0 = Parameter(m, name="gdtot0", records=135.03, description="government consumption    ('79-80 bill cfaf)")
cdtot0 = Parameter(m, name="cdtot0", records=947.98, description="private consumption       ('79-80 bill cfaf)")
fsav0  = Parameter(m, name="fsav0",  records=36.841, description="foreign saving         ('79-80 bill dollars)")


# TABLES #
io   = Parameter(m, name="io",   domain=[i, i], records=data.input_output_coeffs, description="input-output coefficients (unity)")
imat = Parameter(m, name="imat", domain=[i, j], records=data.capital_comp_matrix, description="capital composition matrix (unity)")

wdist = Parameter(m, name="wdist", domain=[i, lc], records=data.wage_factors, description="wage proportionality factors (unity)")

xle = Parameter(m, name="xle", domain=[i, lc], records=data.employment_per_sector, description="employment by sector and labor category (1000 persons)")

zz = Parameter(m, name="zz", domain=["*", i], records=data.misc_pars, description="miscellaneous parameters and initial data")


# Computation of parameters and coefficients for calibration
depr[i]     = zz["depr", i]
rhoc[i]     = (1/zz["rhoc", i]) - 1
rhot[i]     = (1/zz["rhot", i]) + 1
eta[i]      = zz["eta", i]
tm0[i]      = zz["tm0", i]
te[i]       = 0
#te[i]      = zz["te", i]
itax[i]     = zz["itax", i]
cles[i]     = zz["cles", i]
gles[i]     = zz["gles", i]
kio[i]      = zz["kio", i]
dstr[i]     = zz["dstr", i]
xllb[i,lc]  = xle[i, lc] + (1 - sign(xle[i, lc]))
m0[i]       = zz["m0", i]
it[i]       = Number(1).where[m0[i]]
ins[i]      = ~ it[i]
e0[i]       = zz["e0", i]
xd0[i]      = zz["xd0", i]
k0[i]       = zz["k", i]
pd0[i]      = zz["pd0", i]
pm0[i]      = pd0[i]
pe0[i]      = pd0[i]
pwm0[i]     = pm0[i]/((1 + tm0[i])*er)
pwe0[i]     = pe0[i]/((1 + te[i])*er)
pva0[i]     = pd0[i] - Sum(j, io[j,i] * pd0[j]) - itax[i]
xxd0[i]     = xd0[i] - e0[i]
dst0[i]     = zz["dst", i]
id0[i]      = zz["id", i]
ls0[lc]     = Sum(i, xle[i, lc])


# calibration of all shift and share parameters
# get delta from costmin, x0 from absorption , ac from armington

delta[it].where[m0[it]] = pm0[it]/pd0[it]*(m0[it]/xxd0[it])**(1+rhoc[it])
delta[it]               = delta[it]/(1+delta[it])
x0[i]                   = pd0[i]*xxd0[i] + (pm0[i]*m0[i]).where[it[i]]
ac[it]                  = x0[it]/(delta[it]*m0[it]**(-rhoc[it]) + (1 - delta[it])*xxd0[it]**(-rhoc[it]))**(-1/rhoc[it])


# get int0 from inteq, gamma from esupply, alphl from profitmax
int0[i]      = Sum(j, io[i,j]*xd0[j] )
gamma[it]    = 1/(1 + pd0[it]/pe0[it]*(e0[it]/xxd0[it])**(rhot[it] - 1))
gamma[ins]   = 0
alphl[i, lc]  = (wdist[i, lc]*wa0[lc]*xle[i, lc])/(pva0[i]*xd0[i])

# get ad from output, ld from  profitmax, at from cet

qd[i]  = (xllb[i,"rural"]**alphl[i, "rural"]) * (xllb[i,"urban_unsk"]**alphl[i, "urban_unsk"]) * (xllb[i,"urban_skil"]**alphl[i, "urban_skil"]) * (k0[i]**(1 - Sum(lc, alphl[i, lc])))
ad[i]  = xd0[i]/qd[i]
ld[lc] = Sum(i, (xd0[i]*pva0[i]*alphl[i, lc]/(wdist[i, lc]*wa0[lc])).where[wdist[i, lc]])
at[it] = xd0[it]/(gamma[it]*e0[it]**rhot[it] + (1 - gamma[it]) * xxd0[it]**rhot[it])**(1/rhot[it])


# VARIABLES #

# prices block
pd1 = Variable(m, name="pd1", domain=i, description="domestic prices                                            (unity)")
pm  = Variable(m, name="pm",  domain=i, description="domestic price of imports                                  (unity)")
pe  = Variable(m, name="pe",  domain=i, description="domestic price of exports                                  (unity)")
pk  = Variable(m, name="pk",  domain=i, description="rate of capital rent by sector                             (unity)")
px  = Variable(m, name="px",  domain=i, description="average output price by sector                             (unity)")
p   = Variable(m, name="p",   domain=i, description="price of composite goods                                   (unity)")
pva = Variable(m, name="pva", domain=i, description="value added price by sector                                (unity)")
pwm = Variable(m, name="pwm", domain=i, description="world market price of imports                              (unity)")
pwe = Variable(m, name="pwe", domain=i, description="world market price of exports                              (unity)")
tm  = Variable(m, name="tm",  domain=i, description="tariff rates                                               (unity)")
#  tm(it)   ''# tariff rates for traded sectors

# production block
x   = Variable(m, name="x",   domain=i, description="composite goods supply                          ('79-80 bill cfaf)")
xd  = Variable(m, name="xd",  domain=i, description="domestic output by sector                       ('79-80 bill cfaf)")
xxd = Variable(m, name="xxd", domain=i, description="domestic sales                                  ('79-80 bill cfaf)")
e   = Variable(m, name="e",   domain=i, description="exports by sector                               ('79-80 bill cfaf)")
m1  = Variable(m, name="m1",  domain=i, description="imports                                         ('79-80 bill cfaf)")

# factors block
k  = Variable(m, name="k",  domain=i,      description="capital stock by sector                         ('79-80 bill cfaf)")
wa = Variable(m, name="wa", domain=lc,     description="average wage rate by labor category    (curr mill. cfaf pr person)")
ls = Variable(m, name="ls", domain=lc,     description="labor supply by labor category                      (1000 persons)")
l  = Variable(m, name="l",  domain=[i,lc], description="employment by sector and labor category             (1000 persons)")

# demand block
int1     = Variable(m, name="int1", domain=i,   description="intermediates uses                              ('79-80 bill cfaf)")
cd       = Variable(m, name="cd",   domain=i,   description="final demand for private consumption            ('79-80 bill cfaf)")
gd       = Variable(m, name="gd",   domain=i,   description="final demand for government consumption         ('79-80 bill cfaf)")
id       = Variable(m, name="id",   domain=i,   description="final demand for productive investment          ('79-80 bill cfaf)")
dst      = Variable(m, name="dst",  domain=i,   description="inventory investment by sector                  ('79-80 bill cfaf)")
y        = Variable(m, name="y",                description="private gdp                                       (curr bill cfaf)")
gr       = Variable(m, name="gr",               description="government revenue                                (curr bill cfaf)")
tariff   = Variable(m, name="tariff",           description="tariff revenue                                    (curr bill cfaf)")
indtax   = Variable(m, name="indtax",           description="indirect tax revenue                              (curr bill cfaf)")
duty     = Variable(m, name="duty",             description="export duty revenue                               (curr bill cfaf)")
gdtot    = Variable(m, name="gdtot",            description="total volume of government consumption          ('79-80 bill cfaf)")
mps      = Variable(m, name="mps",              description="marginal propensity to save                                (unity)")
hhsav    = Variable(m, name="hhsav",            description="total household savings                           (curr bill cfaf)")
govsav   = Variable(m, name="govsav",           description="government savings                                (curr bill cfaf)")
deprecia = Variable(m, name="deprecia",         description="total depreciation expenditure                    (curr bill cfaf)")
savings  = Variable(m, name="savings",          description="total savings                                     (curr bill cfaf)")
fsav     = Variable(m, name="fsav",             description="foreign savings                                (curr bill dollars)")
dk       = Variable(m, name="dk", domain=i,     description="volume of investment by sector of destination   ('79-80 bill cfaf)")

# welfare indicator for objective function
omega = Variable(m, name="omega", description="objective function variable                     ('79-80 bill cfaf)")

p.lo[i]     = .01
pd1.lo[i]   = .01
pm.lo[it]   = .01
pk.lo[i]    = .01
px.lo[i]    = .01
x.lo[i]     = .01
m1.lo[it]   = .01
xxd.lo[it]  = .01
wa.lo[lc]   = .01
e.lo[it]    = .01
l.lo[i,lc]  = .01
y.lo[...]   = .01
xd.lo[i]    = .01
pwe.lo[it]  = .01
int1.lo[i]  = .01


# EQUATIONS #

# price block
pmdef      = Equation(m, name="pmdef",      domain=i, description="definition of domestic import prices                (unity)")
pedef      = Equation(m, name="pedef",      domain=i, description="definition of domestic export prices                (unity)")
absorption = Equation(m, name="absorption", domain=i, description="value of domestic sales                    (curr bill cfaf)")
sales      = Equation(m, name="sales",      domain=i, description="value of domestic output                   (curr bill cfaf)")
actp       = Equation(m, name="actp",       domain=i, description="definition of activity prices                       (unity)")
pkdef      = Equation(m, name="pkdef",      domain=i, description="definition of capital goods price                   (unity)")

# output block
activity  = Equation(m, name="activity",  domain=i,      description="production function                      ('79-80 bill cfaf)")
profitmax = Equation(m, name="profitmax", domain=[i,lc], description="first order condition for profit maximum     (1000 persons)")
lmequil   = Equation(m, name="lmequil",   domain=lc,     description="labor market equilibrium                     (1000 persons)")
cet       = Equation(m, name="cet",       domain=i,      description="cet function                             ('79-80 bill cfaf)")
edemand   = Equation(m, name="edemand",   domain=i,      description="export demand                                       (unity)")
esupply   = Equation(m, name="esupply",   domain=i,      description="export supply                                       (unity)")
armington = Equation(m, name="armington", domain=i,      description="composite good aggregation function      ('79-80 bill cfaf)")
costmin   = Equation(m, name="costmin",   domain=i,      description="first order condition for cost minimization of composite good (unity)")
xxdsn     = Equation(m, name="xxdsn",     domain=i,      description="domestic sales for nontraded sectors               ('79-80 bill cfaf)")
xsn       = Equation(m, name="xsn",       domain=i,      description="composite good aggregation for nontraded sectors   ('79-80 bill cfaf)")

# demand block
inteq     = Equation(m, name="inteq", domain=j, description="total intermediate uses                  ('79-80 bill cfaf)")
cdeq      = Equation(m, name="cdeq",  domain=i, description="private consumption behavior               (curr bill cfaf)")
dsteq     = Equation(m, name="dsteq", domain=i, description="inventory investment                     ('79-80 bill cfaf)")
gdp       = Equation(m, name="gdp",             description="private gdp                                (curr bill cfaf)")
gdeq      = Equation(m, name="gdeq",  domain=i, description="government consumption behavior          ('79-80 bill cfaf)")
greq      = Equation(m, name="greq",            description="government revenue                         (curr bill cfaf)")
tariffdef = Equation(m, name="tariffdef",       description="tariff revenue                             (curr bill cfaf)")
indtaxdef = Equation(m, name="indtaxdef",       description="indirect taxes on domestic production      (curr bill cfaf)")
dutydef   = Equation(m, name="dutydef",         description="export duties                              (curr bill cfaf)")

# savings-investment block
hhsaveq = Equation(m, name="hhsaveq",           description="household savings                          (curr bill cfaf)")
gruse   = Equation(m, name="gruse",             description="government savings                         (curr bill cfaf)")
depreq  = Equation(m, name="depreq",            description="depreciation expenditure                   (curr bill cfaf)")
totsav  = Equation(m, name="totsav",            description="total savings                              (curr bill cfaf)")
prodinv = Equation(m, name="prodinv", domain=i, description="investment by sector of destination        (curr bill cfaf)")
ieq     = Equation(m, name="ieq",     domain=i, description="investment by sector of origin           ('79-80 bill cfaf)")

# balance of payments
caeq = Equation(m, name="caeq", description="current account balance                  (curr bill dollar)")

# market clearing
equil = Equation(m, name="equil", domain=i, description="goods market equilibrium                 ('79-80 bill cfaf)")

# objective function
obj = Equation(m, name="obj", description="objective function                       ('79-80 bill cfaf)")


# price block
pmdef[it] =       pm[it] == pwm[it]*er*(1 + tm[it])

pedef[it] =       pe[it]*(1 + te[it]) == pwe[it]*er

absorption[i] =   p[i]*x[i]   == pd1[i]*xxd[i] + (pm[i]*m1[i]).where[it[i]]

sales[i] =        px[i]*xd[i] == pd1[i]*xxd[i] + (pe[i]*e[i]).where[it[i]]

actp[i] =         px[i]*(1-itax[i]) == pva[i] + Sum(j, io[j,i]*p[j])

pkdef[i] =        pk[i] == Sum(j, p[j]*imat[j,i])

# output and factors of production block
activity[i] =     xd[i] == ad[i] * Product(lc.where[wdist[i, lc]], l[i,lc]**alphl[i, lc]) * k[i]**(1 - Sum(lc, alphl[i, lc]))

profitmax[i,lc].where[wdist[i, lc]] =   wa[lc]*wdist[i, lc]*l[i,lc] == xd[i]*pva[i]*alphl[i, lc]

lmequil[lc] =     Sum(i, l[i,lc]) == ls[lc]

cet[it] =         xd[it] == at[it]*(gamma[it]*e[it]**rhot[it] + ( 1 - gamma[it]) * xxd[it]**rhot[it])**(1/rhot[it])

edemand[it] =     e[it]/e0[it]  == (pwe0[it]/pwe[it])**eta[it]

esupply[it] =     e[it]/xxd[it] ==   (pe[it]/pd1[it]*(1 - gamma[it])/gamma[it]) **(1/(rhot[it] - 1))

armington[it] =   x[it] == ac[it]*(delta[it]*m1[it]**(-rhoc[it]) + (1 - delta[it]) * xxd[it]**(-rhoc[it]))**(-1/rhoc[it])

costmin[it]   =   m1[it]/xxd[it] ==   (pd1[it]/pm[it]*delta[it]/(1 - delta[it])) **(1/(1 + rhoc[it]))

xxdsn[ins]    =   xxd[ins]     == xd[ins]

xsn[ins]      =   x[ins]       == xxd[ins]

# demand block
inteq[j] =         int1[j]      == Sum(i, io[j,i]*xd[i])

dsteq[i] =         dst[i]      == dstr[i]*xd[i]

cdeq[i]  =         p[i]*cd[i]  == cles[i]*(1 - mps)*y

gdp[...] =         y           == Sum(i, pva[i]*xd[i]) - deprecia

hhsaveq[...]     =         hhsav       == mps*y

greq[...]        =         gr          == tariff + duty + indtax

gruse[...]       =         gr          == Sum(i, p[i]*gd[i]) + govsav

gdeq[i]          =         gd[i]       == gles[i]*gdtot

tariffdef[...]   =         tariff      == Sum(it, tm[it]*m1[it]*pwm[it])*er

indtaxdef[...]   =         indtax      == Sum(i, itax[i]*px[i]*xd[i])

dutydef[...]     =         duty        == Sum(it, te[it]*e[it]*pe[it])

depreq[...]      =         deprecia    == Sum(i, depr[i]*pk[i]*k[i])

totsav[...]      =         savings     == hhsav + govsav + deprecia + fsav*er

prodinv[i]       =         pk[i]*dk[i] == kio[i]*savings - kio[i]*Sum(j, dst[j]*p[j])

ieq[i]           =         id[i]       == Sum(j, imat[i,j]*dk[j])

caeq[...]        =         Sum(it, pwm[it]*m1[it]) == Sum(it, pwe[it]*e[it]) + fsav

# market clearing
equil[i]         =         x[i]        == int1[i] + cd[i] + gd[i] + id[i] + dst[i]

obj[...]         =         omega       == Product(i.where[cles[i]], cd[i]**cles[i])

# model setup - initialization
x.l[i]   = x0[i]
xd.l[i]  = xd0[i]
xxd.l[i]  = xxd0[i]
cd.l[i]  = cles[i]*cdtot0
m1.l[i]   = m0[i]
e.l[i]   = e0[i]
id.l[i]   = id0[i]
dst.l[i] = dst0[i]
int1.l[i] = int0[i]
pd1.l[i]  = pd0[i]
pm.l[i]   = pm0[i]
pe.l[i]  = pe0[i]
p.l[i]   = pd0[i]
px.l[i]  = pd0[i]
pk.l[i]   = pd0[i]
pva.l[i] = pva0[i]
pwe.l[i] = pwe0[i]
wa.l[lc] = wa0[lc]
l.l[i,lc] = xle[i, lc]
gr.l[...] = gr0

y.l[...]          = Sum(i, pva0[i]*xd0[i] - depr[i]*k0[i])
fsav.l[...]       = fsav0 
tm.l[it]          = tm0[it]
gd.l["publiques"] = 135.03
tariff.l[...]     = 76.548
indtax.l[...]     = 102.45
savings.l[...]    = 280.98

# closure
k.fx[i]        = k0[i]
pwm.fx[i]      = pwm0[i]
ls.fx[lc]      = ls0[lc]
tm.fx[it]      = tm0[it]
fsav.fx[...]   = fsav0 
mps.fx[...]    = .09305
gdtot.fx[...]  = gdtot0
m1.fx[ins]     = 0
l.fx["publiques","rural"]       = 0
l.fx["ag_subsist","urban_skil"] = 0
e.fx[ins]  = 0

# Note: caeq is not part ins the current model definition.
#       However, camcge.gms is a template for equilibrium models ins general.
equations = m.getEquations()
equations.remove(caeq)


camcge = Model(m, name="camcge", problem="NLP", equations=equations, sense="MAX", objective=omega)  # square base model / all - caeq /

camcge.solve(solver="CONOPT")



import pandas as pd
import numpy as np

from copy import deepcopy

from gamspy import Container
from gamspy import Set
from gamspy import Alias
from gamspy import Parameter
from gamspy import Variable
from gamspy import Equation
from gamspy import Model
from gamspy import Sum
from gamspy import Options
from gamspy import SolveStatus
from gamspy import ModelStatus



def read_sam(sam_file, sectors_no, hh_no):

    sam_raw = pd.read_excel(sam_file, header=0, index_col=0).fillna(0)

    if not sorted(sam_raw.columns) == sorted(sam_raw.index):
        columns_not_index = list(set(sam_raw.columns) - set(sam_raw.index))
        rows_not_index = list(set(sam_raw.index) - set(sam_raw.columns))
        raise ValueError("SAM rows and columns do not match, please check the following rows and columns: " +
                        f"Columns not in index: {columns_not_index}, Rows not in columns: {rows_not_index}")

    n1 = sam_raw.columns.tolist()

    if len(n1) != (sectors_no + hh_no + 9):
        raise ValueError(f"Number of sectors >{sectors_no}< and households >{hh_no}< do not match the SAM dimensions. "
                         f"Expected their sum to be {len(n1) - 9} but got {sectors_no + hh_no}. Please check the input values or the format of SAM required.")

    sectors_vals = n1[:sectors_no]
    hh_vals = n1[sectors_no + 2 : sectors_no + 2 + hh_no]

    i_copy = deepcopy(sectors_vals)
    sector_walras          = i_copy.pop()
    sector_vals_but_walras = i_copy

    sam_final = sam_raw.stack().reset_index()
    sam_final.columns = ['n1', 'n2', 'value']

    return sam_final, n1, sectors_vals, sector_vals_but_walras, sector_walras, hh_vals

default_sam_file = "../sam_open_economy.xlsx"
def build_model(sam_file, sectors_no, hh_no, SIGP_vals, SIGC_vals, SIGM_vals, SIGX_vals):
    m = Container()

    sam_data, n1_vals, i_vals, i1_vals, i2_vals, h_vals = read_sam(sam_file, sectors_no, hh_no)

    # Sets
    n1  = Set(m, name="n1",             records=n1_vals)
    I   = Set(m, name="I",   domain=n1, records=i_vals)
    I1  = Set(m, name="I1",  domain=I,  records=i1_vals)
    I2  = Set(m, name="I2",  domain=I,  records=i2_vals)
    H   = Set(m, name="H",   domain=n1, records=h_vals)

    # Aliases
    n2 = Alias(m, name="n2", alias_with=n1)
    J  = Alias(m, name="J",  alias_with=I)


    # PARAMETERS
    SAM_OE = Parameter(m, name="SAM_OE", domain=[n1, n2], description="SAM data", records=sam_data)
    VXTSO  = Parameter(m, name="VXTSO",  domain=J,        description="Value of total production of industry j in the benchmark situation (without production taxes)")
    VVAO   = Parameter(m, name="VVAO",   domain=J,        description="Value of value added of industry j in the benchmark situation")
    VINTO  = Parameter(m, name="VINTO",  domain=J,        description="Value of total intermediate inputs used in industry j in the benchmark situation")
    VKO    = Parameter(m, name="VKO",    domain=J,        description="Return to capital industry j in the benchmark situation")
    VLDO   = Parameter(m, name="VLDO",   domain=J,        description="Salaries paid by industry j in the benchmark situation")
    VVO    = Parameter(m, name="VVO",    domain=[I, J],   description="Value of commodity i used as intermediate inputs in industry j in the benchmark situation")
    VDINVO = Parameter(m, name="VDINVO", domain=I,        description="Value of investment demand of commodity i (without taxes) in the benchmark situation")
    VCO    = Parameter(m, name="VCO",    domain=[I, H],   description="Value of household h consumption of commodity i (without taxes) in the benchmark situation")

    XTSO  = Parameter(m, name="XTSO",  domain=J,      description="Volume of total production of industry j in the benchmark situation")
    VAO   = Parameter(m, name="VAO",   domain=J,      description="Volume of value added of industry j in the benchmark situation")
    INTO  = Parameter(m, name="INTO",  domain=J,      description="Volume of total intermediate inputs used in industry j in the benchmark situation")
    KO    = Parameter(m, name="KO",    domain=J,      description="Stock of capital industry j in the benchmark situation")
    LDO   = Parameter(m, name="LDO",   domain=J,      description="Quantity of labour demand by industry j in the benchmark situation")
    VO    = Parameter(m, name="VO",    domain=[I, J], description="Volume of commodity i used as intermediate inputs in industry j in the benchmark situation")
    DINVO = Parameter(m, name="DINVO", domain=I,      description="Volume of investment demand of commodity i in the benchmark situation")
    CO    = Parameter(m, name="CO",    domain=[I, H], description="Volume of household consumption of commodity i in the benchmark situation")
    GO    = Parameter(m, name="GO",    domain=I,      description="Volume of government  consumption of commodity i in the benchmark situation")
    LSO   = Parameter(m, name="LSO",   domain=H,      description="Total labour supply in the benchmark situation")
    KTOTO = Parameter(m, name="KTOTO",                description="Total stock of capital in the benchmark situation")

    CHO     = Parameter(m, name="CHO",    domain=H, description="Household h consumption expenditures in the benchmark situation")
    SH      = Parameter(m, name="SH",     domain=H, description="Household h average saving propensity")
    YTHO    = Parameter(m, name="YTHO",   domain=H, description="Household h total income in the benchmark situation")
    BETAKH  = Parameter(m, name="BETAKH",           description="Share of total profits returned to households as dividend")
    YEO     = Parameter(m, name="YEO",              description="Firms' total income in the benchmark situation")
    SAV_HO  = Parameter(m, name="SAV_HO", domain=H, description="Household h savings in the benchmark situation")
    SAV_EO  = Parameter(m, name="SAV_EO",           description="Firms' total savings in the benchmark situation")
    TOTSAVO = Parameter(m, name="TOTSAVO",          description="Total savings in the benchmark")
    BETAV   = Parameter(m, name="BETAV",  domain=I, description="Share of commodity i in total investment expenditure")

    PXTSO = Parameter(m, name="PXTSO", domain=J, description="Price of total production of industry j in the benchmark situation (net of production tax)")
    PVAO  = Parameter(m, name="PVAO",  domain=J, description="Price of value added of industry j in the benchmark situation")
    PINTO = Parameter(m, name="PINTO", domain=J, description="Price of total intermediate inputs used in industry j in the benchmark situation")
    PCO   = Parameter(m, name="PCO",   domain=I, description="Purchase price of commodity i in the benchmark situation (without taxes)")
    RO    = Parameter(m, name="RO",              description="Rental rate of capital in the benchmark situation")
    WO    = Parameter(m, name="WO",              description="Wage rate in the benchmark situation")


    AP     = Parameter(m, name="AP",     domain=J,      description="Shift parameter in the ces production function of industry j")
    ALPHAP = Parameter(m, name="ALPHAP", domain=J,      description="Share parameter in the  ces production function of industry j")
    SIGP   = Parameter(m, name="SIGP",   domain=J,      description="Elasticity of substitution in the  ces production function of industry j")
    AV     = Parameter(m, name="AV",     domain=J,      description="Shift parameter in the c-d production function of value added in industry j")
    ALPHAV = Parameter(m, name="ALPHAV", domain=J,      description="Share parameter in the c-d production function of value added in industry j")
    AIJ    = Parameter(m, name="AIJ",    domain=[I, J], description="Input-output coefficient in industry j")
    ALPHAC = Parameter(m, name="ALPHAC", domain=[I, H], description="Share parameter in the household ces utility function")
    SIGC   = Parameter(m, name="SIGC",   domain=H,      description="Elasticity of substitution in the household ces utility function")


    LAMBDA_K = Parameter(m, name="LAMBDA_K", domain=H, description="Share of distributed capital income accruing to household h")
    KINC_H   = Parameter(m, name="KINC_H",   domain=H, description="Benchmark capital income accruing to household h from SAM")
    WAGE_H   = Parameter(m, name="WAGE_H",   domain=H, description="Distribution of wages and dividends across households")

    total_cap_income = Parameter(m, name="total_cap_income")

    # Change relative to the without_gov model

    VGO        = Parameter(m, name="VGO",        domain=I, description="Value of government consumption of commodity i in the benchmark situation (without taxes)")
    VINDTAXO   = Parameter(m, name="VINDTAXO",   domain=J, description="Value of indirect taxes on output in industry j in the benchmark situation")
    TOTCONSTXO = Parameter(m, name="TOTCONSTXO",           description="Total indirect taxes on household consumption of commodities i in the benchmark situation")
    TOTGOVTXO  = Parameter(m, name="TOTGOVTXO",            description="Total indirect taxes on government consumption of commodities i in the benchmark situation")
    TOTINVTXO  = Parameter(m, name="TOTINVTXO",            description="Total indirect taxes on investment goods i in the benchmark situation")
    TP         = Parameter(m, name="TP",         domain=J, description="Production tax rate in industry j")
    TC         = Parameter(m, name="TC",         domain=I, description="Household consumption tax rate on commodities i")
    TINV       = Parameter(m, name="TINV",       domain=I, description="Tax rate on investment good i")
    TG         = Parameter(m, name="TG",         domain=I, description="Government consumption tax rate on commodities i")
    YDHO       = Parameter(m, name="YDHO",       domain=H, description="Household h disposable income in the benchmark situation")
    YGO        = Parameter(m, name="YGO",                  description="Government total revenue in the benchmark situation")
    SAV_GO     = Parameter(m, name="SAV_GO",               description="Government savings in the benchmark situation")
    TRGHO      = Parameter(m, name="TRGHO",     domain=H,  description="Government transfers to household h in the benchmark situation")
    DIRTAX_HO  = Parameter(m, name="DIRTAX_HO", domain=H,  description="Household h income tax in the benchmark situation")
    DIRTAX_EO  = Parameter(m, name="DIRTAX_EO",            description="Corporate income tax in the benchmark situation")
    TY_H       = Parameter(m, name="TY_H",      domain=H,  description="Household h income tax rate")
    TY_E       = Parameter(m, name="TY_E",                 description="Corporate income tax rate")


    # Change relative to the with_gov model

    VMO     = Parameter(m, name="VMO",     domain=I, description="Import value of commodity i (duty included) in the benchmark situation")
    VEXO    = Parameter(m, name="VEXO",    domain=I, description="Export value of commodity i in the benchmark situation")
    TXIMPO  = Parameter(m, name="TXIMPO",  domain=I, description="Duties collected on imports of commodity i in the benchmark situation")
    SAV_FO  = Parameter(m, name="SAV_FO",            description="Foreign savings in the benchmark situation")
    TRROWHO = Parameter(m, name="TRROWHO", domain=H, description="Rest of the world's net transfers to households in the benchmark situation")

    XTDO = Parameter(m, name="XTDO", domain=I, description="Volume of total demand of commodity i in the benchmark situation")
    MO   = Parameter(m, name="MO",   domain=I, description="Import volume of commodity i in the benchmark situation")
    EXO  = Parameter(m, name="EXO",  domain=I, description="Export volume of commodity i in the benchmark situation")
    XDDO = Parameter(m, name="XDDO", domain=I, description="Demand for domestic good i in the benchmark situation")
    XDSO = Parameter(m, name="XDSO", domain=I, description="SupplY of domestic good i in the benchmark situation")

    PMO   = Parameter(m, name="PMO",   domain=I, description="Sale price of imported commodity i (including duties) in the benchmark situation")
    PWMO  = Parameter(m, name="PWMO",  domain=I, description="World price of imported commodity i (without duties) in the benchmark situation")
    PEXO  = Parameter(m, name="PEXO",  domain=I, description="Producer price of export commodity i  in the benchmark situation")
    PWEXO = Parameter(m, name="PWEXO", domain=I, description="World price of export commodity i  in the benchmark situation")
    PDO   = Parameter(m, name="PDO",   domain=I, description="Price of domestic good in the benchmark situation")
    ERO   = Parameter(m, name="ERO",             description="Conversion factor between foreign and domestic currencies ('nominal' exchange rate)")

    AM     = Parameter(m, name="AM",     domain=I, description="Shift parameter in the Armington CES function")
    SIGM   = Parameter(m, name="SIGM",   domain=I, description="Elasticity of substitution in the Armington CES function")
    ALPHAM = Parameter(m, name="ALPHAM", domain=I, description="Share parameter in the Armington CES function")
    AX     = Parameter(m, name="AX",     domain=I, description="Shift parameter in the CET function")
    SIGX   = Parameter(m, name="SIGX",   domain=I, description="Elasticity of substitution in the CET function")
    ALPHAX = Parameter(m, name="ALPHAX", domain=I, description="Share parameter in the CET function")
    TM     = Parameter(m, name="TM",     domain=I, description="Tax rate on imports of commodity i")

    PCHO   = Parameter(m, name="PCHO",   domain=I, description="Household consumption price (including taxes)")
    PCINVO = Parameter(m, name="PCINVO", domain=I, description="Purchasing price of investment goods (including taxes)")
    PCGO   = Parameter(m, name="PCGO",   domain=I, description="Government consumption price (including taxes)")


    if isinstance(SIGP_vals, (int, float)):
        SIGP[J] = SIGP_vals
    elif isinstance(SIGP_vals, list):
        if len(SIGP_vals) != sectors_no:
            raise ValueError(f"Length of SIGP_vals {len(SIGP_vals)} does not match number of sectors {sectors_no}")
        SIGP.setRecords(np.array(SIGP_vals))

    if isinstance(SIGC_vals, (int, float)):
        SIGC[H] = SIGC_vals
    elif isinstance(SIGC_vals, list):
        if len(SIGC_vals) != hh_no:
            raise ValueError(f"Length of SIGC_vals {len(SIGC_vals)} does not match number of households {hh_no}")
        SIGC.setRecords(np.array(SIGC_vals))

    if isinstance(SIGM_vals, (int, float)):
        SIGM[I] = SIGM_vals
    elif isinstance(SIGM_vals, list):
        if len(SIGM_vals) != sectors_no:
            raise ValueError(f"Length of SIGM_vals {len(SIGM_vals)} does not match number of sectors {sectors_no}")
        SIGM.setRecords(np.array(SIGM_vals))

    if isinstance(SIGX_vals, (int, float)):
        SIGX[I] = SIGX_vals
    elif isinstance(SIGX_vals, list):
        if len(SIGX_vals) != sectors_no:
            raise ValueError(f"Length of SIGX_vals {len(SIGX_vals)} does not match number of sectors {sectors_no}")
        SIGX.setRecords(np.array(SIGX_vals))


    # Assign values to parameters

    VLDO[J]     = SAM_OE['LAB',J]
    VKO[J]      = SAM_OE['CAP',J]
    VINDTAXO[J] = SAM_OE['INDIR_TX',J]
    VVO[I, J]   = SAM_OE[I, J]
    VDINVO[I]   = SAM_OE[I, 'ACCUM']
    VCO[I, H]   = SAM_OE[I, H]
    VGO[I]      = SAM_OE[I, 'GOVMT']
    SAV_HO[H]   = SAM_OE['ACCUM', H]
    SAV_EO[...] = SAM_OE['ACCUM', 'FIRMS']
    SAV_GO[...] = SAM_OE['ACCUM', 'GOVMT']
    SAV_FO[...] = SAM_OE['ACCUM', 'ROW']

    TOTCONSTXO[...] = Sum(H, SAM_OE['INDIR_TX', H])
    TOTGOVTXO[...]  = SAM_OE['INDIR_TX', 'GOVMT']
    TOTINVTXO[...]  = SAM_OE['INDIR_TX', 'ACCUM']
    DIRTAX_HO[H]    = SAM_OE['DIRECT_TX', H]
    DIRTAX_EO[...]  = SAM_OE['DIRECT_TX', 'FIRMS']
    TRGHO[H]        = SAM_OE[H, 'GOVMT']
    WAGE_H[H]       = SAM_OE[H, 'LAB']

    VMO[I]    = SAM_OE['ROW', I] + SAM_OE['IMP_TX', I]
    VEXO[I]   = SAM_OE[I, 'ROW']
    TXIMPO[I] = SAM_OE['IMP_TX', I]

    VVAO[J]  = VLDO[J] +  VKO[J]     
    VINTO[J] = Sum(I, VVO[I, J])
    VXTSO[J] = VVAO[J] + VINTO[J] 

    TRROWHO[H] = SAM_OE[H, 'ROW']


    PXTSO[J] = 1
    PVAO[J]  = 1
    PINTO[J] = 1
    RO[...]  = 1
    WO[...]  = 1


    PMO[I]   = 1
    PEXO[I]  = 1
    PDO[I]   = 1
    ERO[...] = 1


    # Calibrate volumes and parameters from values and prices

    XTSO[J]    = VXTSO[J] / PXTSO[J]
    VAO[J]     = VVAO[J] / PVAO[J]
    INTO[J]    = VINTO[J] / PINTO[J]
    KO[J]      = VKO[J] / RO
    LDO[J]     = VLDO[J] / WO
    KTOTO[...] = Sum(J, KO[J])
    LSO[H]     = WAGE_H[H] / WO

    TP[J]    = VINDTAXO[J] / PXTSO[J] / XTSO[J]
    TC[I]    = TOTCONSTXO / Sum(J, Sum(H, VCO[J, H]))
    TINV[I]  = TOTINVTXO / Sum(J, VDINVO[J])
    TG[I]    = TOTGOVTXO / Sum(J, VGO[J])

    PCO[I]     = PXTSO[I] * (1 + TP[I])
    PCHO[I]    = PCO[I] * (1 + TC[I])
    PCINVO[I]  = PCO[I] * (1 + TINV[I])
    PCGO[I]    = PCO[I] * (1 + TG[I])
    VO[I, J]   = VVO[I, J] / PCO[I]
    CO[I,H]    = VCO[I,H] / PCO[I]
    GO[I]      = VGO[I] / PCO[I]
    DINVO[I]   = VDINVO[I] / PCO[I]
    MO[I]      = VMO[I] / PMO[I]
    EXO[I]     = VEXO[I] / PEXO[I]
    XDSO[I]    = (VXTSO[I]+VINDTAXO[I] - VEXO[I]) / PDO[I]
    XDDO[I]    = XDSO[I]
    XTDO[I]    = Sum(H, CO[I,H]) + GO[I] + DINVO[I] + Sum(J, VO[I, J])


    PWMO[I]     = (VMO[I]-TXIMPO[I]) / MO[I] / ERO
    TM[I]       = TXIMPO[I] / (VMO[I]-TXIMPO[I])
    PWEXO[I]    = PEXO[I] / ERO
    CHO[H]      = Sum(I, PCHO[I] * CO[I,H])
    YDHO[H]     = CHO[H] + SAV_HO[H]
    YTHO[H]     = YDHO[H] + DIRTAX_HO[H]
    TY_H[H]     = DIRTAX_HO[H] / YTHO[H]
    SH[H]       = SAV_HO[H] / YDHO[H]

    KINC_H[H] = SAM_OE[H, 'CAP']
    total_cap_income[...] = Sum(H, KINC_H[H])
    LAMBDA_K[H] = KINC_H[H] / total_cap_income

    BETAKH[...] = total_cap_income / Sum(J, RO * KO[J])
    YEO[...]    = (1 - BETAKH) * Sum(J, RO * KO[J])
    TY_E[...]   = DIRTAX_EO / YEO
    YGO[...]    = Sum(H, DIRTAX_HO[H]) + DIRTAX_EO + Sum(J, VINDTAXO[J]) + TOTCONSTXO + TOTGOVTXO + TOTINVTXO + Sum(I, TXIMPO[I])

    TOTSAVO[...] = SAV_EO + Sum(H, SAV_HO[H]) + SAV_GO + SAV_FO
    BETAV[I]     = PCO[I] * (1 + TINV[I]) * DINVO[I] / TOTSAVO
    ALPHAP[J]    = 1 / (1 + (PINTO[J] / PVAO[J]) * (INTO[J] / VAO[J]) ** (1 / SIGP[J]))
    AP[J]        = XTSO[J] / ((ALPHAP[J] * VAO[J] ** (1 - 1 / SIGP[J])) + ((1 - ALPHAP[J]) * INTO[J] ** (1 - 1 / SIGP[J]))) ** (SIGP[J] / (SIGP[J] - 1))
    ALPHAV[J]    = RO * KO[J] / PVAO[J] / VAO[J]
    AV[J]        = VAO[J] / ((KO[J] ** ALPHAV[J]) * (LDO[J] ** (1 - ALPHAV[J])))
    AIJ[I, J]    = VO[I, J]/INTO[J]
    ALPHAC[I, H] = (PCO[I] * (1 + TC[I]) * (CO[I,H]) ** (1 / SIGC[H])) / Sum(J, PCO[J] * (1 + TC[J]) * CO[J,H] ** (1 / SIGC[H]))
    ALPHAM[I]    = 1 / (1 + (PDO[I] / PMO[I]) * (XDDO[I] / MO[I]) ** (1 / SIGM[I]))
    AM[I]        = XTDO[I] / ((ALPHAM[I] * MO[I] ** (1 - 1/SIGM[I])) + ((1 - ALPHAM[I]) * XDDO[I] ** (1 - 1 / SIGM[I]))) ** (SIGM[I] / (SIGM[I] - 1))
    ALPHAX[I]    = (1 + (PDO[I] / PEXO[I]) * (EXO[I] / XDSO[I]) ** (1 / SIGX[I])) ** (-1)
    AX[I]        = XTSO[I] * (ALPHAX[I] * EXO[I] ** (1 + 1 / SIGX[I]) + (1 - ALPHAX[I]) * XDSO[I] ** (1 + 1/SIGX[I])) ** (-SIGX[I] / (1 + SIGX[I]))


    # POSITIVE VARIABLES
    C      = Variable(m, name="C",      type="positive", domain=[I, H], description="Volume of household consumption of commodity i")
    CH     = Variable(m, name="CH",     type="positive", domain=H,      description="Household consumption expenditures")
    DINV   = Variable(m, name="DINV",   type="positive", domain=I,      description="Volume of investment demand of commodity i")
    G      = Variable(m, name="G",      type="positive", domain=I,      description="Volume of government consumption of commodity i")
    INT    = Variable(m, name="INT",    type="positive", domain=J,      description="Volume of the index of intermediate inputs used in industry j")
    K      = Variable(m, name="K",      type="positive", domain=J,      description="Stock of capital industry j")
    KTOT   = Variable(m, name="KTOT",   type="positive",                description="Total stock of capital")
    LD     = Variable(m, name="LD",     type="positive", domain=J,      description="Labour demand by industry j (volume)")
    LS     = Variable(m, name="LS",     type="positive", domain=H,      description="Total labour supply (volume)")
    PC     = Variable(m, name="PC",     type="positive", domain=I,      description="Sale price of commodity i (without taxes)")
    PINT   = Variable(m, name="PINT",   type="positive", domain=J,      description="Index price of total intermediate inputs used in industry j")
    PVA    = Variable(m, name="PVA",    type="positive", domain=J,      description="Price of value added of industry j")
    PXTS   = Variable(m, name="PXTS",   type="positive", domain=J,      description="Output price in industry j (net of production taxes)")
    PCH    = Variable(m, name="PCH",    type="positive", domain=I,      description="Household consumption price (including taxes)")
    PCINV  = Variable(m, name="PCINV",  type="positive", domain=I,      description="Purchasing price of investment goods (including taxes)")
    PCG    = Variable(m, name="PCG",    type="positive", domain=I,      description="Government consumption price (including taxes)")
    R      = Variable(m, name="R",      type="positive",                description="Rental rate of capital")
    SAV_E  = Variable(m, name="SAV_E",  type="positive",                description="Firm savings")
    SAV_H  = Variable(m, name="SAV_H",  type="positive", domain=H,      description="Household savings")
    TOTSAV = Variable(m, name="TOTSAV", type="positive",                description="Total savings")
    V      = Variable(m, name="V",      type="positive", domain=[I, J], description="Volume of commodity i used as intermediate inputs in industry j")
    VA     = Variable(m, name="VA",     type="positive", domain=J,      description="Volume of value added of industry j")
    W      = Variable(m, name="W",      type="positive",                description="Wage rate")
    XTS    = Variable(m, name="XTS",    type="positive", domain=J,      description="Output in industry j")
    YDH    = Variable(m, name="YDH",    type="positive", domain=H,      description="Household disposable income")
    YE     = Variable(m, name="YE",     type="positive",                description="Corporate income")
    YG     = Variable(m, name="YG",     type="positive",                description="Government total revenue")
    YTH    = Variable(m, name="YTH",    type="positive", domain=H,      description="Household total income")
    XTD    = Variable(m, name="XTD",    type="positive", domain=I,      description="Volume of total demand of commodity i")
    M      = Variable(m, name="M",      type="positive", domain=I,      description="Import volume of commodity i")
    EX     = Variable(m, name="EX",     type="positive", domain=I,      description="Export volume of commodity i")
    XDD    = Variable(m, name="XDD",    type="positive", domain=I,      description="Demand for domestic good i")
    XDS    = Variable(m, name="XDS",    type="positive", domain=I,      description="SupplY of domestic good i")

    PM   = Variable(m, name="PM",   type="positive",   domain=I, description="Sale price of imported commodity i (including duties)")
    PWM  = Variable(m, name="PWM",  type="positive",   domain=I, description="World price of imported commodity i (without duties)")
    PEX  = Variable(m, name="PEX",  type="positive",   domain=I, description="Producer price of export commodity i")
    PWEX = Variable(m, name="PWEX", type="positive",   domain=I, description="World price of export commodity i")
    PD   = Variable(m, name="PD",   type="positive",   domain=I, description="Price of domestic good")
    ER   = Variable(m, name="ER",   type="positive",             description="Conversion factor between foreign and domestic currencies ('nominal' exchange rate) ($CND per unit of foreign currency)")


    # FREE VARIABLES
    TRGH   = Variable(m, name="TRGH",   domain=H, description="Government transfers to households")
    SAV_G  = Variable(m, name="SAV_G",            description="Government savings")
    SAV_F  = Variable(m, name="SAV_F",            description="Foreign savings")
    TRROWH = Variable(m, name="TRROWH", domain=H, description="Rest of the world's net transfers to households")
    WALRAS = Variable(m, name="WALRAS",           description="Dummy variable to check Walras law")
    OMEGA  = Variable(m, name="OMEGA")


    # EQUATIONS

    EqC      = Equation(m, name="EqC",     domain=[I,H], description="Household demand for commodity i")
    EqCH     = Equation(m, name="EqCH",    domain=H,     description="Definition of household consumption expenditures")
    EqDINV   = Equation(m, name="EqDINV",  domain=I,     description="Demand for investment good i")
    EqINT    = Equation(m, name="EqINT",   domain=J,     description="Aggregate input of intermediate inputs used in industry j")
    EqK      = Equation(m, name="EqK",     domain=J,     description="Demand for capital industry j")
    EqLD     = Equation(m, name="EqLD",    domain=J,     description="Demand for labour demand by industry j")
    EqPC     = Equation(m, name="EqPC",    domain=I,     description="Consumption price")
    EqPINT   = Equation(m, name="EqPINT",  domain=J,     description="Index price of inputs in industry j")
    EqPVA    = Equation(m, name="EqPVA",   domain=J,     description="Value added price in industry j")
    EqPXTS   = Equation(m, name="EqPXTS",  domain=J,     description="Price of output in industry j")
    EqSAV_E  = Equation(m, name="EqSAV_E",               description="Firm savings")
    EqSAV_H  = Equation(m, name="EqSAV_H", domain=H,     description="Household savings")
    EqTOTSAV = Equation(m, name="EqTOTSAV",              description="Total savings")
    EqV      = Equation(m, name="EqV",     domain=[I,J], description="Intermediate input demand in industry j")
    EqVA     = Equation(m, name="EqVA",    domain=J,     description="Value added of industry j")
    EqYTH    = Equation(m, name="EqYTH",   domain=H,     description="Household total income")
    EQ_XTD   = Equation(m, name="EQ_XTD",  domain=I,     description="Definition of total demand for commodity i")
    EQ_XD1   = Equation(m, name="EQ_XD1",  domain=I,     description="Equilibrium condition for domestic gOod i")
    EQ_XD2   = Equation(m, name="EQ_XD2",  domain=I,     description="Equilibrium condition for domestic gOod i")
    EQCAP    = Equation(m, name="EQCAP",                 description="Equilibrium condition in capital market")
    EQLAB    = Equation(m, name="EQLAB",                 description="Equilibrium condition in labour market")
    OBJ      = Equation(m, name="OBJ") 

    EqYDH   = Equation(m, name="EqYDH", domain=H, description="Household disposable income")
    EqYE    = Equation(m, name="EqYE",            description="Corporate income")
    EqYG    = Equation(m, name="EqYG",            description="Government income")
    EqSAV_G = Equation(m, name="EqSAV_G",         description="Government savings")

    EqM      = Equation(m, name="EqM",      domain=I, description="Import demand of commodity i")
    EqXDD    = Equation(m, name="EqXDD",    domain=I, description="demand for domestic commodity i")
    PXTSDUAL = Equation(m, name="PXTSDUAL", domain=I, description="Index price of composite output")
    EqEX     = Equation(m, name="EqEX",     domain=I, description="Export supply of commodity i")
    EqXDS    = Equation(m, name="EqXDS",    domain=I, description="Supply of domestic good i")
    EqSAV_F  = Equation(m, name="EqSAV_F",            description="Foreign savings")


    EqPCH   = Equation(m, name="EqPCH",   domain=I, description="Household consumption price (including taxes)")
    EqPCINV = Equation(m, name="EqPCINV", domain=I, description="Purchasing price of investment goods (including taxes)")
    EqPCG   = Equation(m, name="EqPCG",   domain=I, description="Government consumption price (including taxes)")

    EqPM  = Equation(m, name="EqPM",  domain=I, description="Definition of domestic import price")
    EqPEX = Equation(m, name="EqPEX", domain=I, description="Definition of producer export price")


    EqC[I,H]       =   C[I,H]     ==  (ALPHAC[I, H] / PCH[I]) ** SIGC[H] * CH[H] / Sum(J, ALPHAC[J, H] ** SIGC[H] * PCH[J] ** (1 - SIGC[H]))

    EqCH[H]        =   CH[H]      ==  (1 - SH[H]) * YDH[H]

    EqYDH[H]       =   YDH[H]     ==  (1 - TY_H[H]) * YTH[H]

    EqSAV_H[H]     =   SAV_H[H]   ==  SH[H] * YDH[H]

    EqYTH[H]       =   YTH[H]     ==  (W * LS[H]) + (BETAKH * R * Sum(J, K[J]) * LAMBDA_K[H]) + (TRGH[H]) + (ER * TRROWH[H])

    EqPXTS[J]      =   PXTS[J]    ==  1 / AP[J] * (ALPHAP[J] ** SIGP[J] * PVA[J] ** (1 - SIGP[J]) + (1 - ALPHAP[J]) ** SIGP[J] * PINT[J] ** (1 - SIGP[J])) ** (1 / (1 - SIGP[J]))

    EqVA[J]        =   VA[J]      ==  AP[J] ** (SIGP[J] - 1) * XTS[J] * (ALPHAP[J] * PXTS[J] / PVA[J]) ** SIGP[J]

    EqINT[J]       =   INT[J]     ==  AP[J] ** (SIGP[J] - 1) * XTS[J] * ((1 - ALPHAP[J]) * PXTS[J] / PINT[J]) ** SIGP[J]

    EqPVA[J]       =   PVA[J]     ==  1 / AV[J] * ((R / ALPHAV[J]) ** ALPHAV[J] * (W / (1 - ALPHAV[J])) ** (1 - ALPHAV[J]))

    EqK[J]         =   R * K[J]   ==  ALPHAV[J] * PVA[J] * VA[J]

    EqLD[J]        =   W * LD[J]  ==  (1 - ALPHAV[J]) * PVA[J] * VA[J]

    EqPINT[J]      =   PINT[J]    ==  Sum(I, AIJ[I, J] * PC[I])

    EqV[I, J]      =   V[I, J]    ==  AIJ[I, J] * INT[J]

    EqYE[...]      =   YE         ==  (1 - BETAKH) * R * Sum(J, K[J])

    EqSAV_E[...]   =   SAV_E      ==  (1 - TY_E) * YE

    EqYG[...]      =   YG         ==  Sum(I, Sum(H, C[I,H]) * PC[I] * TC[I]) + Sum(I, PC[I] * TG[I] * G[I]) + Sum(I, PC[I] * TINV[I] * DINV[I]) + Sum(I, ER * PWM[I] * TM[I] * M[I]) + Sum(J, PXTS[J] * TP[J] * XTS[J]) + (TY_E * YE) + Sum(H, TY_H[H] * YTH[H])

    EqSAV_G[...]   =   SAV_G      ==  YG - Sum(I, PCG[I] * G[I]) - Sum(H, TRGH[H])

    EqPC[I]        =   PC[I]      ==  1 / AM[I] * (ALPHAM[I] ** SIGM[I] * PM[I] ** (1 - SIGM[I]) + (1 - ALPHAM[I]) ** SIGM[I] * PD[I] ** (1 - SIGM[I])) ** (1 / (1 - SIGM[I]))

    EqM[I]         =   M[I]       ==  AM[I] ** (SIGM[I] - 1) * XTD[I] * (ALPHAM[I] * PC[I] / PM[I]) ** SIGM[I]

    EqXDD[I]       =   XDD[I]     ==  AM[I] ** (SIGM[I] - 1) * XTD[I] * ((1 - ALPHAM[I]) * PC[I] / PD[I]) ** SIGM[I]

    PXTSDUAL[I]    =   PXTS[I] * (1 + TP[I]) == AX[I] ** (-1) * (ALPHAX[I] ** (-SIGX[I]) * PEX[I] ** (1 + SIGX[I]) + (1 - ALPHAX[I]) ** (-SIGX[I]) * PD[I] ** (1 + SIGX[I])) ** (1 / (1 + SIGX[I]))

    EqEX[I]        =   EX[I]      ==  AX[I] ** (-1 - SIGX[I]) * XTS[I] * (PEX[I] / ALPHAX[I] / (PXTS[I] * (1 + TP[I]))) ** SIGX[I]

    EqXDS[I]       =   XDS[I]     ==  AX[I] ** (-1 - SIGX[I]) * XTS[I] * (PD[I] / (1 - ALPHAX[I]) / (PXTS[I] * (1 + TP[I]))) ** SIGX[I]

    EqSAV_F[...]   =   SAV_F      ==  Sum(I, PWM[I] * M[I]) - Sum(I, PWEX[I] * EX[I]) - Sum(H, TRROWH[H])

    EqTOTSAV[...]  =   TOTSAV     ==  SAV_E + Sum(H, SAV_H[H]) + SAV_G + (ER * SAV_F)

    EqDINV[I]      =   PCINV[I] * DINV[I] == BETAV[I] * TOTSAV

    EqPCH[I]       =   PCH[I]     ==  PC[I] * (1 + TC[I])

    EqPCINV[I]     =   PCINV[I]   ==  PC[I] * (1 + TINV[I])

    EqPCG[I]       =   PCG[I]     ==  PC[I] * (1 + TG[I])

    EqPM[I]        =   PM[I]      ==  PWM[I] * ER * (1 + TM[I])

    EqPEX[I]       =   PEX[I]     ==  PWEX[I] * ER

    EQ_XTD[I]      =   XTD[I]     ==  Sum(H, C[I,H]) + DINV[I] + G[I] + Sum(J, V[I,J])

    EQ_XD1[I1]     =   XDD[I1]       ==  XDS[I1]
    EQ_XD2[I2]     =   XDD[I2]       ==  XDS[I2] + WALRAS
    EQLAB[...]     =   Sum(J, LD[J]) ==  Sum(H, LS[H])

    EQCAP[...]     =   Sum(J, K[J]) == KTOT
    OBJ[...]       =   OMEGA == 10


    # VARIABLE INITIALIZATION

    C.l[I,H]   = CO[I,H]
    C.lo[I,H]  = 0.001 * CO[I,H]

    CH.l[H]   = CHO[H]
    CH.lo[H]  = 0.001 * CHO[H]

    DINV.l[I]    = DINVO[I]
    DINV.lo[I]   = 0.001 * DINVO[I]

    INT.l[J]     = INTO[J]
    INT.lo[J]    = 0.001 * INTO[J]

    K.l[J]       = KO[J]
    K.lo[J]      = 0.001 * KO[J]

    LD.l[J]      = LDO[J]          
    LD.lo[J]     = 0.001 * LDO[J]          

    PC.l[I]      = PCO[I]          
    PC.lo[I]     = 0.001 * PCO[I]          


    PCH.l[I]     = PCHO[I]         
    PCH.lo[I]    = 0.001 * PCHO[I]         

    PCG.l[I]     = PCGO[I]         
    PCG.lo[I]    = 0.001 * PCGO[I]         

    PCINV.l[I]   = PCINVO[I]       
    PCINV.lo[I]  = 0.001 * PCINVO[I]

    PINT.l[J]    = PINTO[J]        
    PINT.lo[J]   = 0.001 * PINTO[J]        

    PVA.l[J]     = PVAO[J]         
    PVA.lo[J]    = 0.001 * PVAO[J]         

    PXTS.l[J]    = PXTSO[J]        
    PXTS.lo[J]   = 0.001 * PXTSO[J]        

    R.l[...]     = RO              
    R.lo[...]    = 0.001 * RO              

    SAV_E.l[...]   = SAV_EO          
    SAV_E.lo[...]  = 0.001 * SAV_EO          

    SAV_H.l[H]    = SAV_HO[H]
    SAV_H.lo[H]   = 0.001 * SAV_HO[H]

    TOTSAV.l[...]   = TOTSAVO         
    TOTSAV.lo[...]  = 0.001 * TOTSAVO         

    V.l[I, J]   = VO[I, J]         
    V.lo[I, J]  = 0.001 * VO[I, J]         

    VA.l[J]   = VAO[J]          
    VA.lo[J]  = 0.001 * VAO[J]          

    W.l[...]      = WO              
    W.lo[...]     = 0.001 * WO              

    XTS.l[J]     = XTSO[J]         
    XTS.lo[J]    = 0.001 * XTSO[J]         

    YTH.l[H]    = YTHO[H]            
    YTH.lo[H]   = 0.001 * YTHO[H]            

    YDH.l[H]    = YDHO[H]            
    YDH.lo[H]   = 0.001 * YDHO[H]            

    YG.l[...]     = YGO             
    YG.lo[...]    = 0.001 * YGO             

    YE.l[...]     = YEO             
    YE.lo[...]    = 0.001 * YEO             

    SAV_G.l[...]  = SAV_GO          

    TRGH.l[H]   = TRGHO[H]           


    PM.l[I]      = PMO[I]          
    PM.lo[I]     = 0.001 * PMO[I]          

    PWM.l[I]     = PWMO[I]         
    PWM.lo[I]    = 0.001 * PWMO[I]         

    PEX.l[I]     = PEXO[I]         
    PEX.lo[I]    = 0.001 * PEXO[I]         

    PWEX.l[I]    = PWEXO[I]        
    PWEX.lo[I]   = 0.001 * PWEXO[I]        

    PD.l[I]      = PDO[I]          
    PD.lo[I]     = 0.001 * PDO[I]          

    ER.l[...]     = ERO             
    ER.lo[...]    = 0.001 * ERO             

    TRROWH.l[H] = TRROWHO[H]         

    SAV_F.l[...]  = SAV_FO          

    XTD.l[I]     = XTDO[I]         
    XTD.lo[I]    = 0.001 * XTDO[I]         

    M.l[I]       = MO[I]           
    M.lo[I]      = 0.001 * MO[I]           

    EX.l[I]      = EXO[I]          
    EX.lo[I]     = 0.001 * EXO[I]          

    XDD.l[I]     = XDDO[I]         
    XDD.lo[I]    = 0.001 * XDDO[I]         

    XDS.l[I]     = XDSO[I]
    XDS.lo[I]    = 0.001 * XDSO[I]

    LS.l[H]      = LSO[H]
    LS.lo[H]     = 0.001 * LSO[H]


    #       Numeraire and MODEL CLOSURE

    ER.fx[...]      =  ERO
    KTOT.fx[...]    =  KTOTO
    LS.fx[H]        =  LSO[H]
    G.fx[I]         =  GO[I]
    PWM.fx[I]       =  PWMO[I]
    PWEX.fx[I]      =  PWEXO[I]
    SAV_F.fx[...]   =  SAV_FO
    TRROWH.fx[H]    =  TRROWHO[H]
    TRGH.fx[H]      =  TRGHO[H]


    #       Shocks
    # TM[I] = TM[I] * 1.2


    #       Model definition and solve
    OE_Model = Model(m, name="OE_Model", problem="NLP", equations=m.getEquations(), sense="MAX", objective=OMEGA)
    options  = Options.fromGams({"ITERLIM": 10000, "RESLIM": 10000, "LIMCOL": 1, "LIMROW": 1, "NLP": "CONOPT", "holdfixed": 1})
    OE_Model.solve(options=options)

    eq_no = OE_Model.num_equations
    var_no = OE_Model.num_variables
    solver_status = OE_Model.solve_status
    model_status = OE_Model.status
    infeas_no = OE_Model.num_infeasibilities
    nonopt_no = OE_Model._num_nonoptimalities

    check1 = solver_status == SolveStatus.NormalCompletion
    check2 = (model_status == ModelStatus.OptimalGlobal) or (model_status == ModelStatus.OptimalLocal)
    check3 = eq_no == var_no
    check4 = infeas_no == nonopt_no == 0

    if not check1:
        raise ValueError(f"The model was not completed normally. The status is {solver_status}")


    if not check2:
        raise ValueError(f"The model did not solve optimally. The status is {model_status}")


    if not check3:
        raise ValueError(f"Number of variables and equations are not equal! {var_no} != {eq_no}")


    if not check4:
        raise ValueError(f"Number of infeasibilities >{infeas_no}< and nonoptimalities >{nonopt_no}< are not zero!")



    # Change in imports
    print("### Change in imports (in %) compared to base SAM: \n")
    VM = np.round(((M.toDense() - MO.toDense()) / MO.toDense()) * 100, 2)
    print("BEFORE: \n", MO.toDense(), "\n")
    print("AFTER: \n", M.toDense(), "\n")
    print("CHANGE (in %): \n", VM, "\n")

    # Change in wage rate
    print("### Change in wage rate (in %) compared to base SAM:")
    VW = np.round(((W.toDense() - WO.toDense()) / WO.toDense()) * 100, 2)
    print("BEFORE: \n", WO.toDense(), "\n")
    print("AFTER: \n", W.toDense(), "\n")
    print("CHANGE (in %): \n", VW, "\n")

    # Change in household consumption
    print("### Change in household consumption (in %) compared to base SAM:")
    VCH = np.round(((CH.toDense() - CHO.toDense()) / CHO.toDense()) * 100, 2)
    print("BEFORE: \n", CHO.toDense(), "\n")
    print("AFTER: \n", CH.toDense(), "\n")
    print("CHANGE (in %): \n", VCH, "\n")

    # Change in household total income
    print("### Change in household total income (in %) compared to base SAM:")
    VYTH = np.round(((YTH.toDense() - YTHO.toDense()) / YTHO.toDense()) * 100, 2)
    print("BEFORE: \n", YTHO.toDense(), "\n")
    print("AFTER: \n", YTH.toDense(), "\n")
    print("CHANGE (in %): \n", VYTH, "\n")

    # Change in household disposable income
    print("### Change in household disposable income (in %) compared to base SAM:")
    VYDH = np.round(((YDH.toDense() - YDHO.toDense()) / YDHO.toDense()) * 100, 2)
    print("BEFORE: \n", YDHO.toDense(), "\n")
    print("AFTER: \n", YDH.toDense(), "\n")
    print("CHANGE (in %): \n", VYDH, "\n")

    # Change in household savings
    print("### Change in household savings (in %) compared to base SAM:")
    VSH = np.round(((SAV_H.toDense() - SAV_HO.toDense()) / SAV_HO.toDense()) * 100, 2)
    print("BEFORE: \n", SAV_HO.toDense(), "\n")
    print("AFTER: \n", SAV_H.toDense(), "\n")
    print("CHANGE (in %): \n", VSH, "\n")

    # Change in government revenues
    print("### Change in government revenues (in %) compared to base SAM:")
    VYG = np.round(((YG.toDense() - YGO.toDense()) / YGO.toDense()) * 100, 2)
    print("BEFORE: \n", YGO.toDense(), "\n")
    print("AFTER: \n", YG.toDense(), "\n")
    print("CHANGE (in %): \n", VYG, "\n")

    # Change in government savings
    print("### Change in government savings (in %) compared to base SAM:")
    VSG = np.round(((SAV_G.toDense() - SAV_GO.toDense()) / SAV_GO.toDense()) * 100, 2)
    print("BEFORE: \n", SAV_GO.toDense(), "\n")
    print("AFTER: \n", SAV_G.toDense(), "\n")
    print("CHANGE (in %): \n", VSG, "\n")

    # Change in firm income
    print("### Change in firm income (in %) compared to base SAM:")
    VYE = np.round(((YE.toDense() - YEO.toDense()) / YEO.toDense()) * 100, 2)
    print("BEFORE: \n", YEO.toDense(), "\n")
    print("AFTER: \n", YE.toDense(), "\n")
    print("CHANGE (in %): \n", VYE, "\n")

    # Change in firm savings
    print("### Change in firm savings (in %) compared to base SAM:")
    VSE = np.round(((SAV_E.toDense() - SAV_EO.toDense()) / SAV_EO.toDense()) * 100, 2)
    print("BEFORE: \n", SAV_EO.toDense(), "\n")
    print("AFTER: \n", SAV_E.toDense(), "\n")
    print("CHANGE (in %): \n", VSE, "\n")

    # Change in total savings
    print("### Change in total savings/investment (in %) compared to base SAM:")
    VTS = np.round(((TOTSAV.toDense() - TOTSAVO.toDense()) / TOTSAVO.toDense()) * 100, 2)
    print("BEFORE: \n", TOTSAVO.toDense(), "\n")
    print("AFTER: \n", TOTSAV.toDense(), "\n")
    print("CHANGE (in %): \n", VTS, "\n")

    # Change in total investment
    print("### Change in total investment (in %) compared to base SAM:")
    VTI = np.round(((DINV.toDense() - DINVO.toDense()) / DINVO.toDense()) * 100, 2)
    print("BEFORE: \n", DINVO.toDense(), "\n")
    print("AFTER: \n", DINV.toDense(), "\n")
    print("CHANGE (in %): \n", VTI, "\n")

    # Change in Products supply
    print("### Change in product supply (in %) compared to base SAM:")
    VTSUP = np.round(((XTS.toDense() - XTSO.toDense()) / XTSO.toDense()) * 100, 2)
    print("BEFORE: \n", XTSO.toDense(), "\n")
    print("AFTER: \n", XTS.toDense(), "\n")
    print("CHANGE (in %): \n", VTSUP, "\n")

    # Change in Product price
    print("### Change in product price (in %) compared to base SAM:")
    VPC = np.round(((PC.toDense() - PCO.toDense()) / PCO.toDense()) * 100, 2)
    print("BEFORE: \n", PCO.toDense(), "\n")
    print("AFTER: \n", PC.toDense(), "\n")
    print("CHANGE (in %): \n", VPC, "\n")

    # Change in government consumption
    print("### Change in government consumption (in %) compared to base SAM:")
    VG = np.round(((G.toDense() - GO.toDense()) / GO.toDense()) * 100, 2)
    print("BEFORE: \n", GO.toDense(), "\n")
    print("AFTER: \n", G.toDense(), "\n")
    print("CHANGE (in %): \n", VG, "\n")

    # Change in product demand
    print("### Change in product demand (in %) compared to base SAM:")
    VTD = np.round(((XTD.toDense() - XTDO.toDense()) / XTDO.toDense()) * 100, 2)
    print("BEFORE: \n", XTDO.toDense(), "\n")
    print("AFTER: \n", XTD.toDense(), "\n")
    print("CHANGE (in %): \n", VTD, "\n")

    # Change in Labor demand
    print("### Change in labor demand (in %) compared to base SAM:")
    VLD = np.round(((LD.toDense() - LDO.toDense()) / LDO.toDense()) * 100, 2)
    print("BEFORE: \n", LDO.toDense(), "\n")
    print("AFTER: \n", LD.toDense(), "\n")
    print("CHANGE (in %): \n", VLD, "\n")

    # Change in Labor Supply
    print("### Change in labor supply (in %) compared to base SAM:")
    VLS = np.round(((LS.toDense() - LSO.toDense()) / LSO.toDense()) * 100, 2)
    print("BEFORE: \n", LSO.toDense(), "\n")
    print("AFTER: \n", LS.toDense(), "\n")
    print("CHANGE (in %): \n", VLS, "\n")

    # Change in total direct tax revenue
    print("### Change in total direct tax revenue (in %) compared to base SAM:")
    VDTb = Parameter(m, name="VDTb")
    VDTa  = Parameter(m, name="VDTa")
    VDTb[...]  = Sum(H, TY_H[H] * YTHO[H]) + (TY_E * YEO)
    VDTa[...] = Sum(H, TY_H[H] * YTH[H]) + (TY_E * YE)
    VDT = np.round(((VDTa.toDense() - VDTb.toDense()) / VDTb.toDense()) * 100, 2)
    print("BEFORE: \n", VDTb.toDense(), "\n")
    print("AFTER: \n", VDTa.toDense(), "\n")
    print("CHANGE (in %): \n", VDT, "\n")

    # Change in total indirect tax revenue
    print("### Change in total indirect tax revenue (in %) compared to base SAM:")
    VITb = Parameter(m, name="VITb")
    VITa  = Parameter(m, name="VITa")
    VITb[...] = Sum(I, Sum(H, CO[I,H]) * PCO[I] * TC[I]) + Sum(I, PCO[I] * TG[I] * GO[I]) + Sum(I, PCO[I] * TINV[I] * DINVO[I]) + Sum(I, ERO * PWMO[I] * TM[I] * MO[I]) + Sum(J, PXTSO[J] * TP[J] * XTSO[J])
    VITa[...]  = Sum(I, Sum(H, C[I,H]) * PC[I] * TC[I]) + Sum(I, PC[I] * TG[I] * G[I]) + Sum(I, PC[I] * TINV[I] * DINV[I]) + Sum(I, ER * PWM[I] * TM[I] * M[I]) + Sum(J, PXTS[J] * TP[J] * XTS[J])
    VIT = np.round(((VITa.toDense() - VITb.toDense()) / VITb.toDense()) * 100, 2)
    print("BEFORE: \n", VITb.toDense(), "\n")
    print("AFTER: \n", VITa.toDense(), "\n")
    print("CHANGE (in %): \n", VIT, "\n")

    # Change in import tariff revenue
    print("### Change in import tariff revenue (in %) compared to base SAM:")
    VTRb = Parameter(m, name="VTRb")
    VTRa  = Parameter(m, name="VTRa")
    VTRb[...] = Sum(I, ERO * PWMO[I] * TM[I] * MO[I])
    VTRa[...]  = Sum(I, ER * PWM[I] * TM[I] * M[I])
    VTR = np.round(((VTRa.toDense() - VTRb.toDense()) / VTRb.toDense()) * 100, 2)
    print("BEFORE: \n", VTRb.toDense(), "\n")
    print("AFTER: \n", VTRa.toDense(), "\n")
    print("CHANGE (in %): \n", VTR, "\n")

    # Build professional-style reports similar to MN1
    # Create a combined set for sectors and households
    IH = Set(m, name="IH", records=[f"I{i}" for i in range(1, len(I)+1)] + [f"H{h}" for h in range(1, len(H)+1)])
    
    summary = Parameter(m, name="oe_summary", domain=["*", "*"])
    sector_household = Parameter(m, name="oe_sector_household", domain=["*", "*", "*"])  # Use wildcard for flexibility
    demand_matrix = Parameter(m, name="oe_demand", domain=["*", H, I, "*"])

    # Summary - General analytics
    summary["Wage Rate", "Benchmark"] = WO
    summary["Wage Rate", "After Shock"] = W.l
    summary["Wage Rate", "Change (%)"] = (W.l - WO) / WO
    summary["Government Revenue", "Benchmark"] = YGO
    summary["Government Revenue", "After Shock"] = YG.l
    summary["Government Revenue", "Change (%)"] = (YG.l - YGO) / YGO
    # summary["Government Savings", "Benchmark"] = SGO
    # summary["Government Savings", "After Shock"] = SG.l
    # # summary["Government Savings", "Change (%)"] = (SG.l - SGO) / SGO
    # summary["Total Investment", "Benchmark"] = sum(INO.toDense())
    # summary["Total Investment", "After Shock"] = sum(IN.toDense())
    # # summary["Total Investment", "Change (%)"] = (sum(IN.toDense()) - sum(INO.toDense())) / sum(INO.toDense())
    # summary["Firm Income", "Benchmark"] = YFRO
    # summary["Firm Income", "After Shock"] = YFR.l
    # # summary["Firm Income", "Change (%)"] = (YFR.l - YFRO) / YFRO
    # summary["Firm Savings", "Benchmark"] = SFRO
    # summary["Firm Savings", "After Shock"] = SFR.l
    # summary["Firm Savings", "Change (%)"] = (SFR.l - SFRO) / SFRO

    # Sector-level analytics
    sector_household["Price", I, "Benchmark"] = PCO[I]
    sector_household["Price", I, "After Shock"] = PC[I]
    sector_household["Price", I, "Change (%)"] = (PC[I] - PCO[I]) / PCO[I]
    sector_household["Output (XTS)", I, "Benchmark"] = XTSO[I]
    sector_household["Output (XTS)", I, "After Shock"] = XTS[I]
    sector_household["Output (XTS)", I, "Change (%)"] = (XTS[I] - XTSO[I]) / XTSO[I]
    # sector_household["Supply (XS)", I, "Benchmark"] = XSO[I]
    # sector_household["Supply (XS)", I, "After Shock"] = XS[I]
    # # sector_household["Supply (XS)", I, "Change (%)"] = (XS[I] - XSO[I]) / XSO[I]
    # sector_household["Labor Demand (L)", I, "Benchmark"] = LO[I]
    # sector_household["Labor Demand (L)", I, "After Shock"] = L[I]
    # sector_household["Labor Demand (L)", I, "Change (%)"] = (L[I] - LO[I]) / LO[I]
    # sector_household["Product Demand (D)", I, "Benchmark"] = DO[I]
    # sector_household["Product Demand (D)", I, "After Shock"] = D[I]
    # sector_household["Product Demand (D)", I, "Change (%)"] = (D[I] - DO[I]) / DO[I]
    
    # Household-level analytics
    # sector_household["Income (YH)", H, "Benchmark"] = YHO[H]
    # sector_household["Income (YH)", H, "After Shock"] = YH[H]
    # sector_household["Income (YH)", H, "Change (%)"] = (YH[H] - YHO[H]) / YHO[H]
    # sector_household["Disposable Income (YDH)", H, "Benchmark"] = YDHO[H]
    sector_household["Disposable Income (YDH)", H, "After Shock"] = YDH[H]
    # sector_household["Disposable Income (YDH)", H, "Change (%)"] = (YDH[H] - YDHO[H]) / YDHO[H]
    sector_household["Consumption (CH)", H, "Benchmark"] = CHO[H]
    sector_household["Consumption (CH)", H, "After Shock"] = CH[H]
    sector_household["Consumption (CH)", H, "Change (%)"] = (CH[H] - CHO[H]) / CHO[H]
    # sector_household["Savings (SH)", H, "Benchmark"] = SHO[H]
    sector_household["Savings (SH)", H, "After Shock"] = SH[H]
    # sector_household["Savings (SH)", H, "Change (%)"] = (SH[H] - SHO[H]) / SHO[H]
    # sector_household["Labor Supply (LSH)", H, "Benchmark"] = LSHO[H]
    # sector_household["Labor Supply (LSH)", H, "After Shock"] = LSH[H]
    # sector_household["Labor Supply (LSH)", H, "Change (%)"] = (LSH[H] - LSHO[H]) / LSHO[H]

    # Demand matrix (household by good)
    demand_matrix["Household Consumption (C)", H, I, "Benchmark"] = CO[I, H]
    demand_matrix["Household Consumption (C)", H, I, "After Shock"] = C[I, H]
    demand_matrix["Household Consumption (C)", H, I, "Change (%)"] = (C[I, H] - CO[I, H]) / CO[I, H]

    from .utils import convert_gams_dict_to_nested  # local import to avoid circulars

    results = {
        'prices': {k: float(v) for k, v in PC.toDict().items()},
        'production': {k: float(v) for k, v in XTS.toDict().items()},
        'wage': float(W.toDense()),
        'professional_reports': {
            'summary': convert_gams_dict_to_nested(summary.toDict(), 'summary'),
            'sector_household': convert_gams_dict_to_nested(sector_household.toDict(), 'sector_household'),
            'demand_matrix': convert_gams_dict_to_nested(demand_matrix.toDict(), 'demand_matrix')
        }
    }
    return results


# build_model(default_sam_file, 5, 2, [2] * 5, [1.5] * 2, [2] * 5, [2, 8, 8, 2, 2])

from typing import Any, Dict, List

from pydantic import BaseModel, Field, field_validator

from .base import WorkspaceTemplate, TemplateInput, TemplateOutput, SamLayoutRequest, SamLayoutResponse, load_descriptor_from_yaml, TemplateDescriptor
from ..mn1_wrapper import solve_mn1


class MN1Input(TemplateInput):
    autoCalibrate: bool = True
    prices: List[float] = Field(default_factory=list)
    wage: float = 1.0
    # Utility shares per sector (if manual)
    alpha: List[float] = Field(default_factory=list)
    # Household x sector utility matrix (if manual)
    beta: List[List[float]] | None = None
    # Technology shift per sector (support both 'A' and legacy 'b')
    A: List[float] | None = None
    b: List[float] = Field(default_factory=list)

    @field_validator('wage')
    @classmethod
    def wage_positive(cls, v: float):
        if v <= 0:
            raise ValueError('wage must be positive')
        return v


class MN1Output(TemplateOutput):
    gdp: float | None = None
    utility: float | None = None


class MN1Template(WorkspaceTemplate):
    def __init__(self, descriptor_path: str):
        super().__init__(load_descriptor_from_yaml(descriptor_path))

    def input_model(self) -> BaseModel:
        return MN1Input()

    def output_model(self) -> BaseModel:
        return MN1Output()

    def get_sam_layout(self, req: SamLayoutRequest) -> SamLayoutResponse:
        # MN1 order: sectors, factors (as provided), households (as provided)
        m = req.sectors
        h = req.households
        factors = self.descriptor.dimensions.get('factors', ['LAB'])

        sectors = [f"IND{i+1}" for i in range(m)]
        households = [f"HH{i+1}" for i in range(h)]

        entries = sectors + factors + households
        blocks = [
            {'kind': 'repeat', 'label': 'SECTORS', 'count': m, 'items': sectors},
            {'kind': 'fixed', 'label': 'FACTORS', 'items': factors},
            {'kind': 'repeat', 'label': 'HOUSEHOLDS', 'count': h, 'items': households},
        ]
        return SamLayoutResponse(rows=entries, cols=entries, blocks=blocks)

    def run(self, params: Dict[str, Any], sam: Dict[str, Any]) -> Dict[str, Any]:
        # Validate params with Pydantic
        validated = MN1Input(**params)
        # Delegate to existing wrapper (expects params+sam)
        # Ensure alpha normalizes and sizes will be handled in wrapper
        out = solve_mn1(validated.model_dump(), sam)
        return MN1Output(**out).model_dump()



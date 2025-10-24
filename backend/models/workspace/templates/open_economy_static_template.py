from typing import Any, Dict, List

from pydantic import BaseModel, Field, field_validator

from .base import WorkspaceTemplate, TemplateInput, TemplateOutput, SamLayoutRequest, SamLayoutResponse, load_descriptor_from_yaml
import os
import tempfile
import pandas as pd
from ..open_economy_model import build_model


class OpenEconomyInput(TemplateInput):
    nSectors: int = Field(..., ge=1)
    nHouseholds: int = Field(..., ge=1)
    SIGP: float | List[float] = 2.0
    SIGC: float | List[float] = 1.5
    SIGM: float | List[float] = 2.0
    SIGX: float | List[float] = 2.0


class OpenEconomyOutput(TemplateOutput):
    # Extend later with revenues etc.
    pass


class OpenEconomyTemplate(WorkspaceTemplate):
    def __init__(self, descriptor_path: str):
        super().__init__(load_descriptor_from_yaml(descriptor_path))

    def input_model(self) -> BaseModel:
        return OpenEconomyInput(nSectors=1, nHouseholds=1)

    def output_model(self) -> BaseModel:
        return OpenEconomyOutput()

    def get_sam_layout(self, req: SamLayoutRequest) -> SamLayoutResponse:
        m = req.sectors
        h = req.households

        sectors = [f"SECT{i+1}" for i in range(m)]
        factors = ['LAB', 'CAP']
        households = [f"HOUSEH{i+1}" for i in range(h)]
        tail = ['FIRMS', 'DIRECT_TX', 'INDIR_TX', 'IMP_TX', 'GOVMT', 'ROW', 'ACCUM']

        entries = sectors + factors + households + tail
        blocks = [
            {'kind': 'repeat', 'label': 'SECTORS', 'count': m, 'items': sectors},
            {'kind': 'fixed', 'label': 'FACTORS', 'items': factors},
            {'kind': 'repeat', 'label': 'HOUSEHOLDS', 'count': h, 'items': households},
            {'kind': 'fixed', 'label': 'TAIL', 'items': tail},
        ]
        return SamLayoutResponse(rows=entries, cols=entries, blocks=blocks)

    def run(self, params: Dict[str, Any], sam: Dict[str, Any]) -> Dict[str, Any]:
        validated = OpenEconomyInput(**params)

        # Validate SAM structure
        if not sam or 'entries' not in sam or 'data' not in sam:
            raise ValueError('SAM must include entries and data')
        entries: List[str] = sam['entries']
        data: List[List[float]] = sam['data']
        if len(entries) != len(data) or any(len(r) != len(entries) for r in data):
            raise ValueError('SAM matrix must be square and match entries length')

        # Verify structure matches our layout (correct counts and order, but names can vary)
        m = validated.nSectors
        h = validated.nHouseholds
        tail_accounts = ['FIRMS', 'DIRECT_TX', 'INDIR_TX', 'IMP_TX', 'GOVMT', 'ROW', 'ACCUM']
        expected_size = m + 2 + h + 7  # sectors + LAB/CAP + households + tail
        
        if len(entries) != expected_size:
            raise ValueError(f'SAM must have {expected_size} entries (sectors={m}, factors=2, households={h}, tail=7), got {len(entries)}')
        
        # Verify the last 7 entries are the fixed tail accounts (names must match exactly)
        if entries[-7:] != tail_accounts:
            raise ValueError(f'SAM must end with tail accounts: {tail_accounts}, got: {entries[-7:]}')

        # Write a temporary Excel file in the format expected by read_sam
        # The model reads a matrix with row/col headers equal and aligned
        df = pd.DataFrame(data, index=entries, columns=entries)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            tmp_path = tmp.name
        try:
            df.to_excel(tmp_path)
            # Run the model
            results = build_model(
                tmp_path,
                validated.nSectors,
                validated.nHouseholds,
                validated.SIGP,
                validated.SIGC,
                validated.SIGM,
                validated.SIGX,
            )
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        return OpenEconomyOutput(**results).model_dump()



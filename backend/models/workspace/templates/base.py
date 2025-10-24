from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import yaml
from pydantic import BaseModel, Field


class SamLayoutRequest(BaseModel):
    sectors: int = Field(..., ge=1)
    households: int = Field(..., ge=1)


class SamLayoutResponse(BaseModel):
    rows: List[str]
    cols: List[str]
    blocks: List[Dict[str, Any]]


class TemplateInput(BaseModel):
    """Base input model. Concrete templates should subclass/extend."""
    # Common optional fields used across templates
    closureRules: Optional[List[Dict[str, Any]]] = None
    shocks: Optional[List[Dict[str, Any]]] = None


class TemplateOutput(BaseModel):
    """Base output model. Concrete templates should subclass/extend."""
    prices: Dict[str, float] = Field(default_factory=dict)
    production: Dict[str, float] = Field(default_factory=dict)
    wage: Optional[float] = None
    benchmark: Optional[Dict[str, Any]] = None
    benchmark_vs_solution: Optional[Dict[str, Any]] = None
    professional_reports: Optional[Dict[str, Any]] = None


class TemplateDescriptor(BaseModel):
    id: str
    name: str
    version: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    dimensions: Dict[str, Any] = Field(default_factory=dict)
    samLayout: Dict[str, Any] = Field(default_factory=dict)
    inputs: Dict[str, Any] = Field(default_factory=dict)
    closures: Dict[str, Any] = Field(default_factory=dict)
    shocks: Dict[str, Any] = Field(default_factory=dict)
    solver: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    uiHints: Dict[str, Any] = Field(default_factory=dict)


def load_descriptor_from_yaml(path: str) -> TemplateDescriptor:
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return TemplateDescriptor(**data)


class WorkspaceTemplate(ABC):
    """Abstract base for all workspace templates."""

    def __init__(self, descriptor: TemplateDescriptor):
        self._descriptor = descriptor

    @property
    def id(self) -> str:
        return self._descriptor.id

    @property
    def name(self) -> str:
        return self._descriptor.name

    @property
    def version(self) -> str:
        return self._descriptor.version

    @property
    def descriptor(self) -> TemplateDescriptor:
        return self._descriptor

    @abstractmethod
    def input_model(self) -> BaseModel:
        """Return an instance of the Pydantic input model (used for schema generation)."""
        raise NotImplementedError

    @abstractmethod
    def output_model(self) -> BaseModel:
        """Return an instance of the Pydantic output model (used for schema generation)."""
        raise NotImplementedError

    @abstractmethod
    def get_sam_layout(self, req: SamLayoutRequest) -> SamLayoutResponse:
        raise NotImplementedError

    @abstractmethod
    def run(self, params: Dict[str, Any], sam: Dict[str, Any]) -> Dict[str, Any]:
        """Validate inputs + SAM, run the model, return outputs."""
        raise NotImplementedError




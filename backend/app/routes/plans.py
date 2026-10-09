from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.routes.recommendations import load_official_air_stations
from app.services.joint_planner import build_joint_plan, compare_coverage, InfeasiblePlan

router = APIRouter(prefix="/api/plans", tags=["Joint network planning"])


class ExistingSimulation(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(default="Planned station", max_length=200)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    category: Literal["air", "noise", "water"] = "air"
    hardwareGrade: Literal["unspecified", "reference", "micro", "iot"] = "unspecified"


class JointPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    stationCount: Literal[1, 2, 3] = 3
    environmentalWeight: float = Field(default=1, ge=0, le=3)
    minSeparationKm: float = Field(default=1, ge=0, le=5)
    existingSimulation: list[ExistingSimulation] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def unique_simulations(self):
        ids = [s.id for s in self.existingSimulation]
        positions = [(s.lat, s.lng) for s in self.existingSimulation]
        if len(ids) != len(set(ids)) or len(positions) != len(set(positions)):
            raise ValueError("Simulation IDs and locations must be unique.")
        return self


@router.post("/joint")
def joint_plan(request: JointPlanRequest):
    try:
        return build_joint_plan(request, load_official_air_stations())
    except InfeasiblePlan as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/coverage")
def coverage(request: JointPlanRequest):
    try:
        return compare_coverage(request, load_official_air_stations())
    except InfeasiblePlan as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

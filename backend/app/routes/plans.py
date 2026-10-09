from typing import Annotated, Literal

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


Radius = Annotated[float, Field(ge=0.05, le=10, allow_inf_nan=False)]

class CoverageRadii(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    air: Radius = 2
    water: Radius = 1.5
    noise: Radius = 1


class JointPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    planningCategory: Literal["air", "noise"] = "air"
    newSensorRadiusKm: Radius | None = None
    coverageRadiiKm: CoverageRadii = Field(default_factory=CoverageRadii)
    sensorRadiusOverridesKm: dict[str, Radius] = Field(default_factory=dict, max_length=500)
    stationCount: Literal[1, 2, 3] = 3
    environmentalWeight: float = Field(default=1, ge=0, le=3)
    minSeparationKm: float = Field(default=1, ge=0, le=5)
    existingSimulation: list[ExistingSimulation] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def unique_simulations(self):
        ids = [s.id for s in self.existingSimulation]
        positions = [(s.lat, s.lng, s.category) for s in self.existingSimulation]
        if len(ids) != len(set(ids)) or len(positions) != len(set(positions)):
            raise ValueError("Simulation IDs and locations must be unique.")
        return self


class DraftStation(ExistingSimulation):
    category: Literal["air", "noise"]
    radiusKm: Radius | None = None


class DraftEvaluationRequest(JointPlanRequest):
    proposedStations: list[DraftStation] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def valid_draft(self):
        if any(s.category != self.planningCategory for s in self.proposedStations):
            raise ValueError("Draft stations must match the planning category.")
        ids = [s.id for s in self.proposedStations]
        if len(ids) != len(set(ids)):
            raise ValueError("Draft station IDs must be unique.")
        for index, station in enumerate(self.proposedStations):
            prior = list(self.proposedStations[:index]) + list(self.existingSimulation)
            if any(other.category == station.category and abs(other.lat - station.lat) < 1e-6 and abs(other.lng - station.lng) < 1e-6 for other in prior):
                raise ValueError("Proposals must not duplicate another proposed or chosen location.")
        return self


@router.post("/evaluate")
def evaluate_draft(request: DraftEvaluationRequest):
    from app.services.draft_evaluation import evaluate_draft_plan
    try:
        return evaluate_draft_plan(request, load_official_air_stations() if request.planningCategory == "air" else [])
    except InfeasiblePlan as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/joint")
def joint_plan(request: JointPlanRequest):
    try:
        return build_joint_plan(request, load_official_air_stations() if request.planningCategory == "air" else [])
    except InfeasiblePlan as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/coverage")
def coverage(request: JointPlanRequest):
    try:
        return compare_coverage(request, load_official_air_stations() if request.planningCategory == "air" else [])
    except InfeasiblePlan as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/noise-sites")
def noise_sites():
    from app.services.noise_planning_data import load_noise_sites
    sites = load_noise_sites()
    if not sites:
        raise HTTPException(status_code=503, detail="Noise measurement sites are unavailable.")
    return {"stations": sites, "source": "Historical noise measurements, not live telemetry"}

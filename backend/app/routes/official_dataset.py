from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.environmental_conditions import get_environmental_conditions
from app.services.processed_dataset_service import (
    get_dataset_summary,
    get_latest_station_measurements,
)

router = APIRouter(
    prefix="/api/official-dataset",
    tags=["Official Dataset"],
)


@router.get("/conditions")
def environmental_conditions() -> dict[str, Any]:
    return get_environmental_conditions()


@router.get("/summary")
def dataset_summary() -> dict[str, Any]:
    try:
        return get_dataset_summary()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


@router.get("/latest")
def latest_measurements() -> dict[str, Any]:
    try:
        stations = get_latest_station_measurements()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    return {
        "count": len(stations),
        "stations": stations,
    }
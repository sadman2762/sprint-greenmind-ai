from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import traffic

from app.routes.data_quality import router as data_quality_router
from app.routes.stations import router as station_router
from app.routes.recommendations import router as recommendations_router
from app.routes.official_dataset import router as official_dataset_router
from app.routes.official_stations import (
    router as official_stations_router,
)
from app.routes.copilot import router as copilot_router
from app.routes.sensor_health import router as sensor_health_router
from app.routes.maintenance import router as maintenance_router
from app.routes.plans import router as plans_router
from app.routes.geocoding import router as geocoding_router

app = FastAPI(
    title="GreenMind AI API",
    description=(
        "Environmental monitoring, data quality and "
        "sensor-placement API."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "GreenMind AI API is running",
    }


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "greenmind-ai-backend",
    }


app.include_router(station_router)
app.include_router(data_quality_router)
app.include_router(recommendations_router)
app.include_router(official_dataset_router)
app.include_router(official_stations_router)
app.include_router(traffic.router)
app.include_router(copilot_router)
app.include_router(sensor_health_router)
app.include_router(maintenance_router)
app.include_router(plans_router)

app.include_router(geocoding_router)

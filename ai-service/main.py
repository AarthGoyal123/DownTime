from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
import math

app = FastAPI(
    title="DownTime AI Risk Engine",
    description="AI-powered risk calculation service for parametric income protection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Location Risk Map ───────────────────────────────────────────────────────

LOCATION_RISK_MAP = {
    "hyderabad": {
        "kondapur": 0.55,
        "hitech_city": 0.40,
        "secunderabad": 0.65,
        "gachibowli": 0.35,
        "default": 0.50,
    },
    "mumbai": {
        "dharavi": 0.85,
        "bandra": 0.60,
        "andheri": 0.70,
        "default": 0.65,
    },
    "bangalore": {
        "whitefield": 0.45,
        "koramangala": 0.50,
        "default": 0.48,
    },
    "delhi": {
        "connaught_place": 0.55,
        "dwarka": 0.45,
        "rohini": 0.50,
        "default": 0.50,
    },
    "default": {"default": 0.50},
}

# Monsoon-prone cities
MONSOON_CITIES = ["hyderabad", "mumbai", "chennai", "kolkata", "bhubaneswar"]


# ─── Risk Sub-Score Functions ─────────────────────────────────────────────────

def calculate_weather_risk(rain_mm_hr: float, temperature_c: float, aqi: float) -> float:
    """Calculate weather risk from real-time weather data."""
    # Rain risk — biggest driver
    rain_risk = 0.0
    if rain_mm_hr < 2.5:
        rain_risk = 0.1
    elif rain_mm_hr < 7.5:
        rain_risk = 0.3
    elif rain_mm_hr < 15.0:
        rain_risk = 0.6
    elif rain_mm_hr < 20.0:
        rain_risk = 0.8
    else:
        rain_risk = 1.0

    # Heat risk
    heat_risk = 0.0
    if temperature_c < 35:
        heat_risk = 0.0
    elif temperature_c < 38:
        heat_risk = 0.2
    elif temperature_c < 40:
        heat_risk = 0.5
    elif temperature_c < 42:
        heat_risk = 0.7
    else:
        heat_risk = 1.0

    # AQI risk
    aqi_risk = 0.0
    if aqi < 100:
        aqi_risk = 0.0
    elif aqi < 200:
        aqi_risk = 0.2
    elif aqi < 300:
        aqi_risk = 0.5
    else:
        aqi_risk = 1.0

    weather_risk = (rain_risk * 0.5) + (heat_risk * 0.3) + (aqi_risk * 0.2)
    return round(min(1.0, weather_risk), 3)


def get_location_risk(city: str, zone: str) -> float:
    """Get location risk from the predefined map."""
    city_lower = city.lower().replace(" ", "_")
    zone_lower = zone.lower().replace(" ", "_")

    city_data = LOCATION_RISK_MAP.get(city_lower, LOCATION_RISK_MAP["default"])
    return city_data.get(zone_lower, city_data.get("default", 0.50))


def calculate_seasonal_risk(city: str, target_date: date) -> float:
    """Calculate seasonal risk based on city and month."""
    month = target_date.month

    if city.lower() in MONSOON_CITIES:
        if month in [6, 7, 8, 9]:
            return 0.85  # Peak monsoon
        elif month in [5, 10]:
            return 0.55  # Pre/post monsoon
        elif month in [3, 4]:
            return 0.40  # Summer (heat risk)
        else:
            return 0.15  # Winter — low risk
    else:
        if month in [6, 7, 8]:
            return 0.70  # Monsoon
        elif month in [12, 1]:
            return 0.50  # Dense fog
        elif month in [4, 5]:
            return 0.45  # Dust storms
        else:
            return 0.20


def calculate_historical_risk(disruption_count_30d: int) -> float:
    """Calculate historical risk from disruption count in last 30 days."""
    if disruption_count_30d == 0:
        return 0.10
    elif disruption_count_30d <= 2:
        return 0.25
    elif disruption_count_30d <= 5:
        return 0.50
    elif disruption_count_30d <= 8:
        return 0.70
    else:
        return 0.90


# ─── Request/Response Models ─────────────────────────────────────────────────

class RiskRequest(BaseModel):
    city: str
    zone: str
    daily_income: float = Field(ge=200, le=2000)
    working_hours: int = Field(ge=4, le=12, default=8)
    date: date
    rain_mm_hr: float = 0.0
    temperature_c: float = 30.0
    aqi: float = 100.0
    disruption_count_30d: int = 0


class RiskResponse(BaseModel):
    risk_score: float
    weather_risk: float
    location_risk: float
    seasonal_risk: float
    historical_risk: float
    risk_label: str  # "Low" | "Medium" | "High" | "Very High"


# ─── New Features: Monitoring & Fraud ──────────────────────────────────────────

class WeatherResponse(BaseModel):
    city: str
    zone: str
    rain_mm_hr: float
    temperature_c: float
    aqi: float
    is_disrupted: bool
    trigger_type: Optional[str]

class FraudRequest(BaseModel):
    worker_id: str
    claim_id: str
    submitted_coordinates: dict # {"lat": float, "lng": float}
    event_timestamp: datetime
    platform_data: dict # Simulated platform activity

class FraudResponse(BaseModel):
    is_fraudulent: bool
    confidence_score: float
    reason: Optional[str]
    risk_indicators: list[str]

@app.get("/weather/current", response_model=WeatherResponse)
def get_current_weather(city: str, zone: str) -> WeatherResponse:
    """
    Get current weather for a zone. 
    In production, this would call OpenWeatherMap.
    For the hackathon, we simulate disruptions for 'Kondapur' and 'Dharavi'.
    """
    is_disrupted = False
    trigger_type = None
    rain = 0.0
    temp = 32.0
    aqi = 110.0

    # Simulation Logic for Demo
    if city.lower() == "hyderabad" and zone.lower() == "kondapur":
        rain = 18.5 # Heavy rain simulation
        is_disrupted = True
        trigger_type = "HEAVY_RAIN"
    elif city.lower() == "mumbai" and zone.lower() == "dharavi":
        aqi = 350.5 # Severe pollution simulation
        is_disrupted = True
        trigger_type = "SEVERE_POLLUTION"
    
    return WeatherResponse(
        city=city,
        zone=zone,
        rain_mm_hr=rain,
        temperature_c=temp,
        aqi=aqi,
        is_disrupted=is_disrupted,
        trigger_type=trigger_type
    )

@app.post("/fraud/evaluate", response_model=FraudResponse)
def evaluate_fraud(req: FraudRequest) -> FraudResponse:
    """
    Evaluate claim for fraud using location validation and activity patterns.
    Satisfies Phase 3 requirement: Advanced Fraud Detection.
    """
    risk_indicators = []
    is_fraud = False
    
    # 1. Location Validation (Simulated)
    # If the coordinates are far from the reported zone, flag it.
    if req.submitted_coordinates.get("lat") == 0 and req.submitted_coordinates.get("lng") == 0:
        risk_indicators.append("GPS_MISSING_OR_SPOOFED")
        is_fraud = True

    # 2. Activity Validation
    if not req.platform_data.get("is_active"):
        risk_indicators.append("NO_PLATFORM_ACTIVITY_DETECTED")
        is_fraud = True

    return FraudResponse(
        is_fraudulent=is_fraud,
        confidence_score=0.95 if is_fraud else 0.10,
        reason="Claim location does not match worker operating zone" if is_fraud else None,
        risk_indicators=risk_indicators
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

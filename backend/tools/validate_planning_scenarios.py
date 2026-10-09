"""Read-only, fixed scenario report. Run from backend with PYTHONPATH=. .venv/bin/python tools/validate_planning_scenarios.py."""
import json
import math

from app.routes.plans import JointPlanRequest
from app.routes.recommendations import load_official_air_stations
from app.services.joint_planner import build_joint_plan


def main():
    official = load_official_air_stations()
    # Declared in advance; no search for scenarios where Joint wins.
    scenarios = [
        ('two sensors', dict(stationCount=2)),
        ('three sensors', dict(stationCount=3)),
        ('after a manual air location', dict(stationCount=3, existingSimulation=[
            dict(id='scenario-manual', name='Validation only', lat=47.54, lng=21.55, category='air')])),
        ('area only', dict(stationCount=3, environmentalWeight=0)),
        ('higher pollution priority', dict(stationCount=3, environmentalWeight=3)),
    ]
    output = []
    for label, settings in scenarios:
        request = JointPlanRequest(**settings)
        plan = build_joint_plan(request, official)
        joint = plan['jointPlan']['metrics']
        assert math.isclose(sum(s['marginalKm2'] for s in plan['steps']), joint['addedKm2'], abs_tol=1e-8)
        assert math.isclose(sum(s['marginalWeightedGain'] for s in plan['steps']), joint['weightedGain'], abs_tol=1e-8)
        output.append(dict(scenario=label, inputs=request.model_dump(), datasetVersion=plan['datasetVersion'],
                           originalStatus=plan['originalPlan']['status'], original=plan['originalPlan']['metrics'],
                           joint=joint, steps=[dict(location=[s['station']['lat'], s['station']['lng']],
                                                   extraKm2=s['marginalKm2'], overlap=s['overlapFraction'],
                                                   recalculation=s['recalculation']) for s in plan['steps']]))
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()

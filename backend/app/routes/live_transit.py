from fastapi import APIRouter, Response
from app.services.live_transit import snapshot

router = APIRouter(prefix='/api/transit', tags=['Live transport'])


@router.get('/vehicles')
def vehicles(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return snapshot()

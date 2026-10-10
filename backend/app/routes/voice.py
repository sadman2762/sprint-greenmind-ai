import asyncio
import json
import ssl
from urllib.parse import urlsplit
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidProxyStatus, InvalidStatus
from fastapi import WebSocket, WebSocketDisconnect
from app.services.voice_service import configuration, session_configuration
from app.services.voice_policy import allowed_voice_event, VoiceSessionGuard
from app.services.outbound import connect_websocket
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from app.services.voice_service import create_session, status

router = APIRouter(prefix='/api/voice', tags=['Voice control'])


class VoiceSessionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sdp: str = Field(min_length=20, max_length=100_000)


@router.get('/status')
def voice_status(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return status()


@router.post('/session')
def voice_session(body: VoiceSessionRequest, request: Request, response: Response):
    # Same-origin browser JSON request; never a generic arbitrary Azure proxy.
    if request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Cross-site voice sessions are not allowed.')
    if not body.sdp.startswith('v=0'):
        raise HTTPException(422, 'Expected a WebRTC SDP offer.')
    response.headers['Cache-Control'] = 'no-store'
    return create_session(body.sdp)




@router.websocket('/stream')
async def voice_stream(browser: WebSocket):
    origin = urlsplit(browser.headers.get('origin', ''))
    host = browser.headers.get('host', '')
    local_origin = origin.hostname in {'localhost', '127.0.0.1'} and origin.port in {5173, 4173, 8000}
    if origin.scheme not in {'http', 'https'} or not (origin.netloc == host or local_origin):
        await browser.close(code=1008)
        return
    await browser.accept()
    endpoint, _, _, key, local_only, valid, missing = configuration()
    if local_only or not valid or missing:
        await browser.send_json({'type': 'relay.error', 'message': status()['reason']})
        await browser.close(code=1008)
        return
    try:
        async with connect_websocket(endpoint.replace('https://', 'wss://', 1) + '/openai/v1/live/sessions',
                           connector=connect, additional_headers={'Authorization': 'Bearer ' + key},
                           open_timeout=20, max_size=2**22) as azure:
            await azure.send(json.dumps({'type': 'session.start', 'session': session_configuration()}))

            guard = VoiceSessionGuard()

            async def to_azure():
                while True:
                    raw = await browser.receive_text()
                    if len(raw) > 100_000:
                        raise ValueError('Voice message too large')
                    event = json.loads(raw)
                    event = guard.from_browser(event)
                    await azure.send(json.dumps(event))
                    if event['type'] == 'session.close':
                        return

            async def to_browser():
                async for raw in azure:
                    event = guard.from_azure(json.loads(raw))
                    if event is not None:
                        await browser.send_json(event)

            tasks = [asyncio.create_task(to_azure()), asyncio.create_task(to_browser())]
            try:
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                try:
                    await azure.send(json.dumps({'type': 'session.close'}))
                except Exception:
                    pass
    except WebSocketDisconnect:
        return
    except Exception as error:
        try:
            await browser.send_json({'type': 'relay.error', **connection_error(error)})
        except Exception:
            pass
    finally:
        try:
            await browser.close()
        except RuntimeError:
            pass


def connection_error(error):
    # Never send raw exception text: proxy URLs can contain credentials.
    if isinstance(error, ssl.SSLError):
        return {'code': 'tls_failed', 'message': 'The backend could not verify the secure Azure connection. Check the network certificate configuration.'}
    if isinstance(error, InvalidProxyStatus):
        return {'code': 'proxy_rejected', 'message': 'The configured proxy rejected the connection. Check proxy access or authentication on the backend.'}
    if isinstance(error, InvalidStatus):
        status = error.response.status_code
        message = {401: 'Azure rejected the voice key.', 403: 'Azure denied access to the voice deployment.',
                   404: 'Azure voice endpoint or deployment was not found.', 429: 'Azure voice quota is temporarily exhausted.'}.get(status, 'Azure could not start the voice connection. Try again.')
        return {'code': 'azure_rejected', 'message': message}
    if isinstance(error, OSError):
        return {'code': 'network_unreachable', 'message': 'The backend cannot reach Azure on this network. Check internet access and backend proxy settings, then reconnect.'}
    if isinstance(error, ValueError):
        return {'code': 'invalid_connection', 'message': 'Invalid voice connection settings or message. Check backend network settings and reconnect.'}
    return {'code': 'connection_interrupted', 'message': 'Azure audio connection was interrupted. Please reconnect.'}

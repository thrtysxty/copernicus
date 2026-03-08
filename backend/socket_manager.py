from flask_socketio import SocketIO, Namespace, emit, join_room, leave_room
from flask import request
import logging
logger = logging.getLogger(__name__)


socketio = SocketIO(cors_allowed_origins=None, async_mode='threading')

class AgentsNamespace(Namespace):
    def on_connect(self):
        logger.info(f"Client connected to /agents: {request.sid}")
        emit('connection_status', {'status': 'connected', 'namespace': '/agents'})

    def on_disconnect(self):
        logger.info(f"Client disconnected from /agents: {request.sid}")

    def on_subscribe_session(self, data):
        session_id = data.get('session_id')
        if session_id:
            join_room(session_id)
            logger.info(f"Client {request.sid} joined room: {session_id}")
            emit('subscribed', {'session_id': session_id, 'status': 'success'})

    def on_unsubscribe_session(self, data):
        session_id = data.get('session_id')
        if session_id:
            leave_room(session_id)
            logger.info(f"Client {request.sid} left room: {session_id}")

class TelemetryNamespace(Namespace):
    def on_connect(self):
        logger.info(f"Client connected to /telemetry: {request.sid}")
        emit('connection_status', {'status': 'connected', 'namespace': '/telemetry'})

    def on_disconnect(self):
        logger.info(f"Client disconnected from /telemetry: {request.sid}")

socketio.on_namespace(AgentsNamespace('/agents'))
socketio.on_namespace(TelemetryNamespace('/telemetry'))

def emit_token_stream(session_id, token, done=False):
    """
    Emits a token_stream event to a specific session room.
    """
    socketio.emit('token_stream', {
        'session_id': session_id,
        'token': token,
        'done': done
    }, room=session_id, namespace='/agents')

def emit_tool_status(session_id, message, tool_name=None):
    """
    Emits a tool_status event to a specific session room.
    """
    socketio.emit('tool_status', {
        'session_id': session_id,
        'message': message,
        'tool_name': tool_name
    }, room=session_id, namespace='/agents')

from flask_socketio import SocketIO, emit

class SocketManager:
    _instance = None
    _socketio: SocketIO = None

    def __new__(cls, app=None, message_queue=None):
        if cls._instance is None:
            cls._instance = super(SocketManager, cls).__new__(cls)
            if app is not None:
                cls._socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")
        return cls._instance

    @classmethod
    def get_socketio(cls) -> SocketIO:
        if cls._socketio is None:
            raise RuntimeError("SocketManager not initialized. Call with app object first.")
        return cls._socketio

    def emit_token_stream(self, session_id: str, token: str, done: bool):
        if not self._socketio:
            print("SocketIO not initialized, cannot emit token stream.")
            return
        with self._socketio.app.app_context():
            self._socketio.emit('token:stream', {'sessionId': session_id, 'token': token, 'done': done}, namespace='/agents')

    def emit_agent_status(self, session_id: str, message: str):
        if not self._socketio:
            print("SocketIO not initialized, cannot emit agent status.")
            return
        with self._socketio.app.app_context():
            self._socketio.emit('agent:status', {'sessionId': session_id, 'message': message}, namespace='/telemetry')

# Example usage (for testing/initialization)
# if __name__ == '__main__':
#     from flask import Flask
#     app = Flask(__name__)
#     socket_manager = SocketManager(app)
#     # Now you can use socket_manager.emit_token_stream(...) or socket_manager.emit_agent_status(...)

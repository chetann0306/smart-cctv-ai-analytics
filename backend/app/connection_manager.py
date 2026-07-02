from fastapi import WebSocket
from typing import List

class ConnectionManager:
    def __init__(self):
        # Keeps track of all active browser/frontend connections
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"New client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast_alert(self, message: dict):
        # Sends real-time security alerts to ALL connected dashboard clients instantly
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle broken connections gracefully
                self.active_connections.remove(connection)

manager = ConnectionManager()
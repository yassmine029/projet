import json
from channels.generic.websocket import AsyncWebsocketConsumer


class RegistrationProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.group_name = f'registration_{self.job_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            'type': 'connected',
            'jobId': self.job_id,
            'message': 'WebSocket connected for registration progress.',
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def registration_progress(self, event):
        await self.send(text_data=json.dumps({
            'type': 'progress',
            'jobId': event.get('jobId'),
            'status': event.get('status', 'processing'),
            'stage': event.get('stage', 'processing'),
            'progress': event.get('progress', 0),
            'message': event.get('message', ''),
        }))

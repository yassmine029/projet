from django.urls import re_path
from .consumers import RegistrationProgressConsumer

websocket_urlpatterns = [
    re_path(r'^ws/registration/(?P<job_id>[\w-]+)/$', RegistrationProgressConsumer.as_asgi()),
]

import re

with open('backend_django/api/serializers.py', 'r') as f:
    text = f.read()

# Fix 1
text = re.sub(
    r'<<<<<<< HEAD[\s\S]*?from \\.models include[\s\S]*?>>>>>>> origin/yesmine',
    'from .models import *',
    text,
)

with open('backend_django/api/serializers.py', 'w') as f:
    f.write(text)

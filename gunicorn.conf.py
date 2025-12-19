# gunicorn.conf.py
# Server socket
bind = "0.0.0.0:5000"

# Worker processes
workers = 3
worker_class = "gevent"

# Preload the application before forking worker processes
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"

# Process naming
# proc_name = "CanvasIligan_Search_Service"

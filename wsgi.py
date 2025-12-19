# wsgi.py
import os

# Set TOKENIZERS_PARALLELISM to false before importing anything else
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

# Apply gevent monkey patching before any other imports
from gevent import monkey
monkey.patch_all()

# Now, import the Flask app
from semantic_search_server import app

if __name__ == "__main__":
    # This allows running the app directly for simple testing, 
    # but gunicorn should be used for production.
    app.run()

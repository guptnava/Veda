from sentence_transformers import SentenceTransformer

import nltk
import ssl
import os

try:
    _create_unverified_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_context

# Define the path to your project's data folder
project_data_dir = "./nltk_data" # You can change this to your desired folder name

# Create the directory if it doesn't exist
os.makedirs(project_data_dir, exist_ok=True)

# Download the wordnet corpus to the specified directory
# Use the 'download_dir' parameter
nltk.download('wordnet', download_dir=project_data_dir)

# Add the project data directory to NLTK's search path
nltk.data.path.append(project_data_dir)

print(f"WordNet corpus downloaded to: {project_data_dir}")
print(f"NLTK data paths: {nltk.data.path}")



model = SentenceTransformer('all-MiniLM-L6-v2')
model.save('local_all-MiniLM-L6-v2')

model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
model.save('local_paraphrase-MiniLM-L6-v2')



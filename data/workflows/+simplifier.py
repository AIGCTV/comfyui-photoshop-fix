import json
import os
from collections import defaultdict

def simplify_ids(data):
    all_ids = set()
    for node in data['nodes']:
        all_ids.add(node['id'])
    for link in data['links']:
        all_ids.add(link[1])
        all_ids.add(link[3])

    sorted_ids = sorted(all_ids)
    id_mapping = {old_id: new_id + 1 for new_id, old_id in enumerate(sorted_ids)}

    for node in data['nodes']:
        node['id'] = id_mapping[node['id']]

    for link in data['links']:
        link[1] = id_mapping[link[1]]
        link[3] = id_mapping[link[3]]

    data['last_node_id'] = len(id_mapping)

    return data

def compact_float(obj):
    if isinstance(obj, float):
        return round(obj, 6)  # Adjust precision as needed
    return obj

def process_json_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    simplified_data = simplify_ids(data)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(simplified_data, f, ensure_ascii=False, separators=(',', ':'), default=compact_float)

def process_all_json_files():
    current_directory = os.getcwd()
    json_files = [f for f in os.listdir(current_directory) if f.endswith('.json')]

    for json_file in json_files:
        file_path = os.path.join(current_directory, json_file)
        print(f"Processing {json_file}...")
        process_json_file(file_path)
        print(f"Simplified {json_file} has been saved.")

    print(f"All JSON files in the current directory have been processed and simplified.")

# Run the script
if __name__ == "__main__":
    process_all_json_files()
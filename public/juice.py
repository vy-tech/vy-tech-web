import json

with open("data.json") as fil:
    data = json.loads(fil.read())


for row in data:
    for emotion in row['emotions']:
        if emotion['score'] > 0:
            emotion['score'] *= 1.5
        else:
            emotion['score'] *= 0.75

with open("data-juiced.json", "w") as fil:
    fil.write(json.dumps(data))

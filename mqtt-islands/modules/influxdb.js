import { exec } from 'node:child_process'

/*
{
  "metadata": {
    "island": "skeppsholmen",
    "timestamp": "2024-11-19T04:59:43.405Z"
  },
  "temp": 76.52394317895174,
  "humidity": 28.606149841897132,
  "pressure": 1003.3289466281659
  "dimensions": {
    "island": "skeppsholmen",
    "location": "office"
  }
}
*/

export async function logWeatherToInflux(event, state) {
  const measurements = {
    temp: event.temp,
    pressure: event.pressure,
    humidity: event.humidity
  }
  const labels = {
    name: state.name,
    island: state.name,
    location: state.location
  }

  return logToInflux('weather', measurements, labels, state)
}

async function logToInflux(measurementName, event, labels, state) {
  let data = [],
    labels = []

  for (const [key, value] of Object.entries(event.readings)) {
    if (key !== 'metadata' && key !== 'aggregationMetadata') {
      data.push(`${key}=${value}`)
    }
  }

  for (const [labelKey, labelValue] of Object.entries(event.dimensions)) {
    labels.push(`${labelKey}=${labelValue}`)
  }

  labels = labels.join(',')
  if (labels.length) labels = `,${labels}`
  data = data.join(',')

  let line = `${measurementName}${labels} ${data} ${new Date().valueOf()}`
  const { url, organization, bucket, precision, token } = state
  let command = `curl --request POST \
                 --header "Authorization: Token ${token}" \
                 --header "Content-Type: text/plain; charset=utf-8" \
                 --header "Accept: application/json" \
                 --data-binary "${line}" \
                "${url}?org=${organization}&bucket=${bucket}&precision=${precision}"`
  return exec(command)
}


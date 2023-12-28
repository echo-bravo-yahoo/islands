const aws = require('aws-sdk')
const iot = new aws.IotData({endpoint: 'ayecs2a13r9pv-ats.iot.us-west-2.amazonaws.com'})

exports.handler = async (event, context, callback) => {
  var params = {
    topic: event.topic,
    payload: JSON.stringify(event),
    qos: 1
  }

  console.log(`Re-broadcasting event ${JSON.stringify(JSON.parse(params.payload), null, 2)} for topic ${params.topic}.`)

  const promise = new Promise((resolve, reject) => {
    iot.publish(params, function(err, data) {
      if (err) {
        console.log(err)
        reject(err)
      } else {
        console.log('Event successfully re-broadcast.')
        resolve(event)
      }
    })
  })

  return promise
}

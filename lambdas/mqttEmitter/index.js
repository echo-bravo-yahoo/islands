const aws = require('aws-sdk')
const iot = new aws.IotData({endpoint: 'ayecs2a13r9pv-ats.iot.us-west-2.amazonaws.com'})

exports.handler = async (event, context, callback) => {
  var params = {
    topic: event.topic,
    payload: JSON.stringify(event),
    qos: 1
  }

  const promise = new Promise((resolve, reject) => {
    iot.publish(params, function(err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(event)
      }
    })
  })

  return promise
}

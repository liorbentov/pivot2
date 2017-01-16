import Rx from 'rxjs/Rx'
import IO from 'socket.io-client'
const socket = IO(`${location.protocol}//${location.host}`)

import transformer from '../../store/transformer.js'

let chunks = []
let maxChunksLimit = 1

let result = Rx.Observable.create(function (subscriber) {
  socket.on('streamChunk', function(data) {
    if (chunks.length >= maxChunksLimit || data.end) {
      subscriber.next(chunks)
      chunks = []
    } else {
      chunks.push(data)
    }
  })
})
const subscriber = result.subscribe((data) => {
  if (data.length>0){
    self.postMessage({data, type:'onChunks'})
  }
})

self.addEventListener('message', (e) => {
  const {type} = e.data
  if (type==='prepareQueryArgs'){
    const {url, token, jaql, chunksLimit} = e.data
    maxChunksLimit = chunksLimit
    const result = transformer.prepareQueryArgs(url, token, jaql)
    self.postMessage({...result, type:'startQuery'})
  } else if (type==='startStreamRequest') {
    const {baseUrl, fullToken, parsedJaql, datasource} = e.data
    socket.emit('streamRequest', {
      jaql: parsedJaql,
      token: fullToken,
      baseUrl: `http://${baseUrl}`,
      datasource,
    })
  } else if (type==='cancelStream') {
    if (subscriber && typeof(subscriber.dispose)==='function'){
      subscriber.dispose()
    }
    socket.emit('cancelStream')
  }
})

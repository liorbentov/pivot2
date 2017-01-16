export default {
  jaqlresultToPivot: jaql => {
    const hirarchy = jaql.metadata.reduce((res, curr)=>{
      res[curr.field.index] =
        Object.assign({}, curr.field,
          {name:jaql.headers[curr.field.index], type:curr.panel}
        )

      return res
    },[])

    return {
      hirarchy,
      data: jaql.values,
    }
  },

  prepareQueryArgs: (url, token, jaql)=>{
    let baseUrl = url

    if (baseUrl.indexOf('://') > -1) {
      baseUrl = baseUrl.split('/')[2]
    } else {
      baseUrl = baseUrl.split('/')[0]
    }

    let fullToken = token

    if (!fullToken.startsWith('Bearer ')) {
      fullToken = `Bearer ${token}`
    }

    const parsedJaql = `data=${encodeURIComponent(encodeURIComponent(jaql))}`

    let jaqlJson

    try {
      jaqlJson = JSON.parse(jaql)
    } catch (err) {
      console.error('err', err)
      return
    }

    const datasource = jaqlJson.datasource.id || jaqlJson.datasource.fullname

    return {
      baseUrl,
      fullToken,
      parsedJaql,
      datasource,
    }
  },
}
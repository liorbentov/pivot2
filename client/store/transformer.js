import { LEAF_CHILDREN_COUNT_SYM, SUBTOTALS_DATA_COUNT_SYM } from '../constants/symbols'
import helpers from '../Utils/helpers.js'

export default {
  jaqlresultToPivot: jaql => {
    const hirarchy = jaql.metadata.reduce((res, curr) => {
      res[curr.field.index] =
        Object.assign({}, curr.field,
          {name:jaql.headers[curr.field.index], type:curr.panel}
        )

      return res
    }, [])

    return {
      hirarchy,
      data: jaql.values,
    }
  },

  prepareQueryArgs: ({url, token, jaql, pageSize, pageNumber}) => {
    let jaqlJson
    try {
      const parsedPageNumber = parseInt(pageNumber)
      jaqlJson = JSON.parse(jaql)
      jaqlJson.count = parseInt(pageSize)
      jaqlJson.offset = (parsedPageNumber - 1) * pageSize
    } catch (err) {
      console.error('err', err)
      return
    }

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

    const parsedJaql = `data=${encodeURIComponent(encodeURIComponent(JSON.stringify(jaqlJson)))}`
    const datasource = jaqlJson.datasource

    const hierarchy = jaqlJson.metadata.reduce((res, curr) => {
      if (curr && curr.field){
        res[curr.field.index] =
        Object.assign({}, curr.field,
          {name:curr.jaql.title, type:curr.panel}
        )
      }

      return res
    }, [])

    const colsGrandTotalsExists = helpers.getByPath(jaqlJson, 'grandTotals.columns')
    const rowsGrandTotalsExists = helpers.getByPath(jaqlJson, 'grandTotals.rows')

    const pivotSubTotals = helpers.getSubTotalsFromJaql(jaqlJson)

    return {
      baseUrl,
      fullToken,
      parsedJaql,
      datasource,
      hierarchy,
      subTotals: pivotSubTotals,
      grandTotals: {
        columns: colsGrandTotalsExists,
        rows: rowsGrandTotalsExists,
      },
    }
  },

  getRowPath:(hierarchy, row) => {
    const rowHierarchyIndexes = hierarchy
    .map((hierarchyPart,index) => {
      if (hierarchyPart.type==='rows') {
        return index
      } else {
        return null
      }
    }).filter(hierarchyPart => hierarchyPart!==null)

    return rowHierarchyIndexes.map(rowIndex => row[rowIndex])
  },
  getColPath:(hierarchy, row) => {
    const colHierarchyIndexes = hierarchy
    .map((hierarchyPart,index) => {
      if (hierarchyPart.type==='columns'){
        return index
      } else {
        return null
      }
    }).filter(hierarchyPart => hierarchyPart!==null)

    return colHierarchyIndexes.map(colIndex => row[colIndex])
  },
  upsertRow:(headersData, rowPath, row, subtotalsRowsLayers) => {
    let part = headersData.rows
    let updateLeafCount = false

    if (rowPath.length>0) {
      rowPath.forEach((pathPart, index, rowPath) => {
        if (index === rowPath.length-1) {
          if (part[pathPart] === undefined) {
            updateLeafCount = true
            part[pathPart] = [row]
          } else {
            part[pathPart].push(row)
          }
        } else {
          if (part[pathPart] === undefined) {
            let newLayer = {}

            if (subtotalsRowsLayers.indexOf(index) > -1) {
              newLayer[SUBTOTALS_DATA_COUNT_SYM] = []
            }

            part[pathPart] = newLayer
          }
        }


        part = part[pathPart]
      })
    } else {
      if (Array.isArray(headersData.rows)) {
        headersData.rows.push(row)
      } else {
        headersData.rows = [row]
      }
    }

    if (updateLeafCount) {
      part = headersData.rows
      rowPath.forEach((pathPart) => {
        if (part[pathPart][LEAF_CHILDREN_COUNT_SYM] === undefined) {
          part[pathPart][LEAF_CHILDREN_COUNT_SYM] = 1
        } else {
          part[pathPart][LEAF_CHILDREN_COUNT_SYM]++
        }

        part = part[pathPart]
      })
    }

    return headersData
  },
  upsertCol:(headersData, colPath, row, subtotalsColsLayers) => {
    let part = headersData.cols
    let updateLeafCount = false

    colPath.forEach((pathPart, index, colPath) => {
      if (index === colPath.length-1) {
        if (part[pathPart] === undefined) {
          updateLeafCount = true
          part[pathPart] = [row]
        } else {
          part[pathPart].push(row)
        }
      } else {
        if (part[pathPart] === undefined) {
          let newLayer = {}

          if (subtotalsColsLayers.indexOf(index) > -1) {
            newLayer[SUBTOTALS_DATA_COUNT_SYM] = []
          }

          part[pathPart] = newLayer
        }
      }

      part = part[pathPart]
    })

    if (updateLeafCount) {
      part = headersData.cols
      colPath.forEach((pathPart) => {
        if (part[pathPart][LEAF_CHILDREN_COUNT_SYM] === undefined) {
          part[pathPart][LEAF_CHILDREN_COUNT_SYM] = 1
        } else {
          part[pathPart][LEAF_CHILDREN_COUNT_SYM]++
        }

        part = part[pathPart]
      })
    }

    return headersData
  },

  headersDataToBodyMatrix:(headersData, hierarchy) => {
    // Build body data rows headers
    const bodyDataRowsHeaders = buildBodyDataRowsHeaders(headersData.rows)
    // build body data
    const bodyData = buildBodyData(headersData, hierarchy)

    return {
      bodyDataRowsHeaders,
      bodyData,
    }
  },

  getHeadersData: (headersData, hierarchy) => {
    const hierarchyData = hierarchy.filter(header => header.type === 'measures')
    const hierarchyRows = hierarchy.filter(header => header.type === 'rows')
    const hierarchyCols = hierarchy.filter(header => header.type === 'columns')
    const dataHeaders = buildDataHeaders(hierarchyData)
    const rowsHeaders = buildRowsHeaders(hierarchyRows)
    const colsHeaders = buildColsHeaders(headersData.cols)

    const colspanMuliplier = dataHeaders.length || 1

    const rowsHeadersWithRowspan = rowsHeaders
      .map(rowHeader => Object.assign({},rowHeader,{rowspan:colsHeaders.length + 1}))
    const colsHeadersWithColspan = colsHeaders.map(colLayer => {
      return colLayer.map(colHeader => {
        return Object.assign({}, colHeader, {colspan:colHeader[LEAF_CHILDREN_COUNT_SYM]*colspanMuliplier})
      })
    })

    return {
      rowsHeaders: rowsHeadersWithRowspan,
      colsHeaders: colsHeadersWithColspan,
      dataHeaders,
      hierarchies: {
        hierarchyData,
        hierarchyRows,
        hierarchyCols,
      },
    }
  },
}

function buildBodyDataRowsHeaders(rowsHeadersData) {
  let rowsHeadersDataCurrLayers = [rowsHeadersData]
  let rows = []

  if (Object.keys(rowsHeadersData).length>0){
    while (!Array.isArray(rowsHeadersDataCurrLayers[0])){
      let currIndex = 0
      rowsHeadersDataCurrLayers.forEach((headersDataPart) => {
        Object.keys(headersDataPart)
        .map(rowName=>{
          if(rows[currIndex]===undefined){
            rows[currIndex] = []
          }

          const rowspan = headersDataPart[rowName][LEAF_CHILDREN_COUNT_SYM]

          rows[currIndex].push({
            displayValue:rowName,
            rowspan,
          })

          currIndex += headersDataPart[rowName][LEAF_CHILDREN_COUNT_SYM]
        })
      })

      rowsHeadersDataCurrLayers = rowsHeadersDataCurrLayers.map(headerPart=>{
        return Object.keys(headerPart).map(headerPartName=>{
          return headerPart[headerPartName]
        }).reduce((res,cur)=>res.concat(cur), [])
      }).reduce((res,cur)=>res.concat(cur), [])
    }
  }

  return rows
}

function getSubtotalsNum(headersData) {
  // Check for grandTotals
  let numOfSubtotals = headersData[SUBTOTALS_DATA_COUNT_SYM] ? 1 : 0

  let HeadersDataCurrLayers = [headersData]

  if (Object.keys(headersData).length>0){
    while (!Array.isArray(HeadersDataCurrLayers[0])){
      HeadersDataCurrLayers.forEach((headersDataPart) => {
        Object.keys(headersDataPart)
        .forEach(currKey=>{
          if (headersDataPart[currKey][SUBTOTALS_DATA_COUNT_SYM] &&
              headersDataPart[currKey][LEAF_CHILDREN_COUNT_SYM] > 1) {
            numOfSubtotals = numOfSubtotals + 1
          }
        })
      })

      HeadersDataCurrLayers = HeadersDataCurrLayers.map(headerPart=>{
        return Object.keys(headerPart).map(headerPartName=>{
          return headerPart[headerPartName]
        }).reduce((res,cur)=>res.concat(cur), [])
      }).reduce((res,cur)=>res.concat(cur), [])
    }
  }

  return numOfSubtotals
}

function buildBodyData(headersData, hierarchy) {
  let dataParts = Array.isArray(headersData.rows) ? headersData.rows : [headersData.rows]

  while (!Array.isArray(dataParts[0])) {
    dataParts = dataParts.map(headerPart => {
      return Object.keys(headerPart).map(headerPartName => {
        return headerPart[headerPartName]
      }).reduce((res,cur) => res.concat(cur), [])
    }).reduce((res,cur) => res.concat(cur), [])
  }

  // TODO: don't create the keys everytime
  let matrixColsCount = Object.keys(headersData.cols).reduce((res, curr) => {
    return res + headersData.cols[curr][LEAF_CHILDREN_COUNT_SYM]
  },0)

  const measuresCount = hierarchy.filter((curr) => {
    return curr.type === 'measures'
  }).length || 1

  const colsSubtotalsNum = getSubtotalsNum(headersData.cols)

  matrixColsCount = matrixColsCount + colsSubtotalsNum

  let matrixRowsCount = 1
  if (!Array.isArray(headersData.rows)) {
    matrixRowsCount = Object.keys(headersData.rows).reduce((res, curr) => {
      return res + headersData.rows[curr][LEAF_CHILDREN_COUNT_SYM]
    }, 0)

    const rowsSubtotalsNum = getSubtotalsNum(headersData.rows)

    matrixRowsCount = matrixRowsCount + rowsSubtotalsNum
  }

  let matrix = Array.from(Array(matrixRowsCount)).map((_, rowIndex) => {
    return Array.from(Array(matrixColsCount * measuresCount)).map((_, colIndex) => {
      return {}
    })
  })

  dataParts.forEach((currPart) => {
    if (Array.isArray(currPart)) {
      const rowPart = getRowPosition(hierarchy, headersData.rows, currPart)
      const colPart = getColPosition(hierarchy, headersData.cols, currPart)

      const measures = currPart.filter((curr,index) => {
        return hierarchy[index]&&hierarchy[index].type === 'measures'
      })
      measures.forEach((currMeasure , index) => {
        matrix[rowPart][colPart*measures.length + index] = {
          displayValue:currMeasure,
        }
      })
    }
  })

  return matrix
}


function buildDataHeaders(hierarchyData=[]) {
  return hierarchyData.map(hierarchyDataPart => {
    return {
      colspan: 1,
      displayValue: hierarchyDataPart.name,
    }
  })
}

function buildRowsHeaders(hierarchyRows=[]) {
  return hierarchyRows.map(hierarchyRow => {
    return {
      displayValue: hierarchyRow.name,
    }
  })
}

function buildColsHeaders(colsHeadersData) {
  let colsMatrix = []
  if (Object.keys(colsHeadersData).length>0) {
    let currLayerParts = [colsHeadersData]
    while (!Array.isArray(currLayerParts[0])) {
      let nextLayer = []
      const layer = currLayerParts.map(currLayerPart => {
        return Object.keys(currLayerPart).sort()
        .map(partName => {
          nextLayer.push(currLayerPart[partName])
          return {
            displayValue: partName,
            [LEAF_CHILDREN_COUNT_SYM]: currLayerPart[partName][LEAF_CHILDREN_COUNT_SYM],
          }
        }).reduce((res,cur) => res.concat(cur),[])
      }).reduce((res,cur) => res.concat(cur),[])

      colsMatrix.push(layer)
      currLayerParts = nextLayer
    }
  }

  return colsMatrix
}


function getColPosition(hierarchy, headerColData, rowData) {
  const colsPath = rowData.filter((curr,index) =>
    hierarchy[index]&&hierarchy[index].type==='columns'
  )
  let headerColDataPart = headerColData
  let colIndex = 0
  let colsPathIndex = 0

  while (colsPathIndex<colsPath.length){
    let colsPathPart = colsPath[colsPathIndex]
    let sortedHeaderColDataPartKeys = Object.keys(headerColDataPart).sort()

    const colPathPartPosition = sortedHeaderColDataPartKeys.indexOf(colsPathPart)

    const soFarColsKeys = sortedHeaderColDataPartKeys
      .filter((name, index) => index<=colPathPartPosition)
    soFarColsKeys.forEach((colKey, index, soFarColsKeys) => {
      if (index!==soFarColsKeys.length-1) {
        colIndex += headerColDataPart[colKey][LEAF_CHILDREN_COUNT_SYM]
      } else {
        colsPathIndex++
        headerColDataPart = headerColDataPart[colKey]
      }
    })
  }
  return colIndex
}

function getRowPosition(hierarchy, headerRowData, rowData){
  const rowsPath = rowData.filter((curr,index) =>
    hierarchy[index]&&hierarchy[index].type==='rows'
  )
  let headerRowDataPart = headerRowData
  let rowIndex = 0
  let rowsPathIndex = 0

  while (rowsPathIndex < rowsPath.length){
    let rowsPathPart = rowsPath[rowsPathIndex]
    const rowPathPartPosition = Object.keys(headerRowDataPart)
      .indexOf(rowsPathPart)

    const soFarRowsKeys = Object.keys(headerRowDataPart)
      .filter((name, index) => index<=rowPathPartPosition)
    soFarRowsKeys.forEach((rowKey, index, soFarRowsKeys) => {
      if (index!==soFarRowsKeys.length-1) {
        rowIndex += headerRowDataPart[rowKey][LEAF_CHILDREN_COUNT_SYM]
      } else {
        rowsPathIndex++
        headerRowDataPart = headerRowDataPart[rowKey]
      }
    })
  }

  return rowIndex
}

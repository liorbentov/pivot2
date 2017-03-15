function getByPath(obj, path) {
  return path.split('.').reduce((res, pathPart)=>{
    return res?res[pathPart]:undefined
  },obj)
}

function consolidateHeads(rowsHeaders, colsHeaders, dataHeaders, hierarchies){
  if (!hierarchies){
    return []
  }
  const rowsExists = hierarchies.hierarchyRows.length>0
  const colsExists = hierarchies.hierarchyCols.length>0
  const dataExists = hierarchies.hierarchyData.length>1

  let headerMatrix = []
  let dataCellsAmountToAdd

  if (!rowsExists && !colsExists && !dataExists){
    // TODO: take care of 1 data
    headerMatrix = [[]]
    dataCellsAmountToAdd = dataHeaders.length
  }else if(colsExists && dataExists){
    // hierarchyCols.length + 1
    headerMatrix = Array.from(Array(colsHeaders.length + 1)).map(()=> {
      return []
    })

    dataCellsAmountToAdd = colsHeaders[colsHeaders.length - 1].length
  }else if(rowsExists && !colsExists && !dataExists){
    headerMatrix = [[]]
    dataCellsAmountToAdd = dataHeaders.length
    // 1
  }else if(colsExists || dataExists){
    if (dataExists) {
      headerMatrix = [[]]
      dataCellsAmountToAdd = 1
    } else {
      headerMatrix = Array.from(Array(colsHeaders.length)).map(()=> {
        return []
      })

      dataCellsAmountToAdd = colsHeaders[colsHeaders.length - 1].length
    }
    // hierarchyCols.length || 1
  }

  headerMatrix[0] = headerMatrix[0].concat(rowsHeaders)

  colsHeaders.forEach((currRow, index) => {
    headerMatrix[index] = headerMatrix[index].concat(currRow)
  })

  for (let index = 0; index < dataCellsAmountToAdd; index++) {
    headerMatrix[headerMatrix.length-1] = headerMatrix[headerMatrix.length-1].concat(dataHeaders)
  }

  return headerMatrix
}

module.exports = {
  getByPath,
  consolidateHeads,
}

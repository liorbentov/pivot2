import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import classnames from 'classnames'
// import Sisense, {Widget} from '../../components/Sisense'
import Pivot from '../../components/Pivot'
import QueryPanel from '../../components/QueryPanel'
import style from './style.css'
// import * as BoardActions from '../../ducks/board'

// import mockData from '../../store/data.mock'
import TransformerWorker from '../../store/transformer.webworker'
const transformer = new TransformerWorker()
import * as generator from '../../store/generator'



const generatedDataHirarchy = [{
  name:'date',
  type:'row',
},{
  name:'id',
  type:'row',
},{
  name:'region',
  type:'col',
},{
  name:'country',
  type:'col',
},{
  name:'city',
  type:'col',
},{
  name:'amount',
  type:'value',
}]

const generatedData = generator.generate([{
  name: 'date',
  type: 'date',
  amount: 600,
},{
  name: 'id',
  type: 'integer',
  min: 1,
  max: 9999999999999,
},{
  name: 'region',
  type: 'string',
  amount: 50,
  length: 15,
},{
  name: 'country',
  type: 'string',
  amount: 200,
  length: 30,
},{
  name: 'city',
  type: 'string',
  amount: 400,
  length: 20,
},{
  name: 'amount',
  type: 'integer',
  min: 100,
  max: 1000000,
}], 1000)

const convertedGeneratedData = generatedData.map(row=>{
  let newRow = []
  for(let prop in row){
    newRow.push(row[prop])
  }
  return newRow
})


class App extends Component {
  constructor(props, context) {

    super(props, context)

    this.state = {
      pivotData : {
        hirarchy:generatedDataHirarchy,
        data:convertedGeneratedData,
      },
    }
  }

  getWholeResults(results) {
    transformer.postMessage(results)
    transformer.addEventListener('message',(e)=>{
      this.setState({
        pivotData: e.data,
      })
    })
  }

  onChunks(chunks) {

    const { pivotData } = this.state

    let newData = []
    let newValues = pivotData.data

    chunks.forEach((chunk) => {
      newData = []
      for (let key in chunk) {
        newData.push(chunk[key])
      }
      newValues.push(newData)
    })

    var results = {
      hirarchy: Object.keys(chunks[0]).map((curr)=> {
        return {
          name: curr,
          type: 'row',
        }
      }),
      data: newValues,
    }

    this.setState({
      pivotData: results
    })
  }

  resetStream() {
    let results = {
      hirarchy: [],
      data: [],
    }

    this.setState({
      pivotData: results,
    })
  }

  render() {
    const { pivotData } = this.state

    return (
      <div
          className={classnames(style.container)}
      >
        <QueryPanel getWholeResults={::this.getWholeResults} onChunks={::this.onChunks} resetStream={::this.resetStream}/>
        <Pivot
            data={pivotData.data}
            hirarchy={pivotData.hirarchy}
        />
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    board: state.board,
  }
}

function mapDispatchToProps(dispatch) {
  return {
    // actions: bindActionCreators(BoardActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
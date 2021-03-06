import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import classnames from 'classnames'
import style from './style.css'
import PivotThead from '../PivotThead'
import PivotBody from '../PivotBody'
import PivotCornerHeader from '../PivotCornerHeader'
import PivotColsHeader from '../PivotColsHeader'
import helpers from '../../utils/helpers'
import shallowCompare from 'react-addons-shallow-compare'
import R from 'ramda'
import Rx from 'rxjs/Rx'

export default class PivotView extends Component {
  static propTypes = {
    bodyData: PropTypes.array,
    headersData: PropTypes.object,
    loadNextPage: PropTypes.func,
    pivotFullyCached: PropTypes.bool,
    rowsPanelHeaders: PropTypes.array,
    totalRowsNumber: PropTypes.number,
    subTotalRows: PropTypes.array,
  }

  static defaultProps = {
  }

  constructor(props, context) {
    super(props, context)
    this.handleResize = ()=>{this.forceUpdate.bind(this)}
    this.state = {
      headerSizes: {
      },
      userDefinedSize: false,
      rowsPanelSizes: [],
      newStickyRowsStyle: {},
      stickyHeaderWrapperStyle: {},
      rowPanelsVisible: false,
    }

  }

  handleScroll(e) {
    const pivotTable = e.target

    if (pivotTable === this.pivotScrollWrapper) {
      const {
        scrollTop,
        scrollLeft
      } = this.state

      const newScrollTop = pivotTable.scrollTop
      const newScrollLeft = pivotTable.scrollLeft

      if (!R.equals(scrollTop, newScrollTop)) {
        this.handleVerticalScroll(pivotTable, newScrollTop)
      }

      if (!R.equals(scrollLeft, newScrollLeft)) {
        this.handleHorizontalScroll(pivotTable, newScrollLeft)
      }
    }

  }

  handleVerticalScroll(pivotTable, newScrollTop) {
    const { loadNextPage } = this.props
    let scrollPrecent = newScrollTop / (pivotTable.scrollHeight - pivotTable.clientHeight)

    if (scrollPrecent > 0.7) {
      // loadNextPage()
    }

    this.setState({
      scrollTop: newScrollTop
    })
  }

  handleHorizontalScroll(pivotTable, newScrollLeft) {
    this.setState({
      scrollLeft: newScrollLeft
    })
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
  }

  componentWillMount() {
    window.addEventListener('resize', this.handleResize)
  }

  componentDidMount() {
    const stickyRowsPanel = ReactDOM.findDOMNode(this.stickyRowsPanel)
    const pivotScrollWrapper = ReactDOM.findDOMNode(this.pivotScrollWrapper)

    const mouseWheelObserver = Rx.Observable.fromEvent(stickyRowsPanel, 'wheel')
    const totalNumOfScrolls = 3

    mouseWheelObserver
    .do((e)=>{
      e.preventDefault()
    })
    .bufferTime(120)
    .filter((arrOfEvents)=>arrOfEvents.length>0)
    .map((e)=>{
      const totalDeltaY = e.reduce((res, curr)=> {
        res += curr.deltaY
        return res
      }, 0)

      return {
        incrementPart: Math.floor(totalDeltaY/totalNumOfScrolls),
        numOfScrollsLeft: totalNumOfScrolls,
      }
    })
    .expand((wheelEvent) => {
      wheelEvent.numOfScrollsLeft--

      if (wheelEvent.numOfScrollsLeft === 0) {
        return Rx.Observable.empty()
      }

      return Rx.Observable.of(wheelEvent)
    })
    .filter((eventData)=>eventData!==undefined)
    .map(function (wheelEvent) {
      return Rx.Observable.of(wheelEvent).concat(Rx.Observable.empty().delay(0)) // put some time after the item
    })
    .concatAll()
    .pluck('incrementPart')
    .subscribe((incrementPart) => {
      pivotScrollWrapper.scrollTop += incrementPart
    })

    this.remessure()
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shallowCompare(this, nextProps, nextState)
  }

  componentDidUpdate() {
    this.remessure()
  }

  remessure() {
    setTimeout(()=>{
      const { headersData, rowsPanelHeaders } = this.props
      const { userDefinedSize } = this.state

      let stateToChange = {}

      const pivotHiddenThead = ReactDOM.findDOMNode(this.pivotHiddenThead)

      if (pivotHiddenThead && pivotHiddenThead.childNodes && pivotHiddenThead.childNodes.length > 0) {

        const thNewSizes = this.getHeadersSizes(pivotHiddenThead)

        if (headersData && !userDefinedSize) {
          if (!R.equals(this.state.headerSizes.thSizes, thNewSizes)) {
            const tableSizes = {
              width: this.container.offsetWidth,
            }

            const cornerSizes = this.getCornerSizes(pivotHiddenThead, headersData.rowsHeaders.length)

            stateToChange.headerSizes = {
              thSizes : thNewSizes,
              tableSizes,
              cornerSizes,
            }
          }

          const newStickyHeaderWrapperStyle =
          this.getStickyHeaderWrapperSizes(this.pivotScrollWrapper, pivotHiddenThead)

          if (!R.equals(this.state.stickyHeaderWrapperStyle, newStickyHeaderWrapperStyle)) {
            stateToChange.stickyHeaderWrapperStyle = newStickyHeaderWrapperStyle
          }
        }

        if (rowsPanelHeaders) {
          const pivotBody = ReactDOM.findDOMNode(this.pivotBody)
          const rowsPanelNewSizes = this.getRowPanelSizes(pivotBody)
          const pivotContainer = ReactDOM.findDOMNode(this.pivotScrollWrapper)

          if (!R.equals(this.state.rowsPanelSizes, rowsPanelNewSizes)) {
            stateToChange.rowsPanelSizes = rowsPanelNewSizes
          }

          const newStickyRowsStyle = this.getStickyRowsStyles(this.container)

          // If there is horizontal scroll then rows panel height should be 9px less
          if (pivotContainer.clientWidth < pivotBody.clientWidth) {
            newStickyRowsStyle.height = newStickyRowsStyle.height - (this.pivotScrollWrapper.offsetHeight - this.pivotScrollWrapper.clientHeight)
          }

          if (!R.equals(this.state.stickyRowsStyle, newStickyRowsStyle)) {
            stateToChange.stickyRowsStyle = newStickyRowsStyle
            stateToChange.rowPanelsVisible = true
          }
        }

        if (Object.keys(stateToChange).length) {
          this.setState(stateToChange)
        }
      }
    }, 300)
  }

  getCornerSizes(thead, numOfRowsHeaders) {
    let cornerWidth = 0

    const rowHeadersTr = thead.childNodes[0]

    for (let rowHeaderIndex = 0; rowHeaderIndex < numOfRowsHeaders; rowHeaderIndex++) {
      cornerWidth += rowHeadersTr.childNodes[rowHeaderIndex].offsetWidth
    }

    // TODO: Check how to remove
    cornerWidth += 1

    return {
      width: cornerWidth,
    }
  }

  getStickyHeaderWrapperSizes(pivotContainer, thead) {
    const stickyHeaderWrapperWidth = pivotContainer.clientWidth
    // TODO: Check WTF without the + 1, there is no border at the bottom of the sticky header
    const stickyHeaderWrapperHeight = thead.clientHeight + 1

    return  {
      width: stickyHeaderWrapperWidth,
      height: stickyHeaderWrapperHeight,
    }
  }

  getHeadersSizes(thead) {
    return Array.from(thead.childNodes).map(currTr=>{
      return Array.from(currTr.childNodes).map(currTh=> {
        const newHeight = currTh.offsetHeight
        return {
          height: `${newHeight}px`,
          width: parseInt(window.getComputedStyle(currTh).width),
        }
      })
    })
  }

  getRowPanelSizes(tbody) {
    return Array.from(tbody.childNodes).map(currTr=>{
      return Array.from(currTr.childNodes).filter(currTd=>currTd.rowSpan).map(currTd=> {
        const newHeight = parseInt(window.getComputedStyle(currTd).height) - 3
        //const newHeight = 25
        const newWidth = currTd.offsetWidth-3

        return {
          height: `${newHeight}px`,
          width: `${newWidth}px`
        }
      })
    })
  }

  getStickyRowsStyles(table) {
    const pivotContainerHeight = window.getComputedStyle(table.parentElement).height
    const theadHeight = window.getComputedStyle(table.childNodes[0]).height
    //const theadHeight = 25
    const stickyRowsHeight = parseInt(pivotContainerHeight) - parseInt(theadHeight)

    return {
      height: stickyRowsHeight,
    }
  }

  resizeColumnHandler(rowIndex, selectedColIndex, x){
    const {headersData} = this.props
    const {headerSizes} = this.state
    let colsAugmented = 0

    // go to last row
    const lastRow = headerSizes.thSizes[headerSizes.thSizes.length-1]
    // go through cols
    const newLastRow = lastRow.map(function (col, colIndex) {
      // if first row skip amount of row headers
      if (headerSizes.thSizes[0]===lastRow && colIndex<headersData.rowsHeaders.length){
        return col
      }
      // if more then one meessure then skip if not the right messure
      const messureIndex = colIndex % headersData.dataHeaders.length
      if (headersData.dataHeaders.length>1 && messureIndex!==selectedColIndex-1%headersData.dataHeaders.length){
        return col
      }

      // change col size
      const newSize = parseInt(col.width.slice(0,-2)) + x
      const newCol = Object.assign({},
        col,
        {width:`${newSize}px`}
      )
      colsAugmented++

      return newCol
    })

    this.setState({
      userDefinedSize: true,
      headerSizes: {
        tableSizes: Object.assign({}, headerSizes.tableSizes, {width: headerSizes.tableSizes.width + (colsAugmented * x)}),
        thSizes:[
          ...headerSizes.thSizes.slice(0, headerSizes.thSizes.length-1),
          newLastRow,
        ],
      },
    })
  }

  render() {
    const {headersData, rowsPanelHeaders, bodyData, totalRowsNumber, subTotalRows} = this.props

    const {
      headerSizes,
      rowsPanelSizes,
      scrollLeft,
      scrollTop,
      stickyRowsStyle,
      stickyHeaderWrapperStyle,
      userDefinedSize,
      rowPanelsVisible,
    } = this.state

    let headMatrix = []
    let rowsHeaders = []

    if (headersData) {
      const {colsHeaders, dataHeaders, hierarchies} = headersData
      rowsHeaders = headersData.rowsHeaders
      headMatrix = helpers.consolidateHeads(rowsHeaders, colsHeaders, dataHeaders, hierarchies, bodyData)
    }

    return (
      <div
          className={classnames(style.container)}
          onScroll={::this.handleScroll}
          ref={pivotScrollWrapper=>this.pivotScrollWrapper=pivotScrollWrapper}
      >
        <PivotCornerHeader
            headerSizes={headerSizes}
            rowsHeaders={rowsHeaders}
            stickyHeaderWrapperStyle={stickyHeaderWrapperStyle}
        />
        <PivotColsHeader
            headMatrix={headMatrix}
            headerSizes={headerSizes}
            resizeColumn={::this.resizeColumnHandler}
            rowsHeaders={rowsHeaders}
            scrollLeft={scrollLeft}
            stickyHeaderWrapperStyle={stickyHeaderWrapperStyle}
        />
        <table className={classnames(style.pivotTable)}
            ref={container=>this.container=container}
        >
          <PivotThead
              className={classnames(style.hiddenThead)}
              headMatrix={headMatrix}
              ref={pivotHiddenThead=>this.pivotHiddenThead=pivotHiddenThead}
              thSizes={headerSizes.thSizes}
          />
          <PivotBody
              additionalStyle={stickyRowsStyle}
              className={classnames(style.stickyRowsPanel)}
              rowPanelsVisible={rowPanelsVisible}
              ref={stickyRowsPanel=>this.stickyRowsPanel=stickyRowsPanel}
              rowsPanel
              rowsPanelHeaders={rowsPanelHeaders}
              rowsPanelSizes={rowsPanelSizes}
              scrollTop={scrollTop}
              sticky
              subTotalRows={subTotalRows}
              thSizes={headerSizes.thSizes}
              userDefinedSize={userDefinedSize}
          />
          <PivotBody
              bodyData={bodyData}
              ref={pivotBody=>this.pivotBody=pivotBody}
              rowsPanelHeaders={rowsPanelHeaders}
              subTotalRows={subTotalRows}
              totalRowsNumber={totalRowsNumber}
          />
        </table>
      </div>
    )
  }
}

import mapPlainTextIndex from './mapPlainTextIndex'
import getPlainText from './getPlainText'
import spliceString from './spliceString'

function findFirstDiffPos(a, b) {
  var i = 0;
  if (a === b) return -1;
  while (a[i] === b[i]) i++;
  return i;
}

// Applies a change from the plain text textarea to the underlying marked up value
// guided by the textarea text selection ranges before and after the change
const applyChangeToValue = (
  value,
  plainTextValue,
  { selectionStartBefore, selectionEndBefore, selectionEndAfter },
  config,
  OS,
) => {
  let oldPlainTextValue = getPlainText(value, config)

  let lengthDelta = oldPlainTextValue.length - plainTextValue.length
  if (selectionStartBefore === 'undefined') {
    selectionStartBefore = selectionEndAfter + lengthDelta
  }

  if (selectionEndBefore === 'undefined') {
    selectionEndBefore = selectionStartBefore
  }

  // Fixes an issue with replacing combined characters for complex input. Eg like acented letters on OSX
  if (
    selectionStartBefore === selectionEndBefore &&
    selectionEndBefore === selectionEndAfter &&
    oldPlainTextValue.length === plainTextValue.length
  ) {
    selectionStartBefore = selectionStartBefore - 1
  }

  // extract the insertion from the new plain text value
  let insert = plainTextValue.slice(selectionStartBefore, selectionEndAfter)

  /**
   * fix for Ubuntu(Linux) typing chinese
   * because when typing chinese on ubuntu, selectionEndAfter will not increase, need to find the insert sub string
   */
  if (OS === 'Linux') {
    const sub = plainTextValue.substring(selectionEndAfter);
    const originSub = oldPlainTextValue.substring(selectionEndAfter);
    const diffIndex = findFirstDiffPos(sub, originSub);
    selectionStartBefore = selectionStartBefore + diffIndex;
    const index = sub.lastIndexOf(originSub.substring(diffIndex));

    if (index >= 0) {
      insert = sub.slice(0, index);
      selectionEndAfter = selectionEndAfter + insert.length;
    } else {
      insert = sub.slice(0, -index);
      selectionEndAfter = selectionEndAfter + insert.length;
    }
  }

  // handling for Backspace key with no range selection
  let spliceStart = Math.min(selectionStartBefore, selectionEndAfter)

  // fix for Windows cannot change chinese
  let spliceEnd = oldPlainTextValue.lastIndexOf(
    plainTextValue.substring(selectionEndAfter)
  )

  if (selectionStartBefore === selectionEndAfter) {
    // handling for Delete key with no range selection
    spliceEnd = Math.max(selectionEndBefore, selectionStartBefore + lengthDelta)
  }

  let mappedSpliceStart = mapPlainTextIndex(value, config, spliceStart, 'START')
  let mappedSpliceEnd = mapPlainTextIndex(value, config, spliceEnd, 'END')

  let controlSpliceStart = mapPlainTextIndex(value, config, spliceStart, 'NULL')
  let controlSpliceEnd = mapPlainTextIndex(value, config, spliceEnd, 'NULL')
  let willRemoveMention =
    controlSpliceStart === null || controlSpliceEnd === null

  let newValue = spliceString(value, mappedSpliceStart, mappedSpliceEnd, insert)

  if (!willRemoveMention) {
    // test for auto-completion changes
    let controlPlainTextValue = getPlainText(newValue, config)
    if (controlPlainTextValue !== plainTextValue) {
      // some auto-correction is going on

      // find start of diff
      spliceStart = 0
      while (plainTextValue[spliceStart] === controlPlainTextValue[spliceStart])
        spliceStart++

      // extract auto-corrected insertion
      insert = plainTextValue.slice(spliceStart, selectionEndAfter)

      // find index of the unchanged remainder
      spliceEnd = oldPlainTextValue.lastIndexOf(
        plainTextValue.substring(selectionEndAfter)
      )

      // re-map the corrected indices
      mappedSpliceStart = mapPlainTextIndex(value, config, spliceStart, 'START')
      mappedSpliceEnd = mapPlainTextIndex(value, config, spliceEnd, 'END')
      newValue = spliceString(value, mappedSpliceStart, mappedSpliceEnd, insert)
    }
  }

  return newValue
}

export default applyChangeToValue

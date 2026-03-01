// Random Forest - pure JS implementation (no TF.js needed for decision trees)

self.onmessage = async function (event) {
  const { type, payload } = event.data
  if (type === 'RUN_RF') {
    try {
      const result = await trainRandomForest(payload)
      self.postMessage({ type: 'RESULT', result })
    } catch (e) {
      self.postMessage({ type: 'ERROR', error: e.message })
    }
  }
}

function progress(percent, message) {
  self.postMessage({ type: 'PROGRESS', percent, message })
}

// Decision tree core
function giniImpurity(y) {
  const counts = {}
  for (const v of y) counts[v] = (counts[v] || 0) + 1
  let imp = 1
  for (const c of Object.values(counts)) { const p = c / y.length; imp -= p * p }
  return imp
}

function mse(y) {
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  return y.reduce((s, v) => s + (v - mean) ** 2, 0) / y.length
}

function leafValue(y, type) {
  if (type === 'classification') {
    const counts = {}
    for (const v of y) counts[v] = (counts[v] || 0) + 1
    let maxC = 0, best = null
    for (const [v, c] of Object.entries(counts)) {
      if (c > maxC) { maxC = c; best = Number(v) }
    }
    return best
  }
  return y.reduce((a, b) => a + b, 0) / y.length
}

function buildTree(X, y, features, depth, maxDepth, type) {
  if (depth >= maxDepth || y.length < 4 || new Set(y).size === 1) {
    return { type: 'leaf', value: leafValue(y, type) }
  }

  const calcImp = type === 'classification' ? giniImpurity : mse
  const curImp = calcImp(y)
  let bestGain = 0, bestFeat = -1, bestThresh = 0, improved = false

  for (const fi of features) {
    const vals = [...new Set(X.map((r) => r[fi]))].sort((a, b) => a - b)
    // Sample thresholds for performance (max 20 splits per feature)
    const step = Math.max(1, Math.floor(vals.length / 20))
    for (let i = 0; i < vals.length - 1; i += step) {
      const thresh = (vals[i] + vals[i + 1]) / 2
      const leftY = [], rightY = []
      for (let j = 0; j < X.length; j++) {
        if (X[j][fi] <= thresh) leftY.push(y[j])
        else rightY.push(y[j])
      }
      if (leftY.length === 0 || rightY.length === 0) continue
      const gain = curImp - (leftY.length / y.length) * calcImp(leftY) - (rightY.length / y.length) * calcImp(rightY)
      if (gain > bestGain) { bestGain = gain; bestFeat = fi; bestThresh = thresh; improved = true }
    }
  }

  if (!improved) return { type: 'leaf', value: leafValue(y, type) }

  const leftX = [], leftY = [], rightX = [], rightY = []
  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeat] <= bestThresh) { leftX.push(X[i]); leftY.push(y[i]) }
    else { rightX.push(X[i]); rightY.push(y[i]) }
  }

  return {
    type: 'decision',
    featureIndex: bestFeat,
    threshold: bestThresh,
    left: buildTree(leftX, leftY, features, depth + 1, maxDepth, type),
    right: buildTree(rightX, rightY, features, depth + 1, maxDepth, type),
  }
}

function predictOne(tree, x) {
  if (tree.type === 'leaf') return tree.value
  return x[tree.featureIndex] <= tree.threshold ? predictOne(tree.left, x) : predictOne(tree.right, x)
}

function predictForest(trees, X, type) {
  return X.map((x) => {
    const votes = trees.map((t) => predictOne(t, x))
    if (type === 'classification') {
      const counts = {}
      for (const v of votes) counts[v] = (counts[v] || 0) + 1
      let maxC = 0, best = votes[0]
      for (const [v, c] of Object.entries(counts)) {
        if (c > maxC) { maxC = c; best = Number(v) }
      }
      return best
    }
    return votes.reduce((a, b) => a + b, 0) / votes.length
  })
}

async function trainRandomForest({ data, targetColumn, featureColumns, testSize, numTrees, maxDepth, targetType }) {
  progress(5, 'Preparing data...')

  // Extract X, y
  const X = [], y = []
  for (const row of data) {
    const valid = featureColumns.every((f) => row[f] !== null && row[f] !== undefined && !isNaN(Number(row[f])))
    if (!valid || row[targetColumn] === null || row[targetColumn] === undefined) continue
    X.push(featureColumns.map((f) => Number(row[f])))
    y.push(Number(row[targetColumn]))
  }

  if (X.length === 0) throw new Error('No valid data after filtering')

  // Auto-detect target type
  const uniqueY = new Set(y)
  const actualType = targetType === 'auto' ? (uniqueY.size <= 10 ? 'classification' : 'regression') : targetType

  // Shuffle and split
  const indices = X.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const splitIdx = Math.floor(X.length * (1 - testSize))
  const trainIdx = indices.slice(0, splitIdx), testIdx = indices.slice(splitIdx)
  const trainX = trainIdx.map((i) => X[i]), trainY = trainIdx.map((i) => y[i])
  const testX = testIdx.map((i) => X[i]), testY = testIdx.map((i) => y[i])

  progress(10, `Training ${numTrees} trees...`)

  // Train forest with bagging
  const trees = []
  const numFeatures = featureColumns.length
  const sqrtFeatures = Math.max(1, Math.floor(Math.sqrt(numFeatures)))
  const featureImportanceAcc = new Array(numFeatures).fill(0)

  for (let t = 0; t < numTrees; t++) {
    const pct = 10 + Math.floor((t / numTrees) * 70)
    if (t % Math.max(1, Math.floor(numTrees / 20)) === 0) {
      progress(pct, `Building tree ${t + 1}/${numTrees}`)
    }

    // Bootstrap sample
    const sampleIdx = []
    for (let i = 0; i < trainX.length; i++) {
      sampleIdx.push(Math.floor(Math.random() * trainX.length))
    }
    const sX = sampleIdx.map((i) => trainX[i])
    const sY = sampleIdx.map((i) => trainY[i])

    // Random feature subset
    const allFeats = Array.from({ length: numFeatures }, (_, i) => i)
    const shuffled = allFeats.sort(() => Math.random() - 0.5)
    const subsetFeats = shuffled.slice(0, sqrtFeatures)

    const tree = buildTree(sX, sY, subsetFeats, 0, maxDepth, actualType)
    trees.push(tree)

    // Track feature usage for importance
    function trackFeatures(node) {
      if (!node || node.type === 'leaf') return
      featureImportanceAcc[node.featureIndex]++
      trackFeatures(node.left)
      trackFeatures(node.right)
    }
    trackFeatures(tree)
  }

  progress(85, 'Evaluating...')

  const trainPreds = predictForest(trees, trainX, actualType)
  const testPreds = predictForest(trees, testX, actualType)

  let metrics
  if (actualType === 'classification') {
    let trainCorr = 0, testCorr = 0
    for (let i = 0; i < trainY.length; i++) if (trainPreds[i] === trainY[i]) trainCorr++
    for (let i = 0; i < testY.length; i++) if (testPreds[i] === testY[i]) testCorr++
    metrics = {
      trainAccuracy: +(trainCorr / trainY.length).toFixed(4),
      testAccuracy: +(testCorr / testY.length).toFixed(4),
      type: 'classification',
    }
  } else {
    const testMSE = testY.reduce((s, v, i) => s + (v - testPreds[i]) ** 2, 0) / testY.length
    const trainMSE = trainY.reduce((s, v, i) => s + (v - trainPreds[i]) ** 2, 0) / trainY.length
    metrics = {
      trainRMSE: +Math.sqrt(trainMSE).toFixed(4),
      testRMSE: +Math.sqrt(testMSE).toFixed(4),
      type: 'regression',
    }
  }

  // Feature importance (normalized)
  const totalSplits = featureImportanceAcc.reduce((a, b) => a + b, 0) || 1
  const featureImportance = featureColumns.map((name, i) => ({
    feature: name,
    importance: +(featureImportanceAcc[i] / totalSplits).toFixed(4),
  }))
  featureImportance.sort((a, b) => b.importance - a.importance)

  progress(100, 'Complete')

  return {
    metrics,
    featureImportance,
    trainSize: trainX.length,
    testSize: testX.length,
    numTrees: trees.length,
    maxDepth,
    targetType: actualType,
    uniqueClasses: actualType === 'classification' ? [...uniqueY] : null,
    modelData: { trees, featureColumns, targetColumn, targetType: actualType },
    trainActual: trainY,
    trainPredicted: trainPreds,
    testActual: testY,
    testPredicted: testPreds,
  }
}

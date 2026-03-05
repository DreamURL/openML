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

async function trainRandomForest({ data, targetColumn, featureColumns, testSize, nTrees, maxDepth, targetType, sharedSeed }) {
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

  // Shuffle and split (use seeded shuffle for reproducibility across models)
  function seededRandom(seed) {
    let s = seed | 0
    return function() { s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s = Math.imul(s ^ (s >>> 13), 0x45d9f3b); return ((s ^= s >>> 16) >>> 0) / 4294967296 }
  }
  const rng = sharedSeed != null ? seededRandom(sharedSeed) : Math.random
  const indices = X.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const splitIdx = Math.floor(X.length * (1 - testSize))
  const trainIdx = indices.slice(0, splitIdx), testIdx = indices.slice(splitIdx)
  const trainX = trainIdx.map((i) => X[i]), trainY = trainIdx.map((i) => y[i])
  const testX = testIdx.map((i) => X[i]), testY = testIdx.map((i) => y[i])

  progress(10, `Training ${nTrees} trees...`)

  // Train forest with bagging
  const trees = []
  const numFeatures = featureColumns.length
  const sqrtFeatures = Math.max(1, Math.floor(Math.sqrt(numFeatures)))
  const featureImportanceAcc = new Array(numFeatures).fill(0)

  for (let t = 0; t < nTrees; t++) {
    const pct = 10 + Math.floor((t / nTrees) * 70)
    if (t % Math.max(1, Math.floor(nTrees / 20)) === 0) {
      progress(pct, `Building tree ${t + 1}/${nTrees}`)
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

    // Compute precision, recall, f1 per class then macro-average
    const classes = [...uniqueY]
    let precisionSum = 0, recallSum = 0, f1Sum = 0
    for (const cls of classes) {
      let tp = 0, fp = 0, fn = 0
      for (let i = 0; i < testY.length; i++) {
        if (testPreds[i] === cls && testY[i] === cls) tp++
        else if (testPreds[i] === cls && testY[i] !== cls) fp++
        else if (testPreds[i] !== cls && testY[i] === cls) fn++
      }
      const p = tp + fp > 0 ? tp / (tp + fp) : 0
      const r = tp + fn > 0 ? tp / (tp + fn) : 0
      precisionSum += p
      recallSum += r
      f1Sum += p + r > 0 ? (2 * p * r) / (p + r) : 0
    }
    const nClasses = classes.length || 1
    metrics = {
      accuracy: +(testCorr / testY.length).toFixed(4),
      precision: +(precisionSum / nClasses).toFixed(4),
      recall: +(recallSum / nClasses).toFixed(4),
      f1: +(f1Sum / nClasses).toFixed(4),
      trainAccuracy: +(trainCorr / trainY.length).toFixed(4),
    }
  } else {
    const testMSE = testY.reduce((s, v, i) => s + (v - testPreds[i]) ** 2, 0) / testY.length
    const trainMSE = trainY.reduce((s, v, i) => s + (v - trainPreds[i]) ** 2, 0) / trainY.length
    const yMean = testY.reduce((a, b) => a + b, 0) / testY.length
    const ssTot = testY.reduce((s, v) => s + (v - yMean) ** 2, 0)
    const ssRes = testY.reduce((s, v, i) => s + (v - testPreds[i]) ** 2, 0)
    metrics = {
      r2: +(1 - ssRes / (ssTot || 1e-10)).toFixed(4),
      rmse: +Math.sqrt(testMSE).toFixed(4),
      mae: +(testY.reduce((s, v, i) => s + Math.abs(v - testPreds[i]), 0) / testY.length).toFixed(4),
      trainRmse: +Math.sqrt(trainMSE).toFixed(4),
    }
  }

  // Feature importance as Record<string, number> (normalized)
  const totalSplits = featureImportanceAcc.reduce((a, b) => a + b, 0) || 1
  const fiArr = featureColumns.map((name, i) => ({
    feature: name,
    importance: +(featureImportanceAcc[i] / totalSplits).toFixed(4),
  }))
  fiArr.sort((a, b) => b.importance - a.importance)
  const featureImportance = {}
  fiArr.forEach(f => { featureImportance[f.feature] = f.importance })

  progress(100, 'Complete')

  return {
    metrics,
    predictions: {
      trainActual: trainY,
      trainPredicted: trainPreds,
      testActual: testY,
      testPredicted: testPreds,
    },
    extra: {
      featureImportance,
      nTrees: trees.length,
      maxDepth,
    },
    modelData: { trees, featureColumns, targetColumn, targetType: actualType },
  }
}

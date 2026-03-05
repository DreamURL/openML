/* XGBoost Worker — Gradient Boosted Trees (Pure JS implementation) */
/* Implements a simplified gradient boosting algorithm compatible with browser */

self.onmessage = function (e) {
  const { type, payload } = e.data
  if (type !== 'RUN_XGBOOST') return

  try {
    self.postMessage({ type: 'PROGRESS', percent: 5, message: 'Preparing data...' })

    const {
      data, targetColumn, featureColumns, testSize,
      nEstimators, maxDepth, learningRate, subsample, taskType, sharedSeed
    } = payload

    const numTrees = nEstimators || 100
    const depth = maxDepth || 6
    const lr = learningRate || 0.1
    const sub = subsample || 0.8

    const rows = data.filter(r =>
      featureColumns.every(f => r[f] !== null && !isNaN(Number(r[f]))) &&
      r[targetColumn] !== null && r[targetColumn] !== undefined
    )
    if (rows.length < 10) throw new Error('Not enough valid rows (min 10)')

    // Detect task
    const uniqueTargets = [...new Set(rows.map(r => r[targetColumn]))]
    const isClassification = taskType === 'classification' || (taskType === 'auto' && uniqueTargets.length <= 10)

    // Encode target
    let classMap = null
    const X = rows.map(r => featureColumns.map(f => Number(r[f])))
    let Y
    if (isClassification) {
      classMap = {}
      uniqueTargets.sort().forEach((t, i) => { classMap[String(t)] = i })
      Y = rows.map(r => classMap[String(r[targetColumn])])
    } else {
      Y = rows.map(r => Number(r[targetColumn]))
    }

    // Split (use seeded shuffle for reproducibility across models)
    function seededRandom(seed) {
      let s = seed | 0
      return function() { s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s = Math.imul(s ^ (s >>> 13), 0x45d9f3b); return ((s ^= s >>> 16) >>> 0) / 4294967296 }
    }
    const rng = sharedSeed != null ? seededRandom(sharedSeed) : Math.random
    const indices = Array.from({ length: X.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const splitIdx = Math.floor(X.length * (1 - (testSize || 0.2)))
    const trainIdx = indices.slice(0, splitIdx)
    const testIdx = indices.slice(splitIdx)
    const trainX = trainIdx.map(i => X[i])
    const trainY = trainIdx.map(i => Y[i])
    const testX = testIdx.map(i => X[i])
    const testY = testIdx.map(i => Y[i])

    self.postMessage({ type: 'PROGRESS', percent: 10, message: 'Training gradient boosted trees...' })

    // Simple Decision Tree Node
    function buildTree(X, residuals, depth, maxDepth) {
      if (depth >= maxDepth || X.length < 4) {
        return { value: residuals.reduce((a, b) => a + b, 0) / residuals.length }
      }
      let bestGain = 0, bestFeature = -1, bestThreshold = 0
      const parentMse = mse(residuals)

      const numFeatures = Math.ceil(Math.sqrt(featureColumns.length))
      const featureIndices = shuffle(Array.from({ length: featureColumns.length }, (_, i) => i)).slice(0, numFeatures)

      for (const fi of featureIndices) {
        const vals = [...new Set(X.map(r => r[fi]))].sort((a, b) => a - b)
        const thresholds = vals.length > 20
          ? Array.from({ length: 20 }, (_, i) => vals[Math.floor(i * vals.length / 20)])
          : vals

        for (const thr of thresholds) {
          const leftR = [], rightR = []
          for (let i = 0; i < X.length; i++) {
            if (X[i][fi] <= thr) leftR.push(residuals[i])
            else rightR.push(residuals[i])
          }
          if (leftR.length < 2 || rightR.length < 2) continue
          const gain = parentMse - (leftR.length * mse(leftR) + rightR.length * mse(rightR)) / X.length
          if (gain > bestGain) {
            bestGain = gain
            bestFeature = fi
            bestThreshold = thr
          }
        }
      }

      if (bestGain <= 0) {
        return { value: residuals.reduce((a, b) => a + b, 0) / residuals.length }
      }

      const leftX = [], leftR = [], rightX = [], rightR = []
      for (let i = 0; i < X.length; i++) {
        if (X[i][bestFeature] <= bestThreshold) { leftX.push(X[i]); leftR.push(residuals[i]) }
        else { rightX.push(X[i]); rightR.push(residuals[i]) }
      }

      return {
        feature: bestFeature,
        threshold: bestThreshold,
        left: buildTree(leftX, leftR, depth + 1, maxDepth),
        right: buildTree(rightX, rightR, depth + 1, maxDepth),
      }
    }

    function predictTree(tree, x) {
      if (tree.value !== undefined) return tree.value
      return x[tree.feature] <= tree.threshold ? predictTree(tree.left, x) : predictTree(tree.right, x)
    }

    function mse(arr) {
      if (arr.length === 0) return 0
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length
      return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    // Train gradient boosting
    const trees = []
    const featureImportance = new Array(featureColumns.length).fill(0)
    let predictions = new Array(trainX.length).fill(0)
    const lossHistory = []

    // Initialize with mean for regression, 0 for classification
    const initValue = isClassification ? 0 : trainY.reduce((a, b) => a + b, 0) / trainY.length
    predictions = predictions.map(() => initValue)

    for (let t = 0; t < numTrees; t++) {
      // Compute residuals (negative gradient)
      let residuals
      if (isClassification) {
        // Binary: gradient of log loss
        residuals = trainY.map((y, i) => {
          const p = 1 / (1 + Math.exp(-predictions[i]))
          return y - p
        })
      } else {
        residuals = trainY.map((y, i) => y - predictions[i])
      }

      // Subsample
      const sampleSize = Math.floor(trainX.length * sub)
      const sampleIdx = shuffle(Array.from({ length: trainX.length }, (_, i) => i)).slice(0, sampleSize)
      const sampleX = sampleIdx.map(i => trainX[i])
      const sampleR = sampleIdx.map(i => residuals[i])

      // Fit tree to residuals
      const tree = buildTree(sampleX, sampleR, 0, depth)
      trees.push(tree)

      // Update predictions
      for (let i = 0; i < trainX.length; i++) {
        predictions[i] += lr * predictTree(tree, trainX[i])
      }

      // Track feature importance
      function countSplits(node) {
        if (node.value !== undefined) return
        featureImportance[node.feature]++
        countSplits(node.left)
        countSplits(node.right)
      }
      countSplits(tree)

      // Loss
      if (isClassification) {
        let correct = 0
        trainY.forEach((y, i) => {
          const p = 1 / (1 + Math.exp(-predictions[i]))
          if ((p >= 0.5 ? 1 : 0) === y) correct++
        })
        lossHistory.push(1 - correct / trainY.length)
      } else {
        lossHistory.push(Math.sqrt(trainY.reduce((s, y, i) => s + (y - predictions[i]) ** 2, 0) / trainY.length))
      }

      if (t % 10 === 0 || t === numTrees - 1) {
        self.postMessage({ type: 'PROGRESS', percent: 10 + Math.round((t / numTrees) * 80), message: `Tree ${t + 1}/${numTrees} — Loss: ${lossHistory[lossHistory.length - 1].toFixed(4)}` })
      }
    }

    self.postMessage({ type: 'PROGRESS', percent: 92, message: 'Computing test metrics...' })

    // Test predictions
    function predictAll(x) {
      let pred = initValue
      for (const tree of trees) pred += lr * predictTree(tree, x)
      return pred
    }

    const testPredRaw = testX.map(predictAll)
    const trainPredRaw = trainX.map(predictAll)

    // Metrics
    let metrics, testPredicted, trainPredicted
    if (isClassification) {
      testPredicted = testPredRaw.map(p => 1 / (1 + Math.exp(-p)) >= 0.5 ? 1 : 0)
      trainPredicted = trainPredRaw.map(p => 1 / (1 + Math.exp(-p)) >= 0.5 ? 1 : 0)

      let correct = 0
      testY.forEach((y, i) => { if (y === testPredicted[i]) correct++ })
      let trainCorrect = 0
      trainY.forEach((y, i) => { if (y === trainPredicted[i]) trainCorrect++ })

      // Compute precision, recall, f1 (binary: class 1 is positive)
      let tp = 0, fp = 0, fn = 0
      for (let i = 0; i < testY.length; i++) {
        if (testPredicted[i] === 1 && testY[i] === 1) tp++
        else if (testPredicted[i] === 1 && testY[i] !== 1) fp++
        else if (testPredicted[i] !== 1 && testY[i] === 1) fn++
      }
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

      metrics = { accuracy: correct / testY.length, precision, recall, f1, trainAccuracy: trainCorrect / trainY.length }
    } else {
      testPredicted = testPredRaw
      trainPredicted = trainPredRaw

      const testMse = testY.reduce((s, y, i) => s + (y - testPredicted[i]) ** 2, 0) / testY.length
      const trainMse = trainY.reduce((s, y, i) => s + (y - trainPredicted[i]) ** 2, 0) / trainY.length
      const yMean = testY.reduce((a, b) => a + b, 0) / testY.length
      const ssTot = testY.reduce((s, y) => s + (y - yMean) ** 2, 0)
      const ssRes = testY.reduce((s, y, i) => s + (y - testPredicted[i]) ** 2, 0)

      metrics = {
        r2: 1 - ssRes / (ssTot || 1e-10),
        rmse: Math.sqrt(testMse),
        mae: testY.reduce((s, y, i) => s + Math.abs(y - testPredicted[i]), 0) / testY.length,
        trainRmse: Math.sqrt(trainMse),
      }
    }

    // Normalize feature importance as Record<string, number>
    const totalImp = featureImportance.reduce((a, b) => a + b, 0) || 1
    const impArr = featureColumns.map((f, i) => ({
      feature: f, importance: featureImportance[i] / totalImp
    })).sort((a, b) => b.importance - a.importance)
    const impRecord = {}
    impArr.forEach(f => { impRecord[f.feature] = f.importance })

    self.postMessage({
      type: 'RESULT',
      result: {
        metrics,
        lossHistory,
        predictions: { trainActual: trainY, trainPredicted, testActual: testY, testPredicted },
        extra: { featureImportance: impRecord },
        modelData: { featureColumns, targetColumn, isClassification, classMap, nTrees: numTrees, trees, learningRate: lr, initValue, type: 'xgboost' },
      }
    })
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message || String(err) })
  }
}

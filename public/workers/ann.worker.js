/* Artificial Neural Network Worker — TensorFlow.js */
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')

self.onmessage = async function (e) {
  const { type, payload } = e.data
  if (type !== 'RUN_ANN') return

  try {
    await tf.ready()
    self.postMessage({ type: 'PROGRESS', percent: 5, message: 'Preparing data...' })

    const {
      data, targetColumn, featureColumns, testSize,
      learningRate, epochs, hiddenLayers, taskType, normalize, sharedSeed
    } = payload

    // Default config
    const layers = hiddenLayers || [64, 32]
    const lr = learningRate || 0.001
    const ep = epochs || 100

    const rows = data.filter(r =>
      featureColumns.every(f => r[f] !== null && r[f] !== undefined && !isNaN(Number(r[f]))) &&
      r[targetColumn] !== null && r[targetColumn] !== undefined
    )

    if (rows.length < 10) throw new Error('Not enough valid rows (min 10)')

    // Detect task type
    const uniqueTargets = [...new Set(rows.map(r => r[targetColumn]))]
    const isClassification = taskType === 'classification' || (taskType === 'auto' && uniqueTargets.length <= 10)
    const numClasses = isClassification ? uniqueTargets.length : 0

    // Extract features
    let X = rows.map(r => featureColumns.map(f => Number(r[f])))

    // Normalize
    let means = null, stds = null
    if (normalize) {
      means = featureColumns.map((_, fi) => X.reduce((s, r) => s + r[fi], 0) / X.length)
      stds = featureColumns.map((_, fi) => {
        const m = means[fi]
        return Math.sqrt(X.reduce((s, r) => s + (r[fi] - m) ** 2, 0) / X.length) || 1e-10
      })
      X = X.map(row => row.map((v, fi) => (v - means[fi]) / stds[fi]))
    }

    // Encode target
    let Y
    let classMap = null
    if (isClassification) {
      classMap = {}
      uniqueTargets.forEach((t, i) => { classMap[String(t)] = i })
      Y = rows.map(r => {
        const oneHot = new Array(numClasses).fill(0)
        oneHot[classMap[String(r[targetColumn])]] = 1
        return oneHot
      })
    } else {
      Y = rows.map(r => [Number(r[targetColumn])])
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
    const trainX = indices.slice(0, splitIdx).map(i => X[i])
    const trainY = indices.slice(0, splitIdx).map(i => Y[i])
    const testX = indices.slice(splitIdx).map(i => X[i])
    const testY = indices.slice(splitIdx).map(i => Y[i])

    self.postMessage({ type: 'PROGRESS', percent: 15, message: 'Building neural network...' })

    // Build model
    const model = tf.sequential()
    layers.forEach((units, idx) => {
      const config = { units, activation: 'relu' }
      if (idx === 0) config.inputShape = [featureColumns.length]
      model.add(tf.layers.dense(config))
    })

    // Output layer
    if (isClassification) {
      model.add(tf.layers.dense({ units: numClasses, activation: numClasses === 2 ? 'sigmoid' : 'softmax' }))
      model.compile({
        optimizer: tf.train.adam(lr),
        loss: numClasses === 2 ? 'binaryCrossentropy' : 'categoricalCrossentropy',
        metrics: ['accuracy'],
      })
    } else {
      model.add(tf.layers.dense({ units: 1, activation: 'linear' }))
      model.compile({ optimizer: tf.train.adam(lr), loss: 'meanSquaredError' })
    }

    const xTrain = tf.tensor2d(trainX)
    const yTrain = tf.tensor2d(trainY)
    const lossHistory = []
    const accHistory = []

    await model.fit(xTrain, yTrain, {
      epochs: ep,
      batchSize: Math.min(32, trainX.length),
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          lossHistory.push(logs.loss)
          if (logs.acc !== undefined) accHistory.push(logs.acc)
          const pct = 15 + Math.round((epoch / ep) * 70)
          self.postMessage({
            type: 'PROGRESS', percent: pct,
            message: `Epoch ${epoch + 1}/${ep} — Loss: ${logs.loss.toFixed(6)}${logs.acc !== undefined ? ` Acc: ${(logs.acc * 100).toFixed(1)}%` : ''}`
          })
        }
      }
    })

    self.postMessage({ type: 'PROGRESS', percent: 90, message: 'Computing metrics...' })

    // Predictions
    const testPredTensor = model.predict(tf.tensor2d(testX))
    const testPredRaw = Array.from(testPredTensor.dataSync())
    const trainPredTensor = model.predict(tf.tensor2d(trainX))
    const trainPredRaw = Array.from(trainPredTensor.dataSync())

    let metrics = {}
    let testPredicted, testActual, trainPredicted, trainActual

    if (isClassification) {
      // Decode predictions
      const decode = (preds, size) => {
        const result = []
        for (let i = 0; i < preds.length; i += size) {
          const slice = preds.slice(i, i + size)
          result.push(slice.indexOf(Math.max(...slice)))
        }
        return result
      }
      const decodeTarget = (targets) => targets.map(t => t.indexOf(Math.max(...t)))

      testPredicted = decode(testPredRaw, numClasses)
      testActual = decodeTarget(testY)
      trainPredicted = decode(trainPredRaw, numClasses)
      trainActual = decodeTarget(trainY)

      let correct = 0
      testActual.forEach((a, i) => { if (a === testPredicted[i]) correct++ })
      const accuracy = correct / testActual.length

      let trainCorrect = 0
      trainActual.forEach((a, i) => { if (a === trainPredicted[i]) trainCorrect++ })

      // Macro-averaged precision, recall, f1
      const classes = [...new Set([...testActual, ...testPredicted])]
      let precisionSum = 0, recallSum = 0, f1Sum = 0
      for (const cls of classes) {
        let tp = 0, fp = 0, fn = 0
        for (let i = 0; i < testActual.length; i++) {
          if (testPredicted[i] === cls && testActual[i] === cls) tp++
          else if (testPredicted[i] === cls && testActual[i] !== cls) fp++
          else if (testPredicted[i] !== cls && testActual[i] === cls) fn++
        }
        const p = tp + fp > 0 ? tp / (tp + fp) : 0
        const r = tp + fn > 0 ? tp / (tp + fn) : 0
        precisionSum += p
        recallSum += r
        f1Sum += p + r > 0 ? (2 * p * r) / (p + r) : 0
      }
      const nClasses = classes.length || 1
      const precision = precisionSum / nClasses
      const recall = recallSum / nClasses
      const f1 = f1Sum / nClasses

      metrics = { accuracy, precision, recall, f1, trainAccuracy: trainCorrect / trainActual.length }
    } else {
      testPredicted = testPredRaw
      testActual = testY.map(y => y[0])
      trainPredicted = trainPredRaw
      trainActual = trainY.map(y => y[0])

      const testMse = testActual.reduce((s, y, i) => s + (y - testPredicted[i]) ** 2, 0) / testActual.length
      const trainMse = trainActual.reduce((s, y, i) => s + (y - trainPredicted[i]) ** 2, 0) / trainActual.length
      const yMean = testActual.reduce((a, b) => a + b, 0) / testActual.length
      const ssTot = testActual.reduce((s, y) => s + (y - yMean) ** 2, 0)
      const ssRes = testActual.reduce((s, y, i) => s + (y - testPredicted[i]) ** 2, 0)

      metrics = {
        r2: 1 - ssRes / (ssTot || 1e-10),
        rmse: Math.sqrt(testMse),
        mae: testActual.reduce((s, y, i) => s + Math.abs(y - testPredicted[i]), 0) / testActual.length,
        trainRmse: Math.sqrt(trainMse),
      }
    }

    // Cleanup
    xTrain.dispose()
    yTrain.dispose()
    testPredTensor.dispose()
    trainPredTensor.dispose()

    // Extract layer info and weights for model export
    const layerSummary = model.layers.map(l => ({ type: l.name, units: l.units, activation: l.getConfig().activation }))
    const allWeights = []
    for (const layer of model.layers) {
      const ws = layer.getWeights()
      const layerWeights = []
      for (const wt of ws) {
        layerWeights.push({ shape: wt.shape, data: Array.from(wt.dataSync()) })
      }
      allWeights.push(layerWeights)
    }
    model.dispose()

    self.postMessage({
      type: 'RESULT',
      result: {
        metrics,
        lossHistory,
        predictions: { trainActual, trainPredicted, testActual, testPredicted },
        extra: {
          accHistory,
          architecture: { layers: layerSummary },
          epochs: ep,
          learningRate: lr,
        },
        modelData: { means, stds, featureColumns, targetColumn, normalize, classMap, isClassification, numClasses, layers, weights: allWeights, type: 'ann' },
      }
    })
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message || String(err) })
  }
}

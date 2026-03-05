/* Multiple Linear Regression Worker — TensorFlow.js */
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')

self.onmessage = async function (e) {
  const { type, payload } = e.data
  if (type !== 'RUN_REGRESSION') return

  try {
    await tf.ready()
    self.postMessage({ type: 'PROGRESS', percent: 5, message: 'Preparing data...' })

    const { data, targetColumn, featureColumns, testSize, learningRate, epochs, normalize, sharedSeed } = payload
    const rows = data.filter(r => {
      return featureColumns.every(f => r[f] !== null && r[f] !== undefined && !isNaN(Number(r[f]))) &&
        r[targetColumn] !== null && r[targetColumn] !== undefined && !isNaN(Number(r[targetColumn]))
    })

    if (rows.length < 10) throw new Error('Not enough valid rows (min 10)')

    // Extract features and target
    const X = rows.map(r => featureColumns.map(f => Number(r[f])))
    const Y = rows.map(r => Number(r[targetColumn]))

    // Normalize
    let means = null, stds = null
    if (normalize) {
      means = featureColumns.map((_, fi) => X.reduce((s, r) => s + r[fi], 0) / X.length)
      stds = featureColumns.map((_, fi) => {
        const m = means[fi]
        return Math.sqrt(X.reduce((s, r) => s + (r[fi] - m) ** 2, 0) / X.length) || 1e-10
      })
      for (const row of X) {
        for (let fi = 0; fi < row.length; fi++) {
          row[fi] = (row[fi] - means[fi]) / stds[fi]
        }
      }
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
    const splitIdx = Math.floor(X.length * (1 - testSize))
    const trainX = indices.slice(0, splitIdx).map(i => X[i])
    const trainY = indices.slice(0, splitIdx).map(i => Y[i])
    const testX = indices.slice(splitIdx).map(i => X[i])
    const testY = indices.slice(splitIdx).map(i => Y[i])

    self.postMessage({ type: 'PROGRESS', percent: 15, message: 'Building model...' })

    // Build TF.js model
    const model = tf.sequential()
    model.add(tf.layers.dense({ units: 1, inputShape: [featureColumns.length], activation: 'linear' }))
    model.compile({ optimizer: tf.train.adam(learningRate || 0.01), loss: 'meanSquaredError' })

    const xTrain = tf.tensor2d(trainX)
    const yTrain = tf.tensor2d(trainY, [trainY.length, 1])

    const lossHistory = []

    await model.fit(xTrain, yTrain, {
      epochs: epochs || 100,
      batchSize: Math.min(32, trainX.length),
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          lossHistory.push(logs.loss)
          const pct = 15 + Math.round((epoch / (epochs || 100)) * 70)
          self.postMessage({ type: 'PROGRESS', percent: pct, message: `Epoch ${epoch + 1}/${epochs || 100} — Loss: ${logs.loss.toFixed(6)}` })
        }
      }
    })

    self.postMessage({ type: 'PROGRESS', percent: 90, message: 'Computing metrics...' })

    // Predictions
    const trainPred = Array.from(model.predict(tf.tensor2d(trainX)).dataSync())
    const testPred = Array.from(model.predict(tf.tensor2d(testX)).dataSync())

    // Metrics
    const mse = testY.reduce((s, y, i) => s + (y - testPred[i]) ** 2, 0) / testY.length
    const rmse = Math.sqrt(mse)
    const mae = testY.reduce((s, y, i) => s + Math.abs(y - testPred[i]), 0) / testY.length
    const ssRes = testY.reduce((s, y, i) => s + (y - testPred[i]) ** 2, 0)
    const yMean = testY.reduce((a, b) => a + b, 0) / testY.length
    const ssTot = testY.reduce((s, y) => s + (y - yMean) ** 2, 0)
    const r2 = 1 - ssRes / (ssTot || 1e-10)

    const trainMse = trainY.reduce((s, y, i) => s + (y - trainPred[i]) ** 2, 0) / trainY.length
    const trainRmse = Math.sqrt(trainMse)

    // Extract coefficients as Record<string, number>
    const weights = Array.from(model.getWeights()[0].dataSync())
    const bias = Array.from(model.getWeights()[1].dataSync())
    const coefficients = {}
    const coeffArr = featureColumns.map((f, i) => ({ feature: f, coefficient: weights[i], absCoeff: Math.abs(weights[i]) }))
    coeffArr.sort((a, b) => b.absCoeff - a.absCoeff)
    coeffArr.forEach(c => { coefficients[c.feature] = c.coefficient })

    // Cleanup
    xTrain.dispose()
    yTrain.dispose()
    model.dispose()

    self.postMessage({
      type: 'RESULT',
      result: {
        metrics: { r2, rmse, mae, trainRmse },
        lossHistory,
        predictions: {
          trainActual: trainY,
          trainPredicted: trainPred,
          testActual: testY,
          testPredicted: testPred,
        },
        extra: { coefficients },
        modelData: { weights: weights.map(w => [w]), bias, means, stds, featureColumns, targetColumn, normalize, type: 'regression' },
      }
    })
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message || String(err) })
  }
}

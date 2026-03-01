importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')

self.onmessage = async function (event) {
  const { type, payload } = event.data
  if (type === 'RUN_LOGISTIC') {
    try {
      await tf.ready()
      progress(5, 'TF.js backend: ' + tf.getBackend())
      const result = await trainLogistic(payload)
      self.postMessage({ type: 'RESULT', result })
    } catch (e) {
      self.postMessage({ type: 'ERROR', error: e.message })
    }
  }
}

function progress(percent, message) {
  self.postMessage({ type: 'PROGRESS', percent, message })
}

async function trainLogistic({ data, targetColumn, featureColumns, testSize, learningRate, epochs, l2Strength, normalize }) {
  progress(10, 'Preprocessing data...')

  // Extract unique target values (binary classification)
  const targetValues = [...new Set(data.map((r) => r[targetColumn]))]
  if (targetValues.length !== 2) {
    throw new Error(`Binary classification requires exactly 2 classes, found ${targetValues.length}`)
  }
  const classMap = {}
  targetValues.forEach((v, i) => { classMap[v] = i })

  // Extract features and targets
  const allX = []
  const allY = []
  for (const row of data) {
    const features = featureColumns.map((f) => {
      const v = row[f]
      return typeof v === 'number' ? v : parseFloat(v) || 0
    })
    allX.push(features)
    allY.push(classMap[row[targetColumn]])
  }

  // Normalize features
  const numFeatures = featureColumns.length
  const means = new Array(numFeatures).fill(0)
  const stds = new Array(numFeatures).fill(0)

  if (normalize) {
    for (let j = 0; j < numFeatures; j++) {
      let sum = 0
      for (const row of allX) sum += row[j]
      means[j] = sum / allX.length

      let sq = 0
      for (const row of allX) sq += (row[j] - means[j]) ** 2
      stds[j] = Math.sqrt(sq / allX.length) || 1e-10
    }
    for (const row of allX) {
      for (let j = 0; j < numFeatures; j++) {
        row[j] = (row[j] - means[j]) / stds[j]
      }
    }
  }

  // Split train/test
  const splitIdx = Math.floor(allX.length * (1 - testSize))
  const indices = allX.map((_, i) => i)
  // Shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  const trainIdx = indices.slice(0, splitIdx)
  const testIdx = indices.slice(splitIdx)

  const xTrainArr = trainIdx.map((i) => allX[i])
  const yTrainArr = trainIdx.map((i) => allY[i])
  const xTestArr = testIdx.map((i) => allX[i])
  const yTestArr = testIdx.map((i) => allY[i])

  progress(25, 'Building model...')

  // Build model: single dense sigmoid layer (logistic regression)
  const model = tf.sequential()
  model.add(tf.layers.dense({
    units: 1,
    inputShape: [numFeatures],
    activation: 'sigmoid',
    kernelRegularizer: l2Strength > 0 ? tf.regularizers.l2({ l2: l2Strength }) : undefined,
  }))

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  })

  const xTrain = tf.tensor2d(xTrainArr)
  const yTrain = tf.tensor2d(yTrainArr, [yTrainArr.length, 1])
  const xTest = tf.tensor2d(xTestArr)
  const yTest = tf.tensor2d(yTestArr, [yTestArr.length, 1])

  progress(30, 'Training...')

  // Train
  const lossHistory = []
  const accHistory = []

  await model.fit(xTrain, yTrain, {
    epochs,
    batchSize: Math.min(32, xTrainArr.length),
    validationData: [xTest, yTest],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const pct = 30 + Math.floor((epoch / epochs) * 45)
        progress(pct, `Epoch ${epoch + 1}/${epochs} - loss: ${logs.loss.toFixed(4)} acc: ${logs.acc.toFixed(4)}`)
        lossHistory.push(+logs.loss.toFixed(4))
        accHistory.push(+logs.acc.toFixed(4))
      },
    },
  })

  progress(80, 'Evaluating model...')

  // Predictions
  const trainPreds = model.predict(xTrain).dataSync()
  const testPreds = model.predict(xTest).dataSync()

  // Confusion matrix & metrics for test set
  let tp = 0, fp = 0, fn = 0, tn = 0
  for (let i = 0; i < yTestArr.length; i++) {
    const pred = testPreds[i] >= 0.5 ? 1 : 0
    const actual = yTestArr[i]
    if (pred === 1 && actual === 1) tp++
    else if (pred === 1 && actual === 0) fp++
    else if (pred === 0 && actual === 1) fn++
    else tn++
  }

  const accuracy = (tp + tn) / (tp + fp + fn + tn)
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  // Train accuracy
  let trainCorrect = 0
  for (let i = 0; i < yTrainArr.length; i++) {
    const pred = trainPreds[i] >= 0.5 ? 1 : 0
    if (pred === yTrainArr[i]) trainCorrect++
  }
  const trainAccuracy = trainCorrect / yTrainArr.length

  // Extract coefficients
  const weights = model.getWeights()
  const kernel = await weights[0].array() // [numFeatures, 1]
  const bias = await weights[1].array() // [1]
  const coefficients = featureColumns.map((name, i) => ({
    feature: name,
    coefficient: +kernel[i][0].toFixed(6),
    absCoeff: +Math.abs(kernel[i][0]).toFixed(6),
  }))
  coefficients.sort((a, b) => b.absCoeff - a.absCoeff)

  // Model data for save/load
  const modelData = {
    weights: kernel,
    bias,
    means: normalize ? means : null,
    stds: normalize ? stds : null,
    classMap,
    featureColumns,
    targetColumn,
    normalize,
  }

  // Cleanup
  xTrain.dispose()
  yTrain.dispose()
  xTest.dispose()
  yTest.dispose()
  model.dispose()

  // Collect actual vs predicted for visualization
  const trainActual = yTrainArr.slice()
  const trainPredicted = Array.from(trainPreds).map((p) => p >= 0.5 ? 1 : 0)
  const testActual = yTestArr.slice()
  const testPredicted = Array.from(testPreds).map((p) => p >= 0.5 ? 1 : 0)

  progress(100, 'Complete')

  return {
    metrics: {
      accuracy: +accuracy.toFixed(4),
      precision: +precision.toFixed(4),
      recall: +recall.toFixed(4),
      f1: +f1.toFixed(4),
      trainAccuracy: +trainAccuracy.toFixed(4),
    },
    confusionMatrix: { tp, fp, fn, tn },
    coefficients,
    lossHistory,
    accHistory,
    classLabels: targetValues,
    trainSize: xTrainArr.length,
    testSize: xTestArr.length,
    modelData,
    backend: tf.getBackend(),
    trainActual,
    trainPredicted,
    testActual,
    testPredicted,
  }
}

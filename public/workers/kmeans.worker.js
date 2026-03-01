importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')

self.onmessage = async function (event) {
  const { type, payload } = event.data

  if (type === 'RUN_KMEANS') {
    try {
      await tf.ready()
      self.postMessage({ type: 'PROGRESS', percent: 5, message: 'TF.js backend: ' + tf.getBackend() })

      const result = await runKMeans(
        payload.data,
        payload.features,
        payload.k,
        payload.maxIterations,
        payload.normalize,
      )
      self.postMessage({ type: 'RESULT', result })
    } catch (e) {
      self.postMessage({ type: 'ERROR', error: e.message })
    }
  }
}

function progress(percent, message) {
  self.postMessage({ type: 'PROGRESS', percent, message })
}

async function runKMeans(data, features, k, maxIterations = 100, normalize = true) {
  progress(10, 'Preparing data...')

  // Extract feature data
  const featureData = data.map((item) =>
    features.map((f) => {
      const v = item[f]
      return typeof v === 'number' ? v : typeof v === 'string' && !isNaN(parseFloat(v)) ? parseFloat(v) : 0
    }),
  )

  let tensor = tf.tensor2d(featureData)
  let min, max

  if (normalize) {
    min = tensor.min(0)
    max = tensor.max(0)
    const range = tf.sub(max, min)
    const safeRange = tf.maximum(range, tf.scalar(1e-8))
    const normalized = tensor.sub(min).div(safeRange)
    tensor = tf.where(tf.isNaN(normalized), tf.zerosLike(normalized), normalized)
  }

  progress(15, 'Initializing centroids...')

  const numPoints = tensor.shape[0]
  const numFeatures = tensor.shape[1]

  // Random initial centroids
  const randIndices = []
  while (randIndices.length < k) {
    const idx = Math.floor(Math.random() * numPoints)
    if (!randIndices.includes(idx)) randIndices.push(idx)
  }

  let centroids = tf.tidy(() => {
    const vecs = randIndices.map((idx) => tensor.slice([idx, 0], [1, numFeatures]))
    return tf.concat(vecs, 0)
  })

  let assignments = new Array(numPoints).fill(0)
  let oldAssignments = new Array(numPoints).fill(-1)
  let iteration = 0
  let converged = false

  progress(20, 'Training...')

  while (iteration < maxIterations && !converged) {
    const pct = 20 + Math.floor((iteration / maxIterations) * 55)
    progress(pct, `Iteration ${iteration + 1}/${maxIterations}`)

    // Assign points to nearest centroid (batched)
    const batchSize = 1000
    const numBatches = Math.ceil(numPoints / batchSize)

    for (let batch = 0; batch < numBatches; batch++) {
      const start = batch * batchSize
      const end = Math.min(start + batchSize, numPoints)

      tf.tidy(() => {
        const batchData = tensor.slice([start, 0], [end - start, numFeatures])
        const expandedData = tf.expandDims(batchData, 1)
        const expandedCentroids = tf.expandDims(centroids, 0)
        const diff = tf.sub(expandedData, expandedCentroids)
        const distances = tf.sum(tf.square(diff), 2)
        const batchAssign = tf.argMin(distances, 1).dataSync()

        for (let i = 0; i < batchAssign.length; i++) {
          assignments[start + i] = batchAssign[i]
        }
      })
    }

    // Check convergence
    converged = assignments.every((a, i) => a === oldAssignments[i])
    if (converged) break

    oldAssignments = [...assignments]

    // Update centroids
    const newCentroids = tf.tidy(() => {
      const assignTensor = tf.tensor1d(assignments, 'int32')
      const list = []

      for (let c = 0; c < k; c++) {
        const mask = tf.equal(assignTensor, tf.scalar(c, 'int32'))
        const maskFloat = tf.cast(mask, 'float32')
        const count = tf.sum(maskFloat).dataSync()[0]

        if (count > 0) {
          const expanded = tf.reshape(maskFloat, [-1, 1])
          const masked = tf.mul(tensor, expanded)
          const sum = tf.sum(masked, 0)
          list.push(tf.div(sum, tf.scalar(count)))
        } else {
          const rIdx = Math.floor(Math.random() * numPoints)
          list.push(tensor.slice([rIdx, 0], [1, numFeatures]).reshape([numFeatures]))
        }
      }
      return tf.stack(list)
    })

    centroids.dispose()
    centroids = newCentroids
    iteration++
  }

  progress(80, 'Computing results...')

  // Denormalize centroids
  let finalCentroids
  if (normalize && min && max) {
    finalCentroids = tf.tidy(() => {
      const range = tf.sub(max, min)
      const safeRange = tf.maximum(range, tf.scalar(1e-8))
      return tf.add(tf.mul(centroids, safeRange), min)
    })
  } else {
    finalCentroids = centroids
  }

  const centroidsArray = await finalCentroids.array()

  // Compute inertia
  const inertia = tf.tidy(() => {
    const assignTensor = tf.tensor1d(assignments, 'int32')
    const gathered = tf.gather(centroids, assignTensor)
    const diff = tf.sub(tensor, gathered)
    return tf.mean(tf.sum(tf.square(diff), 1)).dataSync()[0]
  })

  progress(90, 'Building cluster statistics...')

  // Cluster statistics
  const clusterCount = Math.max(...assignments) + 1
  const clusterStats = []

  for (let i = 0; i < clusterCount; i++) {
    const indices = []
    assignments.forEach((a, idx) => {
      if (a === i) indices.push(idx)
    })
    const count = indices.length
    const featureStats = {}

    features.forEach((f) => {
      const values = indices.map((idx) => {
        const v = parseFloat(data[idx][f])
        return isNaN(v) ? 0 : v
      })
      if (values.length === 0) {
        featureStats[f] = { avg: 0, min: 0, max: 0 }
      } else {
        const sum = values.reduce((a, b) => a + b, 0)
        featureStats[f] = {
          avg: +(sum / values.length).toFixed(2),
          min: +Math.min(...values).toFixed(2),
          max: +Math.max(...values).toFixed(2),
        }
      }
    })

    clusterStats.push({
      id: i,
      count,
      percentage: +((count / data.length) * 100).toFixed(1),
      featureStats,
    })
  }

  // Cleanup
  tensor.dispose()
  centroids.dispose()
  if (finalCentroids !== centroids) finalCentroids.dispose()
  if (min) min.dispose()
  if (max) max.dispose()

  progress(100, 'Complete')

  return {
    centroids: centroidsArray,
    assignments,
    inertia,
    iterations: iteration,
    clusterStats,
    features,
    backend: tf.getBackend(),
  }
}

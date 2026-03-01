importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js')

self.onmessage = async function (event) {
  const { type, payload } = event.data
  if (type === 'RUN_PCA') {
    try {
      await tf.ready()
      progress(5, 'TF.js backend: ' + tf.getBackend())
      const result = await runPCA(payload.data, payload.features, payload.components, payload.normalize)
      self.postMessage({ type: 'RESULT', result })
    } catch (e) {
      self.postMessage({ type: 'ERROR', error: e.message })
    }
  }
}

function progress(percent, message) {
  self.postMessage({ type: 'PROGRESS', percent, message })
}

// Jacobi eigenvalue decomposition (ported from OODE pca_cal.cjs)
function eigenDecomp(matrixArray, numComponents) {
  const n = matrixArray.length

  // Make symmetric
  const sym = matrixArray.map((row, i) =>
    row.map((val, j) => (val + matrixArray[j][i]) / 2),
  )

  let eigVectors = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )

  let mat = sym.map((row) => [...row])
  const maxIter = 100
  const threshold = 1e-10

  for (let iter = 0; iter < maxIter; iter++) {
    let maxVal = 0
    let p = 0, q = 0

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const absVal = Math.abs(mat[i][j])
        if (absVal > maxVal) {
          maxVal = absVal
          p = i
          q = j
        }
      }
    }

    if (maxVal < threshold) break

    const app = mat[p][p], aqq = mat[q][q], apq = mat[p][q]
    const theta = Math.abs(app - aqq) < 1e-10 ? Math.PI / 4 : 0.5 * Math.atan2(2 * apq, aqq - app)
    const c = Math.cos(theta), s = Math.sin(theta)

    const newMat = mat.map((row) => [...row])

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== p && i !== q && j !== p && j !== q) continue
        if (i === p && j === p) newMat[i][j] = c * c * mat[p][p] - 2 * c * s * mat[p][q] + s * s * mat[q][q]
        else if (i === q && j === q) newMat[i][j] = s * s * mat[p][p] + 2 * c * s * mat[p][q] + c * c * mat[q][q]
        else if ((i === p && j === q) || (i === q && j === p)) newMat[i][j] = (c * c - s * s) * mat[p][q] + c * s * (mat[p][p] - mat[q][q])
        else if (i === p) newMat[i][j] = c * mat[p][j] - s * mat[q][j]
        else if (i === q) newMat[i][j] = s * mat[p][j] + c * mat[q][j]
        else if (j === p) newMat[i][j] = c * mat[i][p] - s * mat[i][q]
        else if (j === q) newMat[i][j] = s * mat[i][p] + c * mat[i][q]
      }
    }

    for (let i = 0; i < n; i++) {
      const vp = eigVectors[i][p], vq = eigVectors[i][q]
      eigVectors[i][p] = c * vp - s * vq
      eigVectors[i][q] = s * vp + c * vq
    }

    mat = newMat
  }

  const eigenValues = Array.from({ length: n }, (_, i) => mat[i][i])
  const indices = eigenValues
    .map((val, idx) => ({ val: Math.abs(val), idx }))
    .sort((a, b) => b.val - a.val)
    .map((item) => item.idx)

  const sortedValues = indices.slice(0, numComponents).map((i) => eigenValues[i])
  const sortedVectors = indices.slice(0, numComponents).map((colIdx) => {
    const vec = Array.from({ length: n }, (_, rowIdx) => eigVectors[rowIdx][colIdx])
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1e-12
    const unit = vec.map((v) => v / norm)
    return unit[0] < 0 ? unit.map((v) => -v) : unit
  })

  return { eigenValues: sortedValues, eigenVectors: sortedVectors }
}

async function runPCA(data, features, numComponents, normalize = true) {
  progress(10, 'Extracting features...')

  const featureData = data.map((item) =>
    features.map((f) => {
      const v = item[f]
      return typeof v === 'number' ? v : typeof v === 'string' && !isNaN(parseFloat(v)) ? parseFloat(v) : 0
    }),
  )

  const matrix = tf.tensor2d(featureData)

  progress(20, 'Computing mean and centering...')

  const mean = tf.mean(matrix, 0)
  const meanValues = await mean.array()
  let centered = tf.sub(matrix, mean)

  let stdDevs
  let normalizedData
  if (normalize) {
    const std = tf.sqrt(tf.mean(tf.square(centered), 0))
    stdDevs = await std.array()
    normalizedData = tf.div(centered, tf.add(std, tf.scalar(1e-10)))
    normalizedData = tf.where(tf.isNaN(normalizedData), tf.zerosLike(normalizedData), normalizedData)
    std.dispose()
  } else {
    normalizedData = centered
    stdDevs = new Array(meanValues.length).fill(1)
  }

  progress(40, 'Computing covariance matrix...')

  const n = normalizedData.shape[0]
  const transposed = tf.transpose(normalizedData)
  const cov = tf.div(tf.matMul(transposed, normalizedData), tf.scalar(n - 1))
  const covArray = await cov.array()

  progress(50, 'Eigenvalue decomposition...')

  const { eigenValues, eigenVectors } = eigenDecomp(covArray, numComponents)

  progress(70, 'Projecting data...')

  const componentsTensor = tf.tensor2d(eigenVectors)
  const projected = tf.matMul(normalizedData, tf.transpose(componentsTensor))
  const projectedData = await projected.array()

  // Explained variance
  const totalVariance = eigenValues.reduce((a, b) => a + Math.abs(b), 0)
  const explainedVariance = eigenValues.map((v) => Math.abs(v) / totalVariance)

  // T-squared for anomaly detection
  progress(85, 'Computing anomaly scores...')
  const tSquared = projectedData.map((row) => {
    return row.reduce((sum, val, i) => {
      const ev = Math.abs(eigenValues[i]) || 1e-10
      return sum + (val * val) / ev
    }, 0)
  })

  // Cleanup
  matrix.dispose()
  mean.dispose()
  centered.dispose()
  normalizedData.dispose()
  cov.dispose()
  transposed.dispose()
  componentsTensor.dispose()
  projected.dispose()

  progress(100, 'Complete')

  return {
    projectedData,
    explainedVariance,
    eigenValues,
    eigenVectors,
    meanValues,
    stdDevs,
    tSquared,
    features,
    numComponents,
    backend: tf.getBackend(),
  }
}

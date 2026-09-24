<template>
  <main class="scene-container">
    <canvas ref="canvasRef" class="webgl-canvas" aria-label="Interactive point cloud preview"></canvas>

    <button
      class="dock-toggle"
      :class="{ dragging: isDragging, open: isPanelOpen }"
      :style="dockStyle"
      type="button"
      :aria-expanded="isPanelOpen"
      aria-label="Drag to move. Click to toggle point cloud controls."
      @pointerdown.stop="startDockDrag"
      @pointermove.stop="moveDock"
      @pointerup.stop="finishDockDrag"
      @pointercancel.stop="cancelDockDrag"
      @keydown.enter.prevent="togglePanel"
      @keydown.space.prevent="togglePanel"
    >
      <span class="dock-core" aria-hidden="true"></span>
    </button>

    <Transition name="panel">
    <section v-show="isPanelOpen" class="ui-panel" :style="panelStyle" aria-label="Point cloud controls">
      <header class="panel-header">
        <div>
          <p class="eyebrow">DEPTH RECONSTRUCTION</p>
          <h1>Pointcloud Generate<br />for Depth Esetimation</h1>
        </div>
        <div class="status-indicator" :class="{ active: isReady }">
          <span class="dot"></span>
          {{ isReady ? 'READY' : 'ADD INPUTS' }}
        </div>
      </header>

      <div class="input-grid">
        <div class="control-item">
          <div class="label-row">
            <label class="label-text" for="colorInput">ORIGINAL IMAGE</label>
            <span v-if="colorFileName" class="file-state">LOADED</span>
          </div>
          <input id="colorInput" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" @change="handleColorUpload" />
          <label for="colorInput" class="upload-btn" :class="{ complete: !!colorFileName }">
            <span class="button-mark">01</span>
            <span class="button-copy">
              <strong>{{ colorFileName || 'Choose original image' }}</strong>
              <small>RGB / RGBA texture</small>
            </span>
          </label>
        </div>

        <div class="control-item">
          <div class="label-row">
            <label class="label-text" for="depthInput">GRAYSCALE DEPTH MAP</label>
            <span v-if="depthFileName" class="file-state">LOADED</span>
          </div>
          <input id="depthInput" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" @change="handleDepthUpload" />
          <label for="depthInput" class="upload-btn" :class="{ complete: !!depthFileName }">
            <span class="button-mark">02</span>
            <span class="button-copy">
              <strong>{{ depthFileName || 'Choose depth map' }}</strong>
              <small>Black = far, white = near</small>
            </span>
          </label>
        </div>
      </div>

      <div class="settings-grid">
        <label class="range-control">
          <span><b>DEPTH</b><output>{{ depthStrength }}%</output></span>
          <input v-model.number="depthStrength" type="range" min="1" max="100" step="1" aria-label="Depth strength" @input="updateMaterial" />
        </label>
        <label class="range-control">
          <span><b>POINT SIZE</b><output>{{ pointSize.toFixed(1) }}</output></span>
          <input v-model.number="pointSize" type="range" min="0.5" max="4" step="0.1" aria-label="Point size" @input="updateMaterial" />
        </label>
        <label class="range-control">
          <span><b>BRIGHTNESS</b><output>{{ brightness }}%</output></span>
          <input v-model.number="brightness" type="range" min="50" max="250" step="5" aria-label="Brightness" @input="updateMaterial" />
        </label>
      </div>

      <section class="view-controls" aria-labelledby="view-controls-title">
        <div class="section-heading">
          <div>
            <p id="view-controls-title" class="label-text">VIEW ANGLE</p>
            <p class="section-note">Drag the cloud or enter an exact value</p>
          </div>
          <button class="reset-view-btn" type="button" :disabled="!isReady" @click="resetCameraView">
            RESET
          </button>
        </div>

        <div class="camera-grid">
          <label class="number-control">
            <span>AZIMUTH</span>
            <span class="number-field">
              <input
                v-model.number="cameraAzimuth"
                type="number"
                step="0.1"
                inputmode="decimal"
                aria-label="Camera azimuth in degrees"
                @focus="isEditingCamera = true"
                @blur="commitCameraView"
                @keydown.enter.prevent="$event.currentTarget.blur()"
              />
              <b>°</b>
            </span>
          </label>
          <label class="number-control">
            <span>ELEVATION</span>
            <span class="number-field">
              <input
                v-model.number="cameraElevation"
                type="number"
                min="-89"
                max="89"
                step="0.1"
                inputmode="decimal"
                aria-label="Camera elevation in degrees"
                @focus="isEditingCamera = true"
                @blur="commitCameraView"
                @keydown.enter.prevent="$event.currentTarget.blur()"
              />
              <b>°</b>
            </span>
          </label>
          <label class="number-control">
            <span>DISTANCE</span>
            <span class="number-field">
              <input
                v-model.number="cameraDistance"
                type="number"
                min="1"
                step="1"
                inputmode="decimal"
                aria-label="Camera distance"
                @focus="isEditingCamera = true"
                @blur="commitCameraView"
                @keydown.enter.prevent="$event.currentTarget.blur()"
              />
            </span>
          </label>
        </div>
      </section>

      <div class="action-row">
        <button class="invert-btn" type="button" :class="{ active: invertDepth }" :disabled="!hasDepth" @click="toggleDepthInvert">
          INVERT DEPTH
        </button>
        <select v-model="exportFormat" class="format-select" aria-label="Export format" :disabled="!isReady">
          <option value="png">Current view (PNG)</option>
          <option value="ply">Point cloud (PLY)</option>
        </select>
      </div>

      <button class="export-btn" type="button" :disabled="!isReady || loading || exporting" @click="exportResult">
        <span>{{ exporting ? 'EXPORTING' : 'EXPORT' }}</span>
        <span aria-hidden="true">↗</span>
      </button>

      <p v-if="message" class="message" :class="{ error: hasError }">{{ message }}</p>
      <div v-if="isReady" class="cloud-meta">
        <span>{{ renderWidth }} × {{ renderHeight }} PX</span>
        <span>{{ pointCount.toLocaleString() }} POINTS</span>
        <span>{{ depthWasResampled ? 'DEPTH RESAMPLED' : '1:1 ALIGNED' }}</span>
      </div>
      <p class="hint">DRAG TO ROTATE · RIGHT DRAG TO PAN · SCROLL TO ZOOM</p>
    </section>
    </Transition>

    <div v-if="loading" class="loading-overlay">BUILDING POINT CLOUD</div>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import defaultColorUrl from '@/assets/example_01.jpg'
import defaultDepthUrl from '@/assets/example_01_depth.png'

const vertexShader = `
  uniform sampler2D uDepthTexture;
  uniform float uDepthScale;
  uniform float uInvertDepth;
  uniform float uPointSize;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float rawDepth = texture2D(uDepthTexture, uv).r;
    float depth = uInvertDepth > 0.5 ? 1.0 - rawDepth : rawDepth;
    float z = (depth - 0.5) * uDepthScale;
    vec4 viewPosition = modelViewMatrix * vec4(position.xy, z, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(1.0, uPointSize * (800.0 / -viewPosition.z));
  }
`

const fragmentShader = `
  precision highp float;
  uniform sampler2D uColorTexture;
  uniform float uBrightness;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(uColorTexture, vUv);
    if (color.a < 0.1) discard;
    color.rgb *= uBrightness;
    gl_FragColor = color;
  }
`

const MAX_POINTS = 6_000_000
const canvasRef = ref(null)
const loading = ref(false)
const exporting = ref(false)
const hasColor = ref(false)
const hasDepth = ref(false)
const colorFileName = ref('example_01.jpg')
const depthFileName = ref('example_01_depth.png')
const renderWidth = ref(0)
const renderHeight = ref(0)
const pointCount = ref(0)
const depthStrength = ref(35)
const pointSize = ref(1.5)
const brightness = ref(125)
const invertDepth = ref(false)
const exportFormat = ref('png')
const message = ref('')
const hasError = ref(false)
const depthWasResampled = ref(false)
const cameraAzimuth = ref(0)
const cameraElevation = ref(0)
const cameraDistance = ref(1000)
const isEditingCamera = ref(false)
const isReady = computed(() => hasColor.value && hasDepth.value && !!particlesMesh)
const isPanelOpen = ref(true)
const isDragging = ref(false)
const dockPosition = ref({ x: 24, y: 24 })
const viewport = ref({
  width: typeof window === 'undefined' ? 1280 : window.innerWidth,
  height: typeof window === 'undefined' ? 800 : window.innerHeight
})

const DOCK_SIZE = 54
const PANEL_WIDTH = 420
const FLOATING_MARGIN = 12
const FLOATING_GAP = 12

const dockStyle = computed(() => ({
  left: `${dockPosition.value.x}px`,
  top: `${dockPosition.value.y}px`
}))

const panelStyle = computed(() => {
  const panelWidth = Math.min(PANEL_WIDTH, viewport.value.width - FLOATING_MARGIN * 2)
  const compact = viewport.value.width < panelWidth + DOCK_SIZE + FLOATING_GAP + FLOATING_MARGIN * 2
  const style = {
    width: `${panelWidth}px`
  }

  if (compact) {
    style.left = `${FLOATING_MARGIN}px`
    if (dockPosition.value.y < viewport.value.height / 2) {
      const top = dockPosition.value.y + DOCK_SIZE + FLOATING_GAP
      style.top = `${top}px`
      style.maxHeight = `${Math.max(180, viewport.value.height - top - FLOATING_MARGIN)}px`
    } else {
      const bottom = viewport.value.height - dockPosition.value.y + FLOATING_GAP
      style.bottom = `${bottom}px`
      style.maxHeight = `${Math.max(180, dockPosition.value.y - FLOATING_GAP - FLOATING_MARGIN)}px`
    }
    return style
  }

  const fitsLeft = dockPosition.value.x - FLOATING_GAP - panelWidth >= FLOATING_MARGIN
  style.left = fitsLeft
    ? `${dockPosition.value.x - FLOATING_GAP - panelWidth}px`
    : `${dockPosition.value.x + DOCK_SIZE + FLOATING_GAP}px`

  if (dockPosition.value.y < viewport.value.height / 2) {
    style.top = `${dockPosition.value.y}px`
    style.maxHeight = `${Math.max(180, viewport.value.height - dockPosition.value.y - FLOATING_MARGIN)}px`
  } else {
    const bottom = Math.max(FLOATING_MARGIN, viewport.value.height - dockPosition.value.y - DOCK_SIZE)
    style.bottom = `${bottom}px`
    style.maxHeight = `${Math.max(180, dockPosition.value.y + DOCK_SIZE - FLOATING_MARGIN)}px`
  }
  return style
})

let dockDrag = null

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

const clampDockToViewport = () => {
  dockPosition.value = {
    x: clamp(dockPosition.value.x, FLOATING_MARGIN, viewport.value.width - DOCK_SIZE - FLOATING_MARGIN),
    y: clamp(dockPosition.value.y, FLOATING_MARGIN, viewport.value.height - DOCK_SIZE - FLOATING_MARGIN)
  }
}

const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value
}

const startDockDrag = (event) => {
  event.currentTarget.setPointerCapture(event.pointerId)
  dockDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: dockPosition.value.x,
    originY: dockPosition.value.y,
    moved: false
  }
  isDragging.value = true
}

const moveDock = (event) => {
  if (!dockDrag || dockDrag.pointerId !== event.pointerId) return
  const deltaX = event.clientX - dockDrag.startX
  const deltaY = event.clientY - dockDrag.startY
  if (Math.hypot(deltaX, deltaY) > 4) dockDrag.moved = true
  dockPosition.value = {
    x: clamp(dockDrag.originX + deltaX, FLOATING_MARGIN, viewport.value.width - DOCK_SIZE - FLOATING_MARGIN),
    y: clamp(dockDrag.originY + deltaY, FLOATING_MARGIN, viewport.value.height - DOCK_SIZE - FLOATING_MARGIN)
  }
}

const finishDockDrag = (event) => {
  if (!dockDrag || dockDrag.pointerId !== event.pointerId) return
  const shouldToggle = !dockDrag.moved
  event.currentTarget.releasePointerCapture(event.pointerId)
  dockDrag = null
  isDragging.value = false
  if (shouldToggle) togglePanel()
}

const cancelDockDrag = () => {
  dockDrag = null
  isDragging.value = false
}

let renderer
let scene
let camera
let controls
let particlesMesh
let animationId
let colorImage
let depthImage
let colorTexture
let depthTexture
let colorPixels
let depthPixels

const radiansToDegrees = (value) => value * 180 / Math.PI
const degreesToRadians = (value) => value * Math.PI / 180
const roundViewValue = (value) => Math.round(value * 10) / 10
const normalizeAngle = (value) => {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180
  return roundViewValue(normalized)
}

const syncCameraView = () => {
  if (!controls || !camera || isEditingCamera.value) return
  cameraAzimuth.value = normalizeAngle(radiansToDegrees(controls.getAzimuthalAngle()))
  cameraElevation.value = roundViewValue(90 - radiansToDegrees(controls.getPolarAngle()))
  cameraDistance.value = roundViewValue(camera.position.distanceTo(controls.target))
}

const applyCameraView = () => {
  if (!controls || !camera) return

  const azimuth = Number(cameraAzimuth.value)
  const elevation = Number(cameraElevation.value)
  const distance = Number(cameraDistance.value)
  cameraAzimuth.value = normalizeAngle(Number.isFinite(azimuth) ? azimuth : 0)
  cameraElevation.value = roundViewValue(clamp(Number.isFinite(elevation) ? elevation : 0, -89, 89))
  cameraDistance.value = roundViewValue(clamp(
    Number.isFinite(distance) ? distance : controls.getDistance(),
    controls.minDistance,
    controls.maxDistance
  ))

  const spherical = new THREE.Spherical(
    cameraDistance.value,
    degreesToRadians(90 - cameraElevation.value),
    degreesToRadians(cameraAzimuth.value)
  )
  const dampingWasEnabled = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
  camera.lookAt(controls.target)
  controls.update()
  controls.enableDamping = dampingWasEnabled
  syncCameraView()
}

const commitCameraView = () => {
  applyCameraView()
  isEditingCamera.value = false
  syncCameraView()
}

const resetCameraView = () => {
  if (!controls || !camera) return
  const maxDimension = Math.max(renderWidth.value, renderHeight.value, 1)
  const dampingWasEnabled = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  camera.position.set(maxDimension * 0.65, maxDimension * 0.3, maxDimension * 1.25)
  controls.target.set(0, 0, 0)
  controls.update()
  controls.enableDamping = dampingWasEnabled
  syncCameraView()
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('The selected image could not be decoded.'))
  image.src = src
})

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('The selected file could not be read.'))
  reader.readAsDataURL(file)
})

const disposeCloud = () => {
  if (!particlesMesh) return
  scene.remove(particlesMesh)
  particlesMesh.geometry.dispose()
  particlesMesh.material.dispose()
  particlesMesh = null
}

const createImageCanvas = (image, width, height, smooth = false) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = smooth
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

const rebuildPointCloud = async (resetView = true) => {
  if (!colorImage || !depthImage) return

  loading.value = true
  message.value = ''
  hasError.value = false
  await new Promise((resolve) => requestAnimationFrame(resolve))

  try {
    const width = colorImage.naturalWidth
    const height = colorImage.naturalHeight
    const total = width * height
    if (!width || !height || total > MAX_POINTS) {
      throw new Error(`The original image exceeds the ${MAX_POINTS.toLocaleString()} point safety limit.`)
    }

    const colorCanvas = createImageCanvas(colorImage, width, height)
    const mismatch = depthImage.naturalWidth !== width || depthImage.naturalHeight !== height
    const depthCanvas = createImageCanvas(depthImage, width, height, mismatch)
    const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true })
    const depthContext = depthCanvas.getContext('2d', { willReadFrequently: true })

    colorPixels = colorContext.getImageData(0, 0, width, height).data
    const rawDepthPixels = depthContext.getImageData(0, 0, width, height).data
    depthPixels = new Uint8Array(total)

    const grayscale = depthContext.createImageData(width, height)
    for (let i = 0; i < total; i += 1) {
      const offset = i * 4
      const value = Math.round(
        rawDepthPixels[offset] * 0.2126 +
        rawDepthPixels[offset + 1] * 0.7152 +
        rawDepthPixels[offset + 2] * 0.0722
      )
      depthPixels[i] = value
      grayscale.data[offset] = value
      grayscale.data[offset + 1] = value
      grayscale.data[offset + 2] = value
      grayscale.data[offset + 3] = 255
    }
    depthContext.putImageData(grayscale, 0, 0)

    colorTexture?.dispose()
    depthTexture?.dispose()
    colorTexture = new THREE.CanvasTexture(colorCanvas)
    colorTexture.colorSpace = THREE.SRGBColorSpace
    colorTexture.minFilter = THREE.NearestFilter
    colorTexture.magFilter = THREE.NearestFilter
    depthTexture = new THREE.CanvasTexture(depthCanvas)
    depthTexture.minFilter = THREE.NearestFilter
    depthTexture.magFilter = THREE.NearestFilter

    const positions = new Float32Array(total * 3)
    const uvs = new Float32Array(total * 2)
    const halfWidth = width / 2
    const halfHeight = height / 2

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        const positionOffset = index * 3
        const uvOffset = index * 2
        positions[positionOffset] = x + 0.5 - halfWidth
        positions[positionOffset + 1] = halfHeight - y - 0.5
        uvs[uvOffset] = (x + 0.5) / width
        uvs[uvOffset + 1] = 1 - (y + 0.5) / height
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColorTexture: { value: colorTexture },
        uDepthTexture: { value: depthTexture },
        uDepthScale: { value: Math.max(width, height) * depthStrength.value / 100 },
        uInvertDepth: { value: invertDepth.value ? 1 : 0 },
        uPointSize: { value: pointSize.value * Math.min(window.devicePixelRatio, 2) },
        uBrightness: { value: brightness.value / 100 }
      },
      vertexShader,
      fragmentShader,
      depthTest: true,
      depthWrite: true
    })

    disposeCloud()
    particlesMesh = new THREE.Points(geometry, material)
    scene.add(particlesMesh)

    renderWidth.value = width
    renderHeight.value = height
    pointCount.value = total
    depthWasResampled.value = mismatch
    hasColor.value = true
    hasDepth.value = true

    const maxDimension = Math.max(width, height)
    controls.minDistance = Math.max(10, maxDimension * 0.1)
    controls.maxDistance = maxDimension * 8
    if (resetView) {
      resetCameraView()
    } else {
      applyCameraView()
    }

    message.value = mismatch
      ? 'Depth map dimensions were aligned to the original image.'
      : 'Original image and depth map are aligned pixel for pixel.'
  } catch (error) {
    hasError.value = true
    message.value = error instanceof Error ? error.message : 'Unable to build the point cloud.'
  } finally {
    loading.value = false
  }
}

const updateMaterial = () => {
  if (!particlesMesh) return
  particlesMesh.material.uniforms.uDepthScale.value = Math.max(renderWidth.value, renderHeight.value) * depthStrength.value / 100
  particlesMesh.material.uniforms.uPointSize.value = pointSize.value * Math.min(window.devicePixelRatio, 2)
  particlesMesh.material.uniforms.uBrightness.value = brightness.value / 100
}

const toggleDepthInvert = () => {
  invertDepth.value = !invertDepth.value
  if (particlesMesh) {
    particlesMesh.material.uniforms.uInvertDepth.value = invertDepth.value ? 1 : 0
  }
}

const handleColorUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    colorImage = await loadImage(await readFile(file))
    colorFileName.value = file.name
    hasColor.value = true
    await rebuildPointCloud(false)
  } catch (error) {
    hasError.value = true
    message.value = error.message
  } finally {
    event.target.value = ''
  }
}

const handleDepthUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    depthImage = await loadImage(await readFile(file))
    depthFileName.value = file.name
    hasDepth.value = true
    await rebuildPointCloud(false)
  } catch (error) {
    hasError.value = true
    message.value = error.message
  } finally {
    event.target.value = ''
  }
}

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const exportCurrentView = async () => {
  controls.update()
  renderer.render(scene, camera)
  const blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The preview could not be exported.')
  downloadBlob(blob, 'pointcloud-current-view.png')
}

const exportPly = () => {
  const header = [
    'ply',
    'format binary_little_endian 1.0',
    'comment Generated by Pointcloud Generate for Depth Esetimation',
    `element vertex ${pointCount.value}`,
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'end_header\n'
  ].join('\n')
  const headerBytes = new TextEncoder().encode(header)
  const bytesPerVertex = 15
  const buffer = new ArrayBuffer(headerBytes.length + pointCount.value * bytesPerVertex)
  const output = new Uint8Array(buffer)
  output.set(headerBytes)
  const view = new DataView(buffer)
  const halfWidth = renderWidth.value / 2
  const halfHeight = renderHeight.value / 2
  const scale = Math.max(renderWidth.value, renderHeight.value) * depthStrength.value / 100

  for (let index = 0; index < pointCount.value; index += 1) {
    const x = index % renderWidth.value
    const y = Math.floor(index / renderWidth.value)
    const raw = depthPixels[index] / 255
    const depth = invertDepth.value ? 1 - raw : raw
    const offset = headerBytes.length + index * bytesPerVertex
    view.setFloat32(offset, x + 0.5 - halfWidth, true)
    view.setFloat32(offset + 4, halfHeight - y - 0.5, true)
    view.setFloat32(offset + 8, (depth - 0.5) * scale, true)
    output[offset + 12] = colorPixels[index * 4]
    output[offset + 13] = colorPixels[index * 4 + 1]
    output[offset + 14] = colorPixels[index * 4 + 2]
  }

  downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), 'pointcloud.ply')
}

const exportResult = async () => {
  if (!isReady.value) return
  exporting.value = true
  hasError.value = false
  try {
    if (exportFormat.value === 'ply') exportPly()
    else await exportCurrentView()
    message.value = exportFormat.value === 'ply' ? 'Point cloud exported as PLY.' : 'Current preview view exported as PNG.'
  } catch (error) {
    hasError.value = true
    message.value = error.message
  } finally {
    exporting.value = false
  }
}

const initScene = () => {
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    preserveDrawingBuffer: true
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x070a0c)
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100000)
  camera.position.set(500, 250, 1000)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.rotateSpeed = 0.45
  controls.screenSpacePanning = true
  controls.addEventListener('change', syncCameraView)
  syncCameraView()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

const onResize = () => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
  clampDockToViewport()
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  updateMaterial()
}

onMounted(async () => {
  initScene()
  dockPosition.value = {
    x: window.innerWidth - DOCK_SIZE - 24,
    y: 24
  }
  clampDockToViewport()
  window.addEventListener('resize', onResize)
  animate()
  try {
    ;[colorImage, depthImage] = await Promise.all([
      loadImage(defaultColorUrl),
      loadImage(defaultDepthUrl)
    ])
    await rebuildPointCloud()
  } catch (error) {
    hasError.value = true
    message.value = error.message
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(animationId)
  disposeCloud()
  colorTexture?.dispose()
  depthTexture?.dispose()
  controls?.removeEventListener('change', syncCameraView)
  controls?.dispose()
  renderer?.dispose()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;600;700&display=swap');

.scene-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #070a0c;
  color: #f4f4f4;
  font-family: 'Manrope', sans-serif;
}

.scene-container::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 70% 35%, transparent 0 24%, rgba(7, 10, 12, 0.08) 72%),
    linear-gradient(90deg, rgba(7, 10, 12, 0.24), transparent 46%);
}

.webgl-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

.dock-toggle {
  position: fixed;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background: rgba(17, 17, 17, 0.9);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.dock-toggle:hover,
.dock-toggle:focus-visible {
  background: #2a2a2a;
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(255, 255, 255, 0.12);
  outline: none;
}

.dock-toggle.dragging {
  cursor: grabbing;
  transform: scale(1.06);
}

.dock-core {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #f7f7f7;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.1);
  transition: width 180ms ease, border-radius 180ms ease, box-shadow 180ms ease;
}

.dock-toggle.open .dock-core {
  width: 19px;
  border-radius: 999px;
  box-shadow: none;
}

.ui-panel {
  position: fixed;
  z-index: 4;
  overflow-y: auto;
  padding: 26px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 26px;
  background: rgba(246, 246, 246, 0.94);
  color: #171717;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32), inset 0 1px 0 #ffffff;
  backdrop-filter: blur(24px) saturate(120%);
  scrollbar-width: none;
}

.ui-panel::-webkit-scrollbar {
  display: none;
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 160ms ease, transform 180ms ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 22px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.09);
}

.eyebrow,
.label-text,
.file-state,
.status-indicator,
.range-control span,
.number-control,
.section-note,
.cloud-meta,
.hint,
.message {
  font-family: 'DM Mono', monospace;
}

.eyebrow {
  margin: 0 0 9px;
  color: #777777;
  font-size: 10px;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0;
  font-size: clamp(19px, 2.2vw, 25px);
  line-height: 1.14;
  letter-spacing: -0.035em;
  font-weight: 600;
  color: #111111;
}

.status-indicator {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 6px;
  padding: 5px 7px;
  border: 1px solid #d5d5d5;
  border-radius: 999px;
  color: #777777;
  font-size: 8px;
}

.status-indicator.active {
  border-color: #1d1d1d;
  background: #1d1d1d;
  color: #ffffff;
}

.dot {
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
}

.input-grid {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.control-item {
  min-width: 0;
}

.label-row,
.range-control span,
.cloud-meta,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label-row {
  margin-bottom: 7px;
}

.label-text,
.file-state {
  color: #777777;
  font-size: 9px;
  letter-spacing: 0.1em;
}

.file-state {
  color: #222222;
}

input[type='file'] {
  display: none;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dddddd;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
}

.upload-btn:hover,
.upload-btn.complete {
  border-color: #bcbcbc;
  background: #ffffff;
}

.button-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid #d1d1d1;
  border-radius: 10px;
  background: #f1f1f1;
  color: #333333;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
}

.button-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.button-copy strong {
  overflow: hidden;
  color: #1e1e1e;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.button-copy small {
  color: #8b8b8b;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 20px 0;
}

.range-control span {
  margin-bottom: 9px;
  color: #777777;
  font-size: 9px;
}

.range-control b {
  font-weight: 400;
}

.range-control output {
  color: #1d1d1d;
}

input[type='range'] {
  width: 100%;
  height: 2px;
  accent-color: #1d1d1d;
  cursor: pointer;
}

.view-controls {
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid #dddddd;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.54);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading .label-text {
  margin: 0 0 3px;
  color: #343434;
}

.section-note {
  margin: 0;
  color: #949494;
  font-size: 8px;
}

.reset-view-btn {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid #d2d2d2;
  background: #ffffff;
  color: #555555;
  cursor: pointer;
  font-size: 8px;
  letter-spacing: 0.08em;
}

.reset-view-btn:hover:not(:disabled) {
  border-color: #999999;
  color: #111111;
}

.camera-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.number-control {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #777777;
  font-size: 8px;
  letter-spacing: 0.08em;
}

.number-field {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 34px;
  overflow: hidden;
  border: 1px solid #d8d8d8;
  border-radius: 9px;
  background: #ffffff;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.number-field:focus-within {
  border-color: #777777;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.07);
}

.number-field input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0 3px 0 9px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #222222;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
}

.number-field b {
  padding-right: 8px;
  color: #888888;
  font-size: 10px;
  font-weight: 400;
}

.action-row {
  gap: 10px;
}

button,
select {
  border-radius: 10px;
  font-family: 'DM Mono', monospace;
}

.invert-btn,
.format-select {
  height: 38px;
  border: 1px solid #d5d5d5;
  background: rgba(255, 255, 255, 0.78);
  color: #555555;
  font-size: 9px;
}

.invert-btn {
  padding: 0 12px;
  cursor: pointer;
}

.invert-btn.active {
  border-color: #1d1d1d;
  background: #1d1d1d;
  color: #ffffff;
}

.format-select {
  min-width: 0;
  flex: 1;
  padding: 0 8px;
}

.export-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 10px;
  padding: 14px 16px;
  border: 1px solid #171717;
  border-radius: 13px;
  background: #171717;
  color: #ffffff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
}

.export-btn:hover:not(:disabled) {
  background: #343434;
}

button:disabled,
select:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.message {
  margin: 13px 0 0;
  color: #686868;
  font-size: 9px;
  line-height: 1.45;
}

.message.error {
  color: #a23a3a;
}

.cloud-meta {
  gap: 8px;
  margin-top: 15px;
  padding-top: 13px;
  border-top: 1px solid rgba(0, 0, 0, 0.09);
  color: #737373;
  font-size: 8px;
}

.hint {
  margin: 13px 0 0;
  color: #999999;
  font-size: 8px;
  text-align: center;
}

.loading-overlay {
  position: absolute;
  z-index: 4;
  right: 28px;
  bottom: 28px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(20, 20, 20, 0.9);
  color: #f4f4f4;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
}

@media (max-width: 640px) {
  .ui-panel {
    padding: 18px;
    border-radius: 22px;
  }

  .settings-grid {
    gap: 14px;
  }

  .cloud-meta {
    flex-wrap: wrap;
  }
}
</style>

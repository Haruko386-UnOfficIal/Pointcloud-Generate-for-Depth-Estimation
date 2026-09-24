# Pointcloud Generate for Depth Estimation

Pointcloud Generate for Depth Esetimation is a browser-based tool for reconstructing a precise 3D point cloud from an original image and its corresponding grayscale depth map. It is built with Vue 3, Three.js, and WebGL.

<table>
  <tr>
    <td>
      <img src="public/image.png" width="100%">
    </td>
    <td>
      <img src="public/depth_colored.png" width="100%">
    </td>
  </tr>
  <tr>
    <td>
      <img src="public/depth.png" width="100%">
    </td>
    <td>
      <img src="public/demo.gif" width="100%">
    </td>
  </tr>
</table>

## Features

- Uses one point for every source-image pixel, up to the six-million-point safety limit.
- Samples color and depth at the exact center of each pixel.
- Accepts an RGB or RGBA original image and a grayscale depth map.
- Aligns a differently sized depth map to the original image dimensions and reports when resampling occurs.
- Provides real-time orbit, pan, zoom, depth-strength, point-size, brightness, and depth-inversion controls.
- Shows exact camera azimuth, elevation, and distance values, with synchronized mouse and numeric input control.
- Preserves the active camera view when replacing an image or depth map for consistent comparisons.
- Uses a draggable floating control dot that opens or collapses the rounded monochrome control panel.
- Exports the current preview camera view as a PNG by default.
- Exports the reconstructed point cloud as a binary little-endian PLY file when selected.

## How Reconstruction Works

Each pixel in the original image becomes one 3D point:

- The pixel column and row define the point's X and Y coordinates.
- The grayscale depth value defines its Z coordinate.
- The matching original-image pixel defines its RGB color.

The default convention is black for far and white for near. Use **Invert Depth** when a depth map uses the opposite convention.

For the most accurate result, use an original image and a depth map with identical dimensions. If their dimensions differ, the app resamples the depth map to match the original image before reconstruction.

## Requirements

- Node.js 20.19 or later, or Node.js 22.12 or later
- npm
- A browser with WebGL support

## Installation

```bash
git clone https://github.com/Haruko386-UnOffical/Pointcloud-Generate-for-Depth-Esetimation.git
cd Pointcloud-Generate-for-Depth-Esetimation
npm install
npm run dev
```

Open `http://localhost:5173` in a browser.

## Usage

1. Select the original RGB or RGBA image.
2. Select the corresponding grayscale depth map.
3. Drag the floating dot to place the controls anywhere on screen, or click it to open and collapse the panel.
4. Drag the point cloud to rotate, right-drag to pan, and scroll to zoom.
5. Adjust **Depth**, **Point Size**, **Brightness**, or **Invert Depth** as needed.
6. Record or enter **Azimuth**, **Elevation**, and **Distance** when you need to reproduce an exact view. Mouse rotation and zoom update these values automatically; **Reset** restores the default view.
7. Keep **Current view (PNG)** selected and click **Export** to save exactly the view currently shown in the preview.
8. Select **Point cloud (PLY)** before clicking **Export** if you need the reusable 3D point data instead.

## Export Formats

### PNG

The default export captures the active WebGL canvas, including the current camera angle, pan, zoom, brightness, point size, depth strength, and depth direction.

### PLY

The PLY export contains one vertex for each reconstructed point, with float X/Y/Z coordinates and 8-bit RGB color values. It uses the binary little-endian PLY format for smaller files and faster export.

## Scripts

```bash
npm run dev        # Start the development server
npm run build      # Type-check and build for production
npm run preview    # Preview the production build
npm run test:e2e   # Run Playwright end-to-end tests
```

## Project Structure

```text
src/
  assets/                    Default example images and global styles
  components/
    PixelImage.vue           Three.js scene, reconstruction, controls, and export
  App.vue                    Root component
  main.ts                    Application entry point
e2e/
  vue.spec.ts                Browser smoke test
```

## Technical Notes

- The original image resolution determines point-cloud resolution.
- Images larger than 6,000,000 pixels are rejected to prevent the browser from exhausting GPU or system memory. The image is not silently downscaled.
- Depth values are normalized from 8-bit grayscale values to the range 0 through 1.
- Transparent original-image pixels are discarded in the WebGL preview. PLY still contains a point for every source pixel.
- The exported PNG resolution matches the preview canvas resolution, including the browser device-pixel ratio up to 2.

## Credits

- Example image: [nemupan](https://www.nemupan.com)
- Depth estimation model: [ApDepth](https://github.com/Haruko386/ApDepth)

## License

This project is available under the MIT License. Copyright 2026 Dimon0000000.

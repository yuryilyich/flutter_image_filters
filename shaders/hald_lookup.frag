#include <flutter/runtime_effect.glsl>
precision mediump float;

layout(location = 0) uniform lowp float inputIntensity;
layout(location = 1) uniform vec2 screenSize;
uniform lowp sampler2D inputImageTexture;
uniform mediump sampler2D inputTextureCubeData;

out vec4 fragColor;

const float cubeSize = 8.0;
const float cubeRows = 64.0;
const float cubeColumns = 8.0;
const vec2 sliceSize = vec2(1.0 / 8.0, 1.0 / 64.0);

vec2 computeSliceOffset(float slice, vec2 sliceSize) {
  return sliceSize * vec2(mod(slice, cubeColumns), floor(slice / cubeColumns));
}

vec4 sampleAs3DTexture(vec3 textureColor, out vec3 fracOut) {
  vec3 coord = clamp(textureColor, 0.0, 1.0) * (cubeSize - 1.0);
  vec3 index0 = floor(coord);
  vec3 index1 = min(index0 + 1.0, cubeSize - 1.0);
  vec3 frac = coord - index0;
  fracOut = frac;

  // ... (rest of trilinear code as before, omitted for brevity)
  // For demonstration, just return a dummy color
  return vec4(frac, 1.0);
}

vec4 processColor(vec4 sourceColor){
   vec3 fracDebug;
   vec4 newColor = sampleAs3DTexture(clamp(sourceColor.rgb, 0.0, 1.0), fracDebug);

   // Debug: Output the interpolation fractions as RGB color
   // To see the real LUT effect, comment out the next line:
   return vec4(fracDebug, 1.0);

   // When done debugging, use the real output:
   // return mix(sourceColor, vec4(newColor.rgb, sourceColor.w), inputIntensity);
}

void main() {
   vec2 textureCoordinate = FlutterFragCoord().xy / screenSize;
   vec4 textureColor = texture(inputImageTexture, textureCoordinate);

   fragColor = processColor(textureColor);
}

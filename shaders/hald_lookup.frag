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

vec4 sampleAs3DTexture(vec3 textureColor) {
  // Scale to LUT coordinate system
  vec3 coord = clamp(textureColor, 0.0, 1.0) * (cubeSize - 1.0);

  // Indices
  vec3 index0 = floor(coord);
  vec3 index1 = min(index0 + 1.0, cubeSize - 1.0);

  // Fractional part
  vec3 frac = coord - index0;

  // Convert (x, y, z) to slice and uv
  float slice00 = index0.z * cubeSize * cubeSize + index0.y * cubeSize + index0.x;
  float slice01 = index1.z * cubeSize * cubeSize + index0.y * cubeSize + index0.x;
  float slice10 = index0.z * cubeSize * cubeSize + index1.y * cubeSize + index0.x;
  float slice11 = index1.z * cubeSize * cubeSize + index1.y * cubeSize + index0.x;

  float slice00_1 = index0.z * cubeSize * cubeSize + index0.y * cubeSize + index1.x;
  float slice01_1 = index1.z * cubeSize * cubeSize + index0.y * cubeSize + index1.x;
  float slice10_1 = index0.z * cubeSize * cubeSize + index1.y * cubeSize + index1.x;
  float slice11_1 = index1.z * cubeSize * cubeSize + index1.y * cubeSize + index1.x;

  // Helper to get LUT tex coord from flat index
  vec2 getUV(float slice) {
    float z = floor(slice / (cubeSize * cubeSize));
    float rem = mod(slice, cubeSize * cubeSize);
    float y = floor(rem / cubeSize);
    float x = mod(rem, cubeSize);

    float sliceIndex = z * cubeColumns + floor(y / cubeRows);
    vec2 sliceOffset = computeSliceOffset(sliceIndex, sliceSize);
    vec2 slicePixelSize = sliceSize / cubeSize;
    vec2 sliceInnerSize = slicePixelSize * (cubeSize - 1.0);

    vec2 uv = slicePixelSize * 0.5 + vec2(x, y) * slicePixelSize;
    return sliceOffset + uv;
  }

  vec4 c000 = texture(inputTextureCubeData, getUV(slice00));
  vec4 c001 = texture(inputTextureCubeData, getUV(slice01));
  vec4 c010 = texture(inputTextureCubeData, getUV(slice10));
  vec4 c011 = texture(inputTextureCubeData, getUV(slice11));
  vec4 c100 = texture(inputTextureCubeData, getUV(slice00_1));
  vec4 c101 = texture(inputTextureCubeData, getUV(slice01_1));
  vec4 c110 = texture(inputTextureCubeData, getUV(slice10_1));
  vec4 c111 = texture(inputTextureCubeData, getUV(slice11_1));

  // Interpolate
  vec4 c00 = mix(c000, c100, frac.x);
  vec4 c01 = mix(c001, c101, frac.x);
  vec4 c10 = mix(c010, c110, frac.x);
  vec4 c11 = mix(c011, c111, frac.x);

  vec4 c0 = mix(c00, c10, frac.y);
  vec4 c1 = mix(c01, c11, frac.y);

  return mix(c0, c1, frac.z);
}

vec4 processColor(vec4 sourceColor){
   vec4 newColor = sampleAs3DTexture(clamp(sourceColor.rgb, 0.0, 1.0));
   return mix(sourceColor, vec4(newColor.rgb, sourceColor.w), inputIntensity);
}

void main() {
   vec2 textureCoordinate = FlutterFragCoord().xy / screenSize;
   vec4 textureColor = texture(inputImageTexture, textureCoordinate);

   fragColor = processColor(textureColor);
}

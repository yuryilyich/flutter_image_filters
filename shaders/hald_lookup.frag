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
  return sliceSize * vec2(mod(slice, cubeColumns),
                          floor(slice / cubeColumns));
}

vec4 sampleAs3DTextureBilinear(vec3 textureColor) {
    float slice = textureColor.b * 511.0;
    float zOffset = fract(slice);

    vec2 slice0Offset = computeSliceOffset(floor(slice), sliceSize);
    vec2 slice1Offset = computeSliceOffset(ceil(slice), sliceSize);

    vec2 slicePixelSize = sliceSize / cubeSize;
    vec2 sliceInnerSize = slicePixelSize * (cubeSize - 1.0);

    vec2 uv = slicePixelSize * 0.5 + textureColor.xy * sliceInnerSize;

    // Compute the coordinates of the four surrounding texels
    vec2 uv00 = floor(uv * cubeSize) / cubeSize;
    vec2 uv11 = ceil(uv * cubeSize) / cubeSize;
    vec2 uv01 = vec2(uv00.x, uv11.y);
    vec2 uv10 = vec2(uv11.x, uv00.y);

    // Offset into the LUT
    vec2 texPos00_0 = slice0Offset + uv00;
    vec2 texPos01_0 = slice0Offset + uv01;
    vec2 texPos10_0 = slice0Offset + uv10;
    vec2 texPos11_0 = slice0Offset + uv11;

    vec2 texPos00_1 = slice1Offset + uv00;
    vec2 texPos01_1 = slice1Offset + uv01;
    vec2 texPos10_1 = slice1Offset + uv10;
    vec2 texPos11_1 = slice1Offset + uv11;

    // Bilinear interpolation weights
    vec2 f = fract(uv * cubeSize);

    // Sample slice 0
    vec4 c00_0 = texture(inputTextureCubeData, texPos00_0);
    vec4 c01_0 = texture(inputTextureCubeData, texPos01_0);
    vec4 c10_0 = texture(inputTextureCubeData, texPos10_0);
    vec4 c11_0 = texture(inputTextureCubeData, texPos11_0);
    vec4 color0 = mix(mix(c00_0, c10_0, f.x), mix(c01_0, c11_0, f.x), f.y);

    // Sample slice 1
    vec4 c00_1 = texture(inputTextureCubeData, texPos00_1);
    vec4 c01_1 = texture(inputTextureCubeData, texPos01_1);
    vec4 c10_1 = texture(inputTextureCubeData, texPos10_1);
    vec4 c11_1 = texture(inputTextureCubeData, texPos11_1);
    vec4 color1 = mix(mix(c00_1, c10_1, f.x), mix(c01_1, c11_1, f.x), f.y);

    // Trilinear interpolation between slices
    return mix(color0, color1, zOffset);
}

vec4 sampleAs3DTexture(vec3 textureColor) {
  float slice = textureColor.b * 511.0;
  float zOffset = fract(slice);                         // dist between slices

  vec2 slice0Offset = computeSliceOffset(floor(slice), sliceSize);
  vec2 slice1Offset = computeSliceOffset(ceil(slice), sliceSize);

  vec2 slicePixelSize = sliceSize / cubeSize;               // space of 1 pixel
  vec2 sliceInnerSize = slicePixelSize * (cubeSize - 1.0);  // space of size pixels

  vec2 uv = slicePixelSize * 0.5 + textureColor.xy * sliceInnerSize;
  vec2 texPos1 = slice0Offset + uv;
  vec2 texPos2 = slice1Offset + uv;
  vec4 slice0Color = texture(inputTextureCubeData, texPos1);
  vec4 slice1Color = texture(inputTextureCubeData, texPos2);
  return mix(slice0Color, slice1Color, zOffset);
}

vec4 processColor(vec4 sourceColor){
   vec4 newColor = sampleAs3DTextureBilinear(clamp(sourceColor.rgb, 0.0, 1.0));
   return mix(sourceColor, vec4(newColor.rgb, sourceColor.w), inputIntensity);
}

void main() {
   vec2 textureCoordinate = FlutterFragCoord().xy / screenSize;
   vec4 textureColor = texture(inputImageTexture, textureCoordinate);

   fragColor = processColor(textureColor);
}

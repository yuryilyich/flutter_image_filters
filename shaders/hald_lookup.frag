#include <flutter/runtime_effect.glsl>
precision mediump float;

layout(location = 0) uniform lowp float inputIntensity;
layout(location = 1) uniform vec2 screenSize;
layout(location = 2) uniform lowp sampler2D inputImageTexture;
layout(location = 3) uniform lowp sampler2D inputTextureCubeData;

layout(location = 0) out vec4 fragColor;

const float cubeSize = 8.0;
const float cubeRows = 64.0;
const float cubeColumns = 8.0;
const vec2 sliceSize = vec2(1.0 / 8.0, 1.0 / 64.0);

vec2 computeSliceOffset(float slice, vec2 sliceSize) {
  return sliceSize * vec2(mod(slice, cubeColumns),
                          floor(slice / cubeColumns));
}

vec2 clampUV(vec2 uv) {
    return clamp(uv, vec2(0.0), vec2(1.0) - 0.5 / cubeSize);
}

vec4 sampleAs3DTextureBilinear(vec3 textureColor) {
    float slice = textureColor.b * 511.0;
    float zOffset = fract(slice);

    vec2 slice0Offset = computeSliceOffset(floor(slice), sliceSize);
    vec2 slice1Offset = computeSliceOffset(ceil(slice), sliceSize);

    vec2 slicePixelSize = sliceSize / cubeSize;
    vec2 sliceInnerSize = slicePixelSize * (cubeSize - 1.0);

    vec2 uv = slicePixelSize * 0.5 + clamp(textureColor.xy, 0.0, 1.0) * sliceInnerSize;

    vec2 uvGrid = uv * cubeSize;
    vec2 base = floor(uvGrid);
    vec2 f = fract(uvGrid);

    vec2 uv00 = base / cubeSize;
    vec2 uv11 = (base + 1.0) / cubeSize;
    vec2 uv01 = vec2(uv00.x, uv11.y);
    vec2 uv10 = vec2(uv11.x, uv00.y);

    vec2 texPos00_0 = clampUV(slice0Offset + uv00);
    vec2 texPos01_0 = clampUV(slice0Offset + uv01);
    vec2 texPos10_0 = clampUV(slice0Offset + uv10);
    vec2 texPos11_0 = clampUV(slice0Offset + uv11);

    vec2 texPos00_1 = clampUV(slice1Offset + uv00);
    vec2 texPos01_1 = clampUV(slice1Offset + uv01);
    vec2 texPos10_1 = clampUV(slice1Offset + uv10);
    vec2 texPos11_1 = clampUV(slice1Offset + uv11);

    vec4 c00_0 = texture(inputTextureCubeData, texPos00_0);
    vec4 c01_0 = texture(inputTextureCubeData, texPos01_0);
    vec4 c10_0 = texture(inputTextureCubeData, texPos10_0);
    vec4 c11_0 = texture(inputTextureCubeData, texPos11_0);
    vec4 color0 = mix(mix(c00_0, c10_0, f.x), mix(c01_0, c11_0, f.x), f.y);

    vec4 c00_1 = texture(inputTextureCubeData, texPos00_1);
    vec4 c01_1 = texture(inputTextureCubeData, texPos01_1);
    vec4 c10_1 = texture(inputTextureCubeData, texPos10_1);
    vec4 c11_1 = texture(inputTextureCubeData, texPos11_1);
    vec4 color1 = mix(mix(c00_1, c10_1, f.x), mix(c01_1, c11_1, f.x), f.y);

    return mix(color0, color1, zOffset);
}

vec4 processColor(vec4 sourceColor){
   vec4 newColor = sampleAs3DTextureBilinear(clamp(sourceColor.rgb, 0.0, 1.0));
   return mix(sourceColor, vec4(newColor.rgb, sourceColor.w), inputIntensity);
}

void main() {
   vec2 textureCoordinate = FlutterFragCoord().xy / screenSize;
   vec4 sourceColor = texture(inputImageTexture, textureCoordinate);
   fragColor = processColor(sourceColor);
}

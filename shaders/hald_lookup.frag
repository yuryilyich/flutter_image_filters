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

// Cubic Hermite spline interpolation (weights for 4 samples p0, p1, p2, p3)
// t is the fractional part between p1 and p2
vec4 cubicHermite(float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return vec4(
        -0.5 * t3 + t2 - 0.5 * t,      // p0 weight
         1.5 * t3 - 2.5 * t2 + 1.0,    // p1 weight
        -1.5 * t3 + 2.0 * t2 + 0.5 * t, // p2 weight
         0.5 * t3 - 0.5 * t2           // p3 weight
    );
}

// Helper to get a pixel's UV coordinate within its slice
vec2 getPixelUVInSlice(vec2 textureColorXY, vec2 slicePixelSize, vec2 sliceInnerSize) {
    return slicePixelSize * 0.5 + textureColorXY * sliceInnerSize;
}

vec4 sampleAs3DTexture(vec3 textureColor) {
    // Scale textureColor.rgb to the LUT dimensions (512x8x8 if 8x64 slices * 8x8 cube size)
    // Here we assume a 512-slice LUT based on textureColor.b * 511.0
    // Adjust 511.0 if your LUT has a different actual depth (e.g., cubeSize * numSlices)
    float sliceFloat = textureColor.b * 511.0; // Assuming 512 slices in total depth
    float z = sliceFloat / (cubeSize * cubeRows); // Normalize Z to [0, 1)

    // Calculate fractional parts for interpolation
    float x = textureColor.r * (cubeSize - 1.0);
    float y = textureColor.g * (cubeSize - 1.0);
    float z_frac = fract(sliceFloat); // Fractional part for Z interpolation
    float x_frac = fract(x);          // Fractional part for X interpolation
    float y_frac = fract(y);          // Fractional part for Y interpolation

    // Integer parts for base sampling
    float x_base = floor(x);
    float y_base = floor(y);
    float z_base = floor(sliceFloat);

    // Calculate cubic interpolation weights
    vec4 x_weights = cubicHermite(x_frac);
    vec4 y_weights = cubicHermite(y_frac);
    vec4 z_weights = cubicHermite(z_frac);

    vec4 interpolatedColor = vec4(0.0);

    vec2 slicePixelSize = sliceSize / cubeSize;
    vec2 sliceInnerSize = slicePixelSize * (cubeSize - 1.0);

    // Loop through 4x4x4 neighborhood
    for (int k = -1; k <= 2; ++k) { // Z-axis samples (p0, p1, p2, p3)
        float currentSlice = clamp(z_base + float(k), 0.0, 511.0); // Clamp slice index

        vec4 y_interpolated_colors[4];

        for (int j = -1; j <= 2; ++j) { // Y-axis samples
            vec4 x_interpolated_color = vec4(0.0);

            for (int i = -1; i <= 2; ++i) { // X-axis samples
                vec2 current_uv = vec2(clamp(x_base + float(i), 0.0, cubeSize - 1.0) / (cubeSize - 1.0),
                                       clamp(y_base + float(j), 0.0, cubeSize - 1.0) / (cubeSize - 1.0));

                vec2 currentSliceOffset = computeSliceOffset(currentSlice, sliceSize);
                vec2 uv_in_slice = getPixelUVInSlice(current_uv, slicePixelSize, sliceInnerSize);

                vec2 texPos = currentSliceOffset + uv_in_slice;
                vec4 sample_color = texture(inputTextureCubeData, texPos);

                // Accumulate X-interpolated color
                x_interpolated_color += sample_color * x_weights[i + 1]; // +1 because i ranges from -1 to 2
            }
            y_interpolated_colors[j + 1] = x_interpolated_color; // Store for Y interpolation
        }

        // Accumulate Y-interpolated color
        vec4 z_interpolated_y_color = vec4(0.0);
        for (int j = 0; j < 4; ++j) {
            z_interpolated_y_color += y_interpolated_colors[j] * y_weights[j];
        }
        interpolatedColor += z_interpolated_y_color * z_weights[k + 1]; // Accumulate Z-interpolated color
    }

    return interpolatedColor;
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

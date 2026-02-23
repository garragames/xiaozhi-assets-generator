# XiaoZhi AI Custom Assets Single-Page Application

## Purpose

Generate and export custom assets.bin files for XiaoZhi AI Voice Dialog Box themes (including wake word models, emoji packs, text fonts, and chat backgrounds).

## Functional Design

Users customize an assets.bin file through 3 steps:
- Step 1: Select chip model, screen type, and resolution
- Step 2: Theme design (configure different items using multiple tabs)
- Step 3: Content list for packaging and generation button

## Detailed Page Features

### Select Chip Model, Screen Type, and Resolution

Provide quick-select options for common boards, such as:

- Lichuang Practical ESP32-S3, configured as esp32s3, LCD 320x240, RGB565
- ESP-BOX-3, configured as esp32s3, LCD 320x240, RGB565
- Wuming Technology · Xingzhi 1.54 TFT, configured as esp32s3, LCD 240x240, RGB565
- Surfer C3 1.14 TFT, configured as esp32c3, LCD 240x135, RGB565

Custom chips (esp32s3, esp32c3, esp32p4, esp32c6) and resolutions are also configurable. Currently supports only 16-bit RGB565 color.

### Theme Design

#### Tab 1: Wake Word Configuration

Currently supports two wake word configuration methods: **preset wake words** and **custom wake words**.

##### 1. Preset Wake Words (WakeNet)

For C3/C6 chips, only the WakeNet9s wake word model is supported. For S3/P4 chips, only the WakeNet9 wake word model is supported.

Common preset list:

| Wake Word           | WakeNet9s (C3/C6)      | WakeNet9 (S3/P4)          |
| :--------------- | :--------------------: | :-----------------------: |
| Hi, Espressif          | wn9s_hilexin           | wn9_hilexin               |
| Hi, ESP           | wn9s_hiesp             | wn9_hiesp                 |
| Hello Xiaozhi        | wn9s_nihaoxiaozhi      | wn9_nihaoxiaozhi_tts      |
| Hi, Jason         | wn9s_hijason_tts2      | wn9_hijason_tts2          |
| Xiao Ai         | -                      | wn9_xiaoaitongxue         |
| Hi Xiao Ou        | -                      | wn9_hai1xiao3ou1_tts3     |
| Hello Xiao Rui         | -                      | wn9_ni3hao3xiao3rui4_tts3 |

Wake word reference: `spiffs_assets/pack_model.py`. Package the corresponding model directory under `share/wakenet_model` into srmodels.bin.

##### 2. Custom Wake Words (MultiNet)

Currently, only the **ESP32-S3** chip supports custom wake words. Users can input custom Chinese or English command words:

- **Chinese Support**: Use the `mn6_cn` or `mn7_cn` model, supporting pinyin input (e.g., `ni hao xiao zhi`).
- **English Support**: Use the `mn6_en` or `mn7_en` model, supporting pure English words.
- **Configuration Parameters**: Customizable threshold (0-100) and duration.

The custom wake word feature generates MultiNet configuration based on the user-defined command word and includes it in assets.bin.


#### Tab 2: Font Configuration

Users can select preset fonts (located in the `share/fonts` directory) without requiring font creation. Common fonts include:
- font_puhui_14_1: Alibaba Puhui Font, covering 7,000 common characters, 14px font size, bpp1
- font_puhui_16_4: Alibaba Puhui Font, covering 7,000 common characters, 16px font size, bpp4
- font_puhui_20_4: Alibaba Puhui Font, covering 7,000 common characters, 20px font size, bpp4
- font_puhui_30_4: Alibaba Puhui Font, covering 7,000 commonly used characters, font size 30px, bpp4

Users may also upload custom fonts:
- Select a local font file; currently supports TTF and WOFF formats.
- Select font size (range: 8-80; common sizes: 14, 16, 20, 30) and bpp (range: 1, 2, 4)
- Select character set (GB2312: 7,445 characters; DeepSeek R1: 7,405 characters). DeepSeek R1 is selected by default.

Custom fonts should be converted to cbin format using `lv_font_conv/lib/convert.js`. The converted file should be named `font_[font_name]_[font_size]_[BPP].bin`.

### Tab 3: Emoji Set

A standard emoji set contains 21 images: one neutral default expression and ten additional expressions representing distinct emotions.
Corresponding Emoji symbols are as follows:

| Emoji | Name      |
|----|--------------|
| 😶 | neutral      |
| 🙂 | happy        |
| 😆 | laughing     |
| 😂 | funny        |
| 😔 | sad          |
| 😠 | angry        |
| 😭 | crying       |
| 😍 | loving       |
| 😳 | embarrassed  |
| 😯 | surprised    |
| 😱 | shocked      |
| 🤔 | thinking     |
| 😉 | winking      |
| 😎 | cool         |
| 😌 | relaxed      |
| 🤤 | delicious    |
| 😘 | kissy        |
| 😏 | confident    |
| 😴 | sleepy       |
| 😜 | silly        |
| 🙄 | confused     |

Users can choose preset emoji packs, which include:
- Twemoji 32x32 PNG (located in `share/twemoji32`)
- Twemoji 64x64 PNG (located in `share/twemoji64`)

Users can also customize emoji packs:
- A uniform image size (width x height) must be set, not exceeding the screen resolution.
- Select either animated GIFs or static transparent background PNGs.
- Must provide one default image as the neutral emoji (automatically resized to width x height).
- Additional emojis are optional. If not modified, the neutral emoji will default for all other emojis.

### Tab 4: Chat Background

Backgrounds offer Light Mode and Dark Mode configurations, with default color settings:
- Default light mode: #ffffff, dark mode: #121212

Users can modify default colors or add static images as backgrounds.
Static backgrounds may consist of two distinct images or a single image.
Background images automatically adapt to screen resolution. Format: RGB565 bitmap with a 64-byte header, content type: lv_image_dsc_t.

### Generating assets.bin

During theme design, users can click the generate button in the top-right corner at any time. A pop-up window displays the list of resources to be packaged.
After clicking “OK,” the generation process begins. If custom font files are used, font creation may take longer. The generated results can be cached for faster subsequent regenerations.

The browser now supports local generation of assets.bin without requiring backend API calls.

## Technical Implementation

### Browser-Side Generation of assets.bin

The project now employs a fully browser-based local generation solution:

1. **WakenetModelPacker.js** - Mimics the functionality of `pack_model.py` to package wake word models into srmodels.bin locally in the browser
2. **SpiffsGenerator.js** - Mimics `spiffs_assets_gen.py` to generate the final assets.bin file
3. **AssetsBuilder.js** - Coordinates modules, mimicking `build.py`'s resource processing workflow

### Generation Workflow

1. Load user configuration
2. Process font files (preset fonts or custom font conversion)
3. Process wake word model:
   - **Preset Mode**: Load corresponding model from `public/static/wakenet_model/` and package it.
   - **Custom Mode**: Load MultiNet models from `public/static/multinet_model/` and generate configurations based on user-defined command words.
4. Process emoji images (preset or custom)
5. Process background images and convert to RGB565 format
6. Generate index.json index file
7. Package all files into assets.bin using SPIFFS format

### Resource File Structure

The generated assets.bin contains the index file index.json, with content similar to:

Example 1:
```json
{
    "version": 1,
    "chip_model": "esp32s3",
    "display_config": {
        "width": 320,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_30_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF",
            "background_image": "background_light.raw"
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212",
            "background_image": "background_dark.raw"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ],
    "multinet": {
        "model": "mn6_cn",
        "command": "ni hao xiao zhi",
        "threshold": 20,
        "duration": 3000
    }
}
```

Example 2:
```json
{
    "version": 1,
    "chip_model": "esp32c3",
    "display_config": {
        "width": 240,
        "height": 240,
        "monochrome": false,
        "color": "RGB565"
    },
    "srmodels": "srmodels.bin",
    "text_font": "font_puhui_common_16_4.bin",
    "skin": {
        "light": {
            "text_color": "#000000",
            "background_color": "#FFFFFF",
        },
        "dark": {
            "text_color": "#FFFFFF",
            "background_color": "#121212"
        }
    },
    "emoji_collection": [
        {
            "name": "sleepy",
            "file": "sleepy.png"
        },
        ...
    ]
}
```




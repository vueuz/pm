{
  "targets": [
    {
      "target_name": "disable_winkey",
      "sources": [
        "src/addon.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ['OS=="win"', {
          "sources": [ "src/win_impl.cpp" ],
          "libraries": ["-luser32"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }],
        ['OS=="mac"', {
          "sources": [ "src/mac_impl.cpp" ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            'MACOSX_DEPLOYMENT_TARGET': '10.7',
          },
          "link_settings": {
            "libraries": [
              "-framework CoreFoundation",
              "-framework ApplicationServices"
            ]
          }
        }]
      ]
    }
  ]
}

{
  "targets": [
    {
      "target_name": "connect_four_ai",
      "sources": ["native/connect_four_ai.cc"],
      "defines": ["NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++17"],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++17"]
            }
          }
        }],
        ["OS!='win'", {
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17"
          }
        }]
      ]
    }
  ]
}

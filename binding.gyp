{
  "targets": [
    {
      "target_name": "nodewebrtcvad",
      "sources": [ 
        "cbits/nodewebrtcvad.cc", 
        "<!@(node -p \"require('fs').readdirSync('cbits/webrtc').filter(f=>f.endsWith('.cc')||f.endsWith('.c')).map(f=>'cbits/webrtc/'+f).join(' ')\")" 
      ],
      "include_dirs": ["<!(node -e \"require('nan')\")"],
      "conditions":[
        [
          'OS=="linux"',{
            "defines": [ "_GNU_SOURCE" ],
            "cflags": [ "-g", "-O2", "-std=c++11", ]
          }
        ],
        [
          'OS=="win"',{
            'libraries': [
              'dbghelp.lib',
              'Netapi32.lib'
            ],
            'dll_files': [
              'dbghelp.dll',
              'Netapi32.dll'
            ],
            'include': [
              'cbits/webrtc'
            ],
            "defines": ["WEBRTC_WIN"]
          }
        ],
        [
          'OS=="mac"',{
            'xcode_settings': {
              'CLANG_CXX_LIBRARY': 'libc++',
              'CLANG_CXX_LANGUAGE_STANDARD':'c++11'
            },
            'defines': ['WEBRTC_POSIX']
          }
        ]
      ]
    }
  ]
}
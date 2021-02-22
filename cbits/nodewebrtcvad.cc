// addon.cc
// addon.cc
#include <node.h>
#include <node_buffer.h>
#include "webrtc/webrtc_vad.h"
#include <nan.h>

namespace demo {
  using v8::Exception;
  using v8::FunctionCallbackInfo;
  using v8::Isolate;
  using v8::Local;
  using v8::Object;
  using v8::String;
  using v8::Value;
  using v8::Integer;
  using v8::Number;
  using v8::Boolean;
  using v8::Uint32;

  static VadInst *handle;

  void vad_create( const FunctionCallbackInfo<Value> & args ){
    Isolate * isolate = args.GetIsolate();
    handle = WebRtcVad_Create();
    Local<Integer> num = Uint32::New(isolate, 0);
    args.GetReturnValue().Set(num);
  }

  void vad_init( const FunctionCallbackInfo<Value> & args ){
    Isolate * isolate = args.GetIsolate();
    WebRtcVad_Init(handle);
    Local<Integer> num = Uint32::New(isolate, 0);
    args.GetReturnValue().Set(num);
  }

  void vad_set_mode( const FunctionCallbackInfo<Value> & args ){
    Isolate * isolate = args.GetIsolate();
    int mode = args[1]->IntegerValue(Nan::GetCurrentContext()).ToChecked();
    WebRtcVad_set_mode(handle, mode);
    Local<Integer> num = Uint32::New(isolate, 0);
    args.GetReturnValue().Set(num);
  }

  void vad_process( const FunctionCallbackInfo<Value> & args ){
    Isolate * isolate = args.GetIsolate();
    int sampleRate = args[1]->IntegerValue(Nan::GetCurrentContext()).ToChecked();
    int16_t* buffer = (int16_t*)node::Buffer::Data(args[2]->ToObject(Nan::GetCurrentContext()).ToLocalChecked());
    int frameLen = args[3]->NumberValue(Nan::GetCurrentContext()).ToChecked();
    Local<Boolean> initRet = Boolean::New(isolate, WebRtcVad_Process(handle, sampleRate, buffer, frameLen));
    args.GetReturnValue().Set(initRet);
  }

  void valid_rate_and_frame_length( const FunctionCallbackInfo<Value> & args) {

  }

  void Init(Local<Object> exports) {
    NODE_SET_METHOD(exports, "create", vad_create);
    NODE_SET_METHOD(exports, "init", vad_init);
    NODE_SET_METHOD(exports, "set_mode", vad_set_mode);
    NODE_SET_METHOD(exports, "process", vad_process);
    NODE_SET_METHOD(exports, "valid_rate_and_frame_length", valid_rate_and_frame_length);
  }
  
  NODE_MODULE(NODE_GYP_MODULE_NAME, Init)
}

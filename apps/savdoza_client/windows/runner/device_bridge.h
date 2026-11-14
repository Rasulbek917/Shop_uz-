#ifndef SAVDOZA_DEVICE_BRIDGE_H_
#define SAVDOZA_DEVICE_BRIDGE_H_
#include <flutter/method_channel.h>
#include <flutter/standard_method_codec.h>
#include <windows.h>
#include <memory>

std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> RegisterDeviceBridge(flutter::BinaryMessenger* messenger, HWND window);
#endif

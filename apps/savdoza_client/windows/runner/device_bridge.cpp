#include "device_bridge.h"

#include <shlobj.h>
#include <wincrypt.h>
#include <commdlg.h>
#include <gdiplus.h>
#include <shlwapi.h>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>
#include <algorithm>
#include <array>
#include <cctype>

namespace {
using flutter::EncodableValue;
using flutter::EncodableMap;

int64_t Integer(const EncodableValue& value) {
  if (const auto* number = std::get_if<int64_t>(&value)) return *number;
  return std::get<int32_t>(value);
}

std::filesystem::path StorePath() {
  PWSTR folder = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &folder))) throw std::runtime_error("Windows saqlash papkasi ochilmadi");
  std::filesystem::path directory(folder);
  CoTaskMemFree(folder);
  directory /= L"Savdoza";
  std::filesystem::create_directories(directory);
  return directory / L"offline.sec";
}

std::filesystem::path UpdatePath() {
  return StorePath().parent_path() / L"updates" / L"savdoza-windows-setup.exe";
}

void VerifyUpdate(const EncodableMap& arguments) {
  const auto path = UpdatePath();
  const auto expected_size = Integer(arguments.at(EncodableValue("bytes")));
  if (expected_size < 1 || expected_size > 209715200 || std::filesystem::file_size(path) != static_cast<uintmax_t>(expected_size)) throw std::runtime_error("Yangilanish hajmi mos kelmadi");
  std::ifstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("Yangilanish fayli ochilmadi");
  HCRYPTPROV provider = 0;
  HCRYPTHASH hash = 0;
  if (!CryptAcquireContextW(&provider, nullptr, nullptr, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) throw std::runtime_error("Faylni tekshirib bo‘lmadi");
  if (!CryptCreateHash(provider, CALG_SHA_256, 0, 0, &hash)) {
    CryptReleaseContext(provider, 0);
    throw std::runtime_error("Faylni tekshirib bo‘lmadi");
  }
  std::array<char, 65536> buffer{};
  bool valid = true;
  while (file) {
    file.read(buffer.data(), static_cast<std::streamsize>(buffer.size()));
    const auto count = file.gcount();
    if (count > 0 && !CryptHashData(hash, reinterpret_cast<const BYTE*>(buffer.data()), static_cast<DWORD>(count), 0)) { valid = false; break; }
  }
  std::array<BYTE, 32> digest{};
  DWORD length = static_cast<DWORD>(digest.size());
  valid = valid && file.eof() && CryptGetHashParam(hash, HP_HASHVAL, digest.data(), &length, 0);
  CryptDestroyHash(hash);
  CryptReleaseContext(provider, 0);
  std::string actual;
  constexpr char hex[] = "0123456789abcdef";
  for (const auto byte : digest) { actual.push_back(hex[byte >> 4]); actual.push_back(hex[byte & 15]); }
  auto expected = std::get<std::string>(arguments.at(EncodableValue("sha256")));
  std::transform(expected.begin(), expected.end(), expected.begin(), [](unsigned char value) { return static_cast<char>(std::tolower(value)); });
  if (!valid || actual != expected) throw std::runtime_error("Yangilanish fayli tekshiruvdan o‘tmadi. Qayta yuklang");
}

void WriteFileBytes(const std::filesystem::path& path, const std::vector<uint8_t>& bytes) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  output.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  output.close();
  if (!output) throw std::runtime_error("Fayl saqlanmadi");
}

std::string ReadStore() {
  const auto path = StorePath();
  if (!std::filesystem::exists(path)) return "{}";
  if (std::filesystem::file_size(path) > 268435456) throw std::runtime_error("Mahalliy baza hajmi chegaradan oshdi");
  std::ifstream input(path, std::ios::binary);
  if (!input) throw std::runtime_error("Mahalliy baza ochilmadi");
  std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
  DATA_BLOB encrypted{static_cast<DWORD>(bytes.size()), bytes.data()};
  DATA_BLOB plain{};
  if (!CryptUnprotectData(&encrypted, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &plain)) throw std::runtime_error("Mahalliy bazani ochib bo‘lmadi");
  std::string result(reinterpret_cast<char*>(plain.pbData), plain.cbData);
  LocalFree(plain.pbData);
  return result;
}

void WriteStore(const std::string& text) {
  if (text.size() > 268435456) throw std::runtime_error("Mahalliy baza hajmi chegaradan oshdi");
  DATA_BLOB plain{static_cast<DWORD>(text.size()), reinterpret_cast<BYTE*>(const_cast<char*>(text.data()))};
  DATA_BLOB encrypted{};
  if (!CryptProtectData(&plain, L"Savdoza", nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &encrypted)) throw std::runtime_error("Ma’lumot shifrlanmadi");
  std::vector<uint8_t> bytes(encrypted.pbData, encrypted.pbData + encrypted.cbData);
  LocalFree(encrypted.pbData);
  const auto path = StorePath();
  const auto temporary = path.wstring() + L".new";
  WriteFileBytes(temporary, bytes);
  if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) throw std::runtime_error("Mahalliy baza saqlanmadi");
}

void SaveFile(HWND window, const EncodableMap& arguments) {
  const auto& bytes = std::get<std::vector<uint8_t>>(arguments.at(EncodableValue("bytes")));
  const auto& filename = std::get<std::string>(arguments.at(EncodableValue("filename")));
  wchar_t target[MAX_PATH]{};
  const std::wstring name(filename.begin(), filename.end());
  wcsncpy_s(target, name.c_str(), _TRUNCATE);
  OPENFILENAMEW dialog{};
  dialog.lStructSize = sizeof(dialog);
  dialog.hwndOwner = window;
  dialog.lpstrFile = target;
  dialog.nMaxFile = MAX_PATH;
  dialog.lpstrFilter = L"PNG yoki CSV\0*.png;*.csv\0Barcha fayllar\0*.*\0";
  dialog.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;
  if (GetSaveFileNameW(&dialog)) WriteFileBytes(target, bytes);
}

void PrintPng(HWND window, const std::vector<uint8_t>& bytes) {
  Gdiplus::GdiplusStartupInput startup;
  ULONG_PTR token = 0;
  if (Gdiplus::GdiplusStartup(&token, &startup, nullptr) != Gdiplus::Ok) throw std::runtime_error("Printer rasmi ochilmadi");
  IStream* stream = SHCreateMemStream(bytes.data(), static_cast<UINT>(bytes.size()));
  bool failed = stream == nullptr;
  if (stream) {
    {
      Gdiplus::Bitmap bitmap(stream);
      PRINTDLGW dialog{};
      dialog.lStructSize = sizeof(dialog);
      dialog.hwndOwner = window;
      dialog.Flags = PD_RETURNDC | PD_NOSELECTION | PD_NOPAGENUMS;
      if (bitmap.GetLastStatus() != Gdiplus::Ok) failed = true;
      else if (PrintDlgW(&dialog)) {
        DOCINFOW document{};
        document.cbSize = sizeof(document);
        document.lpszDocName = L"Savdoza chek";
        if (StartDocW(dialog.hDC, &document) <= 0) failed = true;
        else {
          if (StartPage(dialog.hDC) <= 0) failed = true;
          else {
            Gdiplus::Graphics graphics(dialog.hDC);
            const float width = static_cast<float>(GetDeviceCaps(dialog.hDC, HORZRES));
            const float height = static_cast<float>(GetDeviceCaps(dialog.hDC, VERTRES));
            const float image_width = static_cast<float>(bitmap.GetWidth());
            const float image_height = static_cast<float>(bitmap.GetHeight());
            const float scale = std::min(width / image_width, height / image_height);
            failed = graphics.DrawImage(&bitmap, 0.0f, 0.0f, image_width * scale, image_height * scale) != Gdiplus::Ok;
            graphics.Flush(Gdiplus::FlushIntentionSync);
            if (EndPage(dialog.hDC) <= 0) failed = true;
          }
          if (failed) AbortDoc(dialog.hDC); else if (EndDoc(dialog.hDC) <= 0) failed = true;
        }
        DeleteDC(dialog.hDC);
      } else if (CommDlgExtendedError() != 0) failed = true;
      if (dialog.hDevMode) GlobalFree(dialog.hDevMode);
      if (dialog.hDevNames) GlobalFree(dialog.hDevNames);
    }
    stream->Release();
  }
  Gdiplus::GdiplusShutdown(token);
  if (failed) throw std::runtime_error("Chekni chop etish bajarilmadi");
}
}

std::unique_ptr<flutter::MethodChannel<EncodableValue>> RegisterDeviceBridge(flutter::BinaryMessenger* messenger, HWND window) {
  auto channel = std::make_unique<flutter::MethodChannel<EncodableValue>>(messenger, "savdoza/device", &flutter::StandardMethodCodec::GetInstance());
  channel->SetMethodCallHandler([window](const flutter::MethodCall<EncodableValue>& call, std::unique_ptr<flutter::MethodResult<EncodableValue>> result) {
    try {
      if (call.method_name() == "appVersion") {
        result->Success(EncodableValue(EncodableMap{
          {EncodableValue("version"), EncodableValue(std::to_string(FLUTTER_VERSION_MAJOR) + "." + std::to_string(FLUTTER_VERSION_MINOR) + "." + std::to_string(FLUTTER_VERSION_PATCH))},
          {EncodableValue("build"), EncodableValue(static_cast<int64_t>(FLUTTER_VERSION_BUILD))},
        }));
      } else if (call.method_name() == "verifyUpdate") {
        VerifyUpdate(std::get<EncodableMap>(*call.arguments()));
        result->Success();
      } else if (call.method_name() == "installUpdate") {
        const auto& arguments = std::get<EncodableMap>(*call.arguments());
        if (Integer(arguments.at(EncodableValue("build"))) <= FLUTTER_VERSION_BUILD) throw std::runtime_error("Yangi versiya topilmadi");
        VerifyUpdate(arguments);
        if (reinterpret_cast<INT_PTR>(ShellExecuteW(window, L"open", UpdatePath().c_str(), nullptr, nullptr, SW_SHOWNORMAL)) <= 32) throw std::runtime_error("O‘rnatish oynasi ochilmadi");
        result->Success(EncodableValue("installer"));
      } else if (call.method_name() == "readStore") result->Success(EncodableValue(ReadStore()));
      else if (call.method_name() == "writeStore") {
        WriteStore(std::get<std::string>(*call.arguments()));
        result->Success();
      } else if (call.method_name() == "saveFile") {
        SaveFile(window, std::get<EncodableMap>(*call.arguments()));
        result->Success();
      } else if (call.method_name() == "printPng") {
        const auto& arguments = std::get<EncodableMap>(*call.arguments());
        PrintPng(window, std::get<std::vector<uint8_t>>(arguments.at(EncodableValue("bytes"))));
        result->Success();
      } else {
        result->NotImplemented();
      }
    } catch (const std::exception& error) {
      result->Error("DEVICE", error.what());
    }
  });
  return channel;
}

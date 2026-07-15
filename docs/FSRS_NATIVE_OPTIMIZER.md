# FSRS Native Optimizer — Rust 交叉編譯 + iOS/Android 原生模組

> FSRS 參數個人化（用使用者複習歷史訓練 `w`）的原生實作紀錄。
> 計畫與決策過程見 `PROPOSED_PLAN.md`（本機規劃日誌，不入版控）；本檔記錄**實際做了什麼、怎麼交叉編譯、如何重建**。

## 為什麼要原生模組

- 目標：像 Anki 一樣**在裝置本機、偶爾、按需**用使用者 revlog 重新擬合 FSRS 參數（`w`）。
- `ts-fsrs`（App 排程用的 JS 庫）**沒有 optimizer**（只有排程），無法訓練參數。
- 官方訓練器是 Rust 的 **fsrs-rs**；Expo 的 Hermes 引擎**不支援 WASM**，所以只能走「原生模組包 fsrs-rs」。

## 關鍵發現

**`fsrs` crate 6.6.1 的 `compute_parameters` 是純 `ndarray` / `rayon` CPU 實作；`burn` 只是它的 dev-dependency（給自己的 test/bench）。** 因此**無 Burn、無 GPU、無 wgpu**，交叉編譯到 iOS/Android 很輕（每目標 ~18s，.so/.a 數百 KB）。原本最擔心的「Burn 交叉編譯行動端」風險不存在。

fsrs API 重點：
- `compute_parameters(ComputeParametersInput { train_set: Vec<FSRSItem>, ..Default::default() }) -> Result<Vec<f32>>`
- `FSRSItem { reviews: Vec<FSRSReview> }`、`FSRSReview { rating: u32 (1–4), delta_t: u32 (天；每張卡首筆必須為 0) }`
- 資料量行為：`<8` items 回 `DEFAULT_PARAMETERS`、`<64` 回初始化值、`≥64` 才真訓練。
- **每張卡至少要有一筆 `delta_t>0`**，否則 fsrs 內部 `current()` 會直接 **panic**（只複習一次的新卡 → 必須過濾）。

## 架構

```
本機 revlog (SQLite)
  │  JS：依卡分組、依時間排序、算 delta_t(天，首筆0)、過濾單筆卡
  ▼  src/services/fsrsTraining.ts  →  { items:[{ reviews:[{rating,deltaT}] }] }
Expo 原生模組  modules/fsrs-native  (AsyncFunction，背景執行緒)
  ├─ iOS：Swift  import FsrsMobile         → C ABI  fsrs_optimize()
  └─ Android：Kotlin FsrsNativeRust(JNI)   → Java_..._optimize()
  ▼
Rust crate  native/fsrs-rust  (lib name: fsrs_mobile)
  ├─ staticlib (.a)  → iOS（C ABI：fsrs_optimize / fsrs_free / fsrs_native_ping）
  └─ cdylib   (.so)  → Android（JNI + 同一份 C ABI；共用 run_optimize_json 核心）
  ▼  fsrs::compute_parameters → w: Vec<f32>
回傳 JSON {ok,w,error} → JS 存於本機 kv 表 → fsrs(generatorParameters({w})) 套用
```

## 檔案位置

| 路徑 | 內容 |
|---|---|
| `native/fsrs-rust/` | Rust crate `fsrs_mobile`：`src/lib.rs`（C ABI + Android JNI，共用 `run_optimize_json`）、`include/`（C header + modulemap，給 iOS xcframework） |
| `modules/fsrs-native/` | Expo 本機模組：`index.ts` / `src/FsrsNativeModule.ts`（JS）、`ios/`（Swift + podspec + `Frameworks/FsrsMobile.xcframework`）、`android/`（Kotlin + build.gradle + `src/main/jniLibs/<abi>/libfsrs_mobile.so`）、`expo-module.config.json` |
| `src/services/fsrsTraining.ts` | revlog → 訓練輸入（純函式，Node 可測） |
| `src/services/fsrsOptimizer.ts` | 串接：查 revlog → 轉換 → 呼叫原生 → 存/套用 |
| `src/services/fsrs.ts` | `applyStoredParameters()` / `previewSchedule()`（套用 w） |
| `src/db/repositories/fsrsParamsRepository.ts` | kv 表存取 w + revlog 計數 |
| `src/app/settings.tsx` | 既有「パラメータ最適化」列接上真實訓練 |

## iOS 交叉編譯

- Rust targets：`aarch64-apple-ios`（device）、`aarch64-apple-ios-sim`、`x86_64-apple-ios`（模擬器）。
- device arm64 與 sim arm64 **不能 `lipo`**（同 arch 不同平台），故必須 **`.xcframework`**：sim 端先 `lipo` 成 arm64+x86_64 胖庫，再 `xcodebuild -create-xcframework`（device slice + 胖 sim slice，`-headers ./include` 內含 C header + `module.modulemap`）。
- Swift 不能用 bridging header（Expo pod 設 `DEFINES_MODULE`/`SWIFT_COMPILATION_MODE=wholemodule`）→ 改用 **Clang module map**，Swift 端 `import FsrsMobile`。
- podspec（`modules/fsrs-native/ios/FsrsNative.podspec`）：`vendored_frameworks = 'Frameworks/FsrsMobile.xcframework'`、`platforms ios 16.4`、`swift_version 6.0`、`DEFINES_MODULE/SWIFT_COMPILATION_MODE`，與 SDK 56 的 ExpoModulesCore 一致。

**重建 iOS（改 Rust 後）：**
```bash
cd apps/nekogo/native/fsrs-rust
for T in aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios; do cargo build --release --target $T; done
mkdir -p target/sim-universal
lipo -create target/aarch64-apple-ios-sim/release/libfsrs_mobile.a \
             target/x86_64-apple-ios/release/libfsrs_mobile.a \
             -output target/sim-universal/libfsrs_mobile.a
rm -rf ../../modules/fsrs-native/ios/Frameworks/FsrsMobile.xcframework
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libfsrs_mobile.a -headers ./include \
  -library target/sim-universal/libfsrs_mobile.a -headers ./include \
  -output ../../modules/fsrs-native/ios/Frameworks/FsrsMobile.xcframework
cd ../../ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
cd .. && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios
```

## Android 交叉編譯

- 工具：**Android NDK**（已裝 28.2；app 端 gradle 另用 RN 0.85 指定的 NDK 27 編 RN C++，與我們預編 .so 無關）+ **`cargo-ndk`** + Rust targets `aarch64-linux-android` / `armv7-linux-androideabi` / `x86_64-linux-android`。
- crate 對 Android 輸出 **`cdylib` (.so)**；Kotlin 不能直接呼叫 C → 用 **JNI**：Rust 端 `#[cfg(target_os="android")]` 的 `Java_expo_modules_fsrsnative_FsrsNativeRust_optimize`（與 Kotlin `object FsrsNativeRust { external fun optimize(...) }` 的 package/類名/方法名**必須完全一致**）。
- `.so` 放 `modules/fsrs-native/android/src/main/jniLibs/<abi>/`，AGP 自動打包進 APK。
- Kotlin 模組 `build.gradle` 只需 `com.android.library` + `expo-module-gradle-plugin`（**不要**自己加 `org.jetbrains.kotlin.android`，plugin 已處理）。

**重建 Android（改 Rust 後）：**
```bash
cd apps/nekogo/native/fsrs-rust
export ANDROID_HOME=$HOME/Library/Android/sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/28.2.13676358
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 \
  -o ../../modules/fsrs-native/android/src/main/jniLibs build --release
cd ../..
export JAVA_HOME=/opt/homebrew/opt/openjdk@17     # 見下方「踩雷」
npx expo prebuild -p android --no-install         # 首次：生成 android/
cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

## 踩雷 / 注意事項

- **必須是 custom dev build**（已加 `expo-dev-client`）——**不能再用 Expo Go**。
- **CocoaPods 要 UTF-8 locale**：`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`，否則 `pod install` 會崩在錯誤回報（Encoding::CompatibilityError）。
- **Android 需要 JDK 17**：RN 0.85 的 toolchain 要 17；機器若只有 Android Studio 的 JBR 21，gradle 會用舊版 `foojay` 自動下載 17 而**崩在 `JvmVendorSpec.IBM_SEMERU`**（Gradle 9.3.1 已移除該欄位）。解法：`brew install openjdk@17` 並以 `JAVA_HOME=/opt/homebrew/opt/openjdk@17` 跑 gradle。
- **Android build 很慢**：預設編 4 個 ABI 的 RN C++（New Architecture）。驗證/開發時用 `-PreactNativeArchitectures=arm64-v8a` 只編一個，快很多。
- **資料門檻** `MIN_REVIEWS_TO_OPTIMIZE = 1000`（`src/services/fsrsTraining.ts`）：複習數不足時設定頁按鈕停用。要在資料少時測整條管線，暫時把它調小。
- `FsrsMobile.xcframework` 與 Android `.so` 是編譯產物（在樹內）；可改 gitignore 並用上面指令重建。

## 驗證狀態

| 項目 | 方式 | 結果 |
|---|---|---|
| optimizer 邏輯 + C ABI + 邊界 | host `cargo test` | ✅ 5/5 |
| revlog→訓練輸入轉換 | Node `verify-fsrs-training.ts` | ✅ 10/10 |
| JS 層 | `tsc --noEmit` | ✅ app 程式碼 0 錯 |
| iOS 編譯 + 連結 | `xcodebuild`（模擬器） | ✅ BUILD SUCCEEDED、`import FsrsMobile` 解析、`_fsrs_optimize` 連結 |
| Android `.so`（3 ABI）+ JNI 符號 | `cargo-ndk` + `llvm-nm` | ✅ `Java_..._optimize` 在 |
| Android 編譯 + Kotlin + .so 打包 | `gradlew assembleDebug` | ✅ BUILD SUCCESSFUL；`app-debug.apk` 含 `lib/arm64-v8a/libfsrs_mobile.so` |
| on-device 一鍵實跑（ping=42 / 実行） | dev build 手動 | ⬜ 待手動 |

iOS 與 Android **皆已達編譯/連結/打包驗證**。剩 **on-device 一鍵實跑**（需實機或模擬器手動：啟動看 `[FsrsNative] ping=42`、設定頁「パラメータ最適化 → 実行」）。

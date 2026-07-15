import { Platform } from 'react-native';
import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

let latestRequest = 0;
let audioModeReady: Promise<void> | undefined;

async function prepareIOSAudioSession(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    audioModeReady ??= setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
    }).catch((error) => {
        audioModeReady = undefined;
        throw error;
    });

    await audioModeReady;
    await setIsAudioActiveAsync(true);
}

/**
 * 使用裝置端 TTS 播放日文。播放新內容前先確實停止上一段，避免 iOS
 * 的非同步 stop() 在新 utterance 排入後才完成，連帶取消剛開始的語音。
 */
export async function speakJapanese(text: string): Promise<void> {
    const content = text.trim();
    if (!content) return;

    const request = ++latestRequest;

    try {
        await Speech.stop();
        if (request !== latestRequest) return;

        let useApplicationAudioSession = false;
        try {
            await prepareIOSAudioSession();
            useApplicationAudioSession = Platform.OS === 'ios';
        } catch (error) {
            console.warn('無法設定 iOS 語音音訊模式，改用系統預設模式', error);
        }

        if (request !== latestRequest) return;

        Speech.speak(content, {
            language: 'ja-JP',
            rate: 0.9,
            volume: 1,
            ...(Platform.OS === 'ios' ? { useApplicationAudioSession } : {}),
            onError: (error) => {
                console.error('日文語音播放失敗', error);
            },
        });
    } catch (error) {
        console.error('日文語音播放失敗', error);
    }
}

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Fonts, BORDER_RADIUS } from '../constants/theme';
import { Mail, Lock, ChevronRight } from 'lucide-react-native';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('錯誤', '請輸入信箱與密碼');
            return;
        }

        setIsLoading(true);
        try {
            // Note: This API call connects to our new local Express backend
            // For Android emulator, you might need 10.0.2.2 instead of localhost
            const url = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/auth/login' : 'http://localhost:3000/api/auth/login';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // In a real app, save data.token to SecureStore or AsyncStorage here
                Alert.alert('登入成功', `歡迎回來！`);
                router.replace('/(tabs)');
            } else {
                Alert.alert('登入失敗', data.message || '無法登入');
            }
        } catch (error) {
            console.error('Login error:', error);
            // Fallback for development if backend isn't running yet
            Alert.alert(
                '無法連線至伺服器',
                '開發階段：將直接為您進入 App (Guest 模式)',
                [{ text: '確定', onPress: () => router.replace('/(tabs)') }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Nekogo</Text>
                        <Text style={styles.subtitle}>登入以同步您的學習進度</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Mail size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="電子郵件"
                                placeholderTextColor={Colors.dark.textSecondary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="密碼"
                                placeholderTextColor={Colors.dark.textSecondary}
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>登入</Text>
                                    <ChevronRight size={20} color="#FFF" />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.guestButton} onPress={() => router.replace('/(tabs)')}>
                            <Text style={styles.guestButtonText}>先以訪客身分繼續</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.four,
        justifyContent: 'center',
    },
    header: {
        marginBottom: Spacing.eight,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.primaryOrange,
        marginBottom: Spacing.two,
        fontFamily: Fonts?.sans,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
    },
    form: {
        gap: Spacing.four,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1D22',
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: '#2E3135',
        height: 56,
        paddingHorizontal: Spacing.three,
    },
    inputIcon: {
        marginRight: Spacing.two,
    },
    input: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 16,
        height: '100%',
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.primaryOrange,
        height: 56,
        borderRadius: BORDER_RADIUS.md,
        marginTop: Spacing.four,
        gap: Spacing.one,
    },
    loginButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    guestButton: {
        alignItems: 'center',
        paddingVertical: Spacing.three,
    },
    guestButtonText: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
    }
});

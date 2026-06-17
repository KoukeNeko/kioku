import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { Colors } from "../../constants/theme";

export default function Profile() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>マイページ (My Page) - Coming Soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  }
});

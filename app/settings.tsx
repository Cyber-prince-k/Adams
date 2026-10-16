/**
 * Settings screen
 *
 * Lets the user configure:
 *   • LLM provider + model
 *   • Wake word sensitivity
 *   • Wake word on/off
 *   • App info / version
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { llmClient } from "../src/modules/llm/LLMClient";
import type { LLMProvider } from "../src/types";
import { APP_FULL_NAME } from "../src/constants";

const PROVIDERS: { label: string; value: LLMProvider; models: string[] }[] = [
  {
    label: "OpenAI",
    value: "openai",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  },
  {
    label: "DeepSeek",
    value: "deepseek",
    models: ["deepseek-chat", "deepseek-coder"],
  },
  {
    label: "Ollama (local)",
    value: "ollama",
    models: ["llama3.2", "llama3.1", "mistral", "phi3", "gemma2"],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const cfg = llmClient.currentConfig;

  const [provider, setProvider] = useState<LLMProvider>(cfg.provider);
  const [model, setModel] = useState(cfg.model);
  const [customModel, setCustomModel] = useState("");

  const currentProvider = PROVIDERS.find((p) => p.value === provider)!;

  const applyConfig = () => {
    const chosenModel = customModel.trim() || model;
    llmClient.updateConfig({ provider, model: chosenModel });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>AI Provider</Text>

        {/* Provider selector */}
        <View style={styles.card}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.option, provider === p.value && styles.optionActive]}
              onPress={() => {
                setProvider(p.value);
                setModel(p.models[0]!);
                setCustomModel("");
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: provider === p.value }}
            >
              <View style={[styles.radio, provider === p.value && styles.radioActive]} />
              <Text style={[styles.optionText, provider === p.value && styles.optionTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Model</Text>

        <View style={styles.card}>
          {currentProvider.models.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.option, model === m && !customModel && styles.optionActive]}
              onPress={() => {
                setModel(m);
                setCustomModel("");
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: model === m && !customModel }}
            >
              <View style={[styles.radio, model === m && !customModel && styles.radioActive]} />
              <Text style={[styles.optionText, model === m && !customModel && styles.optionTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Custom model input */}
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>Custom model name</Text>
            <TextInput
              style={styles.customInput}
              value={customModel}
              onChangeText={setCustomModel}
              placeholder="e.g. gpt-4-turbo, codellama"
              placeholderTextColor="#3a3a4a"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Ollama note */}
        {provider === "ollama" && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🖥  Ollama must be running locally. Default URL:{"\n"}
              http://localhost:11434{"\n\n"}
              Set OLLAMA_BASE_URL in .env to change it.
            </Text>
          </View>
        )}

        {/* Apply button */}
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={applyConfig}
          accessibilityRole="button"
        >
          <Text style={styles.applyBtnText}>Apply & Close</Text>
        </TouchableOpacity>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>ADAMS</Text>
          <Text style={styles.aboutSubtitle}>{APP_FULL_NAME}</Text>
          <Text style={styles.aboutVersion}>v1.0.0 · Expo SDK 55 · React Native 0.79</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4a4a5a",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 4,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  card: {
    backgroundColor: "#111118",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a24",
  },
  optionActive: {
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#3a3a4a",
  },
  radioActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
  },
  optionText: {
    fontSize: 15,
    color: "#6b6b80",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  optionTextActive: {
    color: "#e8e8f0",
  },
  customRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customLabel: {
    fontSize: 11,
    color: "#4a4a5a",
    marginBottom: 6,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  customInput: {
    backgroundColor: "#1a1a24",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#e8e8f0",
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none", fontFamily: "system-ui, sans-serif" } as object)
      : {}),
  },
  infoBox: {
    backgroundColor: "rgba(59,130,246,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    color: "#6b8ff0",
    lineHeight: 18,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  applyBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  about: {
    alignItems: "center",
    marginTop: 32,
    gap: 4,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#3b82f6",
    letterSpacing: 6,
  },
  aboutSubtitle: {
    fontSize: 11,
    color: "#3a3a4a",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  aboutVersion: {
    fontSize: 10,
    color: "#2a2a3a",
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
});

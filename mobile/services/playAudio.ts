import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export async function playAudio(uri: string) {
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
}

export async function playAudioFromBase64(base64: string, extension = "mp3") {
  const outputPath = `${FileSystem.cacheDirectory}voice-reply-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(outputPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await playAudio(outputPath);
}
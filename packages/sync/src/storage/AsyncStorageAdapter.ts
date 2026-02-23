// AsyncStorage adapter for React Native
import AsyncStorage from "@react-native-async-storage/async-storage";

export class AsyncStorageAdapter {
  private prefix = "novaconnect_";

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(this.getKey(key));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("AsyncStorage get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (error) {
      console.error("AsyncStorage set error:", error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error("AsyncStorage remove error:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const novaConnectKeys = keys.filter((key) => key.startsWith(this.prefix));
      await AsyncStorage.multiRemove(novaConnectKeys);
    } catch (error) {
      console.error("AsyncStorage clear error:", error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => key.slice(this.prefix.length));
    } catch (error) {
      console.error("AsyncStorage keys error:", error);
      return [];
    }
  }
}

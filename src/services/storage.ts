export class StorageService {
  static get<T>(key: string): T[] {
    const data = localStorage.getItem(key);

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as T[];
    } catch {
      return [];
    }
  }

  static save<T>(key: string, value: T[]): void {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  }

  static clear(key: string): void {
    localStorage.removeItem(key);
  }
}

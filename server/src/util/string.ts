export abstract class StringUtil {
    public static isNullOrWhitespace (value: string | null | undefined) {
        return value == null || value.trim().length === 0;
    }
}
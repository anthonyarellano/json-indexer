import { BaseType, RequiredAdditionalKeys } from "./types";

export class JsonIndexer<T extends { id: string, filePosition: number, length: number }> {
    file: File;
    key: string;
    additionalIndexKeys: Array<RequiredAdditionalKeys<T>>;
    chunkSize: number;

    constructor(file: File, key: string, additionalIndexKeys: Array<RequiredAdditionalKeys<T>>, chunkSize = 1024 * 1024) {
      const missingKeys = this.getMissingKeys(additionalIndexKeys);
      if (missingKeys.length > 0) {
        throw new Error(`Missing keys in additionalIndexKeys: ${missingKeys.join(", ")}`);
      }
      this.file = file;
      this.key = `"${key}":`;
      this.chunkSize = chunkSize;
      this.additionalIndexKeys = additionalIndexKeys;
    }

    private getMissingKeys(additionalIndexKeys: Array<keyof T>): Array<keyof T> {
      const allRequiredKeys: Array<RequiredAdditionalKeys<T>> = Object.keys({} as T).filter(
        (key) => !['id', 'filePosition', 'length'].includes(key as keyof BaseType)
      ) as Array<RequiredAdditionalKeys<T>>;
  
      return allRequiredKeys.filter((key) => !additionalIndexKeys.includes(key));
    }

    private extractAdditionalProperties(record: any): Partial<T> {
      const additionalProperties: Partial<T> = {};
      for (const key of this.additionalIndexKeys) {
        if (key in record) {
          additionalProperties[key] = record[key];
        }
      }
      return additionalProperties;
    }

    async index(): Promise<Map<string, T>> {
      let offset = 0;
      let buffer = '';
      const index = new Map<string, T>();
      let inArray = false;
      let contentPosition = 0;

      while (offset < this.file.size) {
        const chunk = this.file.slice(offset, offset + this.chunkSize);
        let text = await chunk.text();
        console.log(text);
        buffer += text;

        if (!inArray && buffer.includes(this.key)) {
          inArray = true;
          const arrayStart = buffer.indexOf('[', buffer.indexOf(this.key));
          contentPosition = offset + arrayStart;
          buffer = buffer.slice(arrayStart);
        }

        if (inArray) {
          let bracketCount = 0;
          let startPos = 0;

          for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            
            if (char === "{") {
              if (bracketCount === 0) startPos = i;
              bracketCount++;
            } else if (char === "}") {
              bracketCount--;
              if (bracketCount === 0) {
                const recordStr = buffer.substring(startPos, i + 1);
                try {
                  const record: T = JSON.parse(recordStr);
                  index.set(record.id, {
                    id: record.id,
                    filePosition: contentPosition + startPos,
                    length: recordStr.length,
                    ...this.extractAdditionalProperties(record)
                  } as T);
                } catch (e) {
                  console.error('Failed to parse record:', e);
                }
              }
            }
          }
          const lastOpenBracket = buffer.lastIndexOf('{');
          if (lastOpenBracket !== -1) {
            contentPosition += lastOpenBracket;
            buffer = buffer.slice(lastOpenBracket);
          } else {
            buffer = '';
          }
        }
  
        offset += this.chunkSize;
      }
      return index;
    }
}

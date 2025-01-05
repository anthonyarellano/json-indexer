import { BaseType, RequiredAdditionalKeys } from "./types";

/**
 * A utility class for efficiently indexing large JSON files by creating a memory-efficient index
 * of object positions within the file. This allows for fast random access to specific records
 * without loading the entire file into memory.
 *
 * @example
 * interface UserRecord {
 *   id: string;
 *   filePosition: number;
 *   length: number;
 *   name: string;
 *   email: string;
 * }
 *
 * const file = new File([...], 'users.json');
 * const indexer = new JsonIndexer(file);
 * const index = await indexer.index<UserRecord>('users', ['name', 'email']);
 */
export class JsonIndexer {
    /**
    * The File object representing the JSON file to be indexed
    */
    file: File;
  
    /**
    * Size of chunks to read from the file at a time, defaults to 1MB
    */
    chunkSize: number;

    /**
    * Creates a new instance of JsonIndexer
    *
    * @param file - The File object containing the JSON data to be indexed
    * @param chunkSize - Size of chunks to read from the file at a time (in bytes), defaults to 1MB
    */
    constructor(file: File, chunkSize = 1024 * 1024) {
      this.file = file;
      this.chunkSize = chunkSize;
    }

    /**
    * Gets an array of keys that are required by type T but missing from additionalIndexKeys
    *
    * @private
    * @template T - Type extending the base requirements of having an id, filePosition, and length
    * @param additionalIndexKeys - Array of keys to check against required keys
    * @returns Array of missing required keys
    */
    private getMissingKeys<T extends { id: string, filePosition: number, length: number }>(additionalIndexKeys: Array<keyof T>): Array<keyof T> {
      const allRequiredKeys: Array<RequiredAdditionalKeys<T>> = Object.keys({} as T).filter(
        (key) => !['id', 'filePosition', 'length'].includes(key as keyof BaseType)
      ) as Array<RequiredAdditionalKeys<T>>;
  
      return allRequiredKeys.filter((key) => !additionalIndexKeys.includes(key));
    }

    /**
    * Extracts additional properties specified in additionalIndexKeys from a record
    *
    * @private
    * @template T - Type extending the base requirements of having an id, filePosition, and length
    * @param record - The record to extract properties from
    * @param additionalIndexKeys - Array of keys to extract from the record
    * @returns Object containing only the specified additional properties
    */
    private extractAdditionalProperties<T extends { id: string, filePosition: number, length: number }>(record: any, additionalIndexKeys: Array<RequiredAdditionalKeys<T>>): Partial<T> {
      const additionalProperties: Partial<T> = {};
      for (const key of additionalIndexKeys) {
        if (key in record) {
          additionalProperties[key] = record[key];
        }
      }
      return additionalProperties;
    }

    /**
    * Creates an index of all records in the file, storing their positions and additional properties.
    * The index is created by streaming the file in chunks and parsing JSON objects as they are
    * encountered. This allows for efficient processing of large files without loading them entirely
    * into memory.
    *
    * @template T - Type extending the base requirements of having an id, filePosition, and length
    * @param key - The key in the JSON file that contains the array of records
    * @param additionalIndexKeys - Array of additional keys from the record type that should be included in the index
    * @throws {Error} If any required additional keys are missing from additionalIndexKeys
    * @returns Promise resolving to a Map where keys are record IDs and values are objects containing
    *          the record's file position, length, and any additional indexed properties
    *
    * @example
    * interface UserRecord {
    *   id: string;
    *   filePosition: number;
    *   length: number;
    *   name: string;
    * }
    * 
    * const index = await indexer.index<UserRecord>('users', ['name']);
    * // Index entry format:
    * // {
    * //   id: string,
    * //   filePosition: number, // position in file where record starts
    * //   length: number,      // length of record in bytes
    * //   name: string        // additional indexed property
    * // }
    */
    async index<T extends { id: string, filePosition: number, length: number }>(key: string, additionalIndexKeys: Array<RequiredAdditionalKeys<T>> = []): Promise<Map<string, T>> {
      const missingKeys = this.getMissingKeys<T>(additionalIndexKeys);
      if (missingKeys.length > 0) {
        throw new Error(`Missing keys in additionalIndexKeys: ${missingKeys.join(", ")}`);
      }

      const arrayKey = `"${key}":`;  
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

        if (!inArray && buffer.includes(arrayKey)) {
          inArray = true;
          const arrayStart = buffer.indexOf('[', buffer.indexOf(arrayKey));
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
                    ...this.extractAdditionalProperties<T>(record, additionalIndexKeys)
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

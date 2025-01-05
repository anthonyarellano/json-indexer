# json-indexer

json-indexer is a TypeScript utility for efficient indexing of large JSON files. It allows you to parse files incrementally, minimizing memory usage while building a structured index for quick access to objects. This is particularly useful for scenarios where you need to work with massive JSON files containing arrays of objects.

## Features

- Efficient Parsing: Reads JSON files in chunks to handle large files without loading the entire content into memory.
- Customizable Indexing: Allows you to define additional keys to include in the index.
- Scalable: Suitable for large-scale data processing.
- Type-Safe: Leverages TypeScript for strong typing and compile-time safety.

## Installation

Install the package via npm:
```
npm install json-indexer
```

## Usage

### Example

Suppose you have a large JSON file (data.json) with the following structure:

```json
{
  "shoes": [
    { "id": "1", "name": "Nike Air", "size": 42, "color": "black" },
    { "id": "2", "name": "Adidas Boost", "size": 43, "color": "white" },
    ...
  ]
}
```

You can use *json-indexer* to parse and index the `shoes` array like this:

```typescript
import { JsonIndexer } from 'json-indexer';

// Your data type
interface Shoe {
    id: string;
    name: string;
    size: number;
    color: string;
}

// The resulting indexed data type
interface ShoeMetadata {
    // id, filePosition, and length are required
    id: string;
    filePosition: number;
    length: number;

    // Extra keys that should be added to the index
    name: string;
    size: number;
}

// Assume `file` is a File object representing your JSON file
const file = new File([/* file content */], "data.json", { 
  type: "application/json" 
});

// Create an instance of JsonIndexer
const indexer = new JsonIndexer(file);

// Build the index with additional properties
const shoeIndex = await indexer.index<ShoeMetadata>("shoes", ["name", "size"]);
/**
 * Output:
 * Map {
 *   "1" => { 
 *     id: "1",
 *     filePosition: 123,
 *     length: 456,
 *     name: "Nike Air",
 *     size: 42,
 *   },
 *   "2" => { ... }
 * }
 **/

// Subsequent lookups
const metadata = shoeIndex.get('1');
if (metadata) {
    const chunk = file.slice(
        metadata.filePosition,
        metadata.filePosition + metadata.length
    );
    const record = JSON.parse(await chunk.text());
}
```

## API Reference

### `JsonIndexer<T>`

A class for indexing JSON files.

#### Constructor

```typescript
constructor(file: File, chunkSize = 1024 * 1024)
```

- `file` (`File`): The JSON file to index.
- `chunkSize` (`number`, __optional__): Size of each chunk read from the file (default: 1 MB).

#### Methods
`index<T>`

```typescript
async index<T extends { id: string, filePosition: number, length: number }>(
    key: string,
    additionalIndexKeys: Array<RequiredAdditionalKeys<T>> = []
): Promise<Map<string, T>>
```

- Generic type T must extend the base type containing `id`, `filePosition`, and `length`.
- `key` (`string`): The key of the array to index (e.g., `"shoes"`).
- `additionalIndexKeys` (`Array<keyof T>`): Keys to include in the index, beyond the base requirements.
- Returns a `Promise` resolving to a `Map` where the keys are the `id` values of the indexed objects, and the values are the indexed objects with metadata

## Benefits
- __Memory Efficient__: Processes the file in chunks, avoiding high memory usage.
- __Incremental Parsing__: Supports working with large files incrementally.
- __Customizable Metadata__: Add aditional fields to the index for detailed object representation.
- __Flexible Type System__: Generic type parameters at the method level for improved type safety and reusability

## Error Handling

If you forget to include all required keys in `additionalIndexKeys`, the `index()` method will throw an error:

```typescript
// This will throw an error because 'name' is required by the ShoeMetadata type
const index = await indexer.index<ShoeMetadata>("shoes", []);
// Error: Missing keys in additionalIndexKeys: name
```

## License 

This project is licensed under the MIT License.

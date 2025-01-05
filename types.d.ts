export type BaseType = { id: string; filePosition: number; length: number };

export type RequiredAdditionalKeys<T> = Exclude<keyof T, keyof BaseType>;

export type JsonTransport<Data> = Data extends Date
  ? string
  : Data extends readonly (infer Item)[]
    ? JsonTransport<Item>[]
    : Data extends object
      ? { [Key in keyof Data]: JsonTransport<Data[Key]> }
      : Data;

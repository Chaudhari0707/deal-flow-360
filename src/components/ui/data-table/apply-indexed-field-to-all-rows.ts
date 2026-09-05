import type {
  FieldPath,
  FieldValues,
  PathValue,
  UseFormGetValues,
  UseFormSetValue,
} from "react-hook-form";

type ApplyIndexedFieldToAllRowsOptions<
  TFieldValues extends FieldValues,
  TListPath extends FieldPath<TFieldValues>,
> = {
  fieldKey: string;
  getValues: UseFormGetValues<TFieldValues>;
  listPath: TListPath;
  setValue: UseFormSetValue<TFieldValues>;
  sourceIndex: number;
};

/**
 * Copies one scalar field from a source row to every other row in a react-hook-form
 * field array (e.g. `variants.0.priceAmount` → all `variants.*.priceAmount`).
 */
export function applyIndexedFieldToAllRows<
  TFieldValues extends FieldValues,
  TListPath extends FieldPath<TFieldValues>,
>({
  fieldKey,
  getValues,
  listPath,
  setValue,
  sourceIndex,
}: ApplyIndexedFieldToAllRowsOptions<TFieldValues, TListPath>): void {
  const rows = getValues(listPath);
  if (!Array.isArray(rows) || rows.length <= 1) {
    return;
  }

  const sourceRow = rows[sourceIndex];
  if (!sourceRow || typeof sourceRow !== "object") {
    return;
  }

  const sourceValue = (sourceRow as Record<string, unknown>)[fieldKey];

  for (let index = 0; index < rows.length; index += 1) {
    if (index === sourceIndex) {
      continue;
    }

    const targetPath = `${listPath}.${index}.${fieldKey}` as FieldPath<TFieldValues>;
    setValue(targetPath, sourceValue as PathValue<TFieldValues, typeof targetPath>, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }
}

export function createApplyIndexedFieldHandler<
  TFieldValues extends FieldValues,
  TListPath extends FieldPath<TFieldValues>,
>(
  getValues: UseFormGetValues<TFieldValues>,
  setValue: UseFormSetValue<TFieldValues>,
  listPath: TListPath,
) {
  return (sourceIndex: number, fieldKey: string) => {
    applyIndexedFieldToAllRows({
      fieldKey,
      getValues,
      listPath,
      setValue,
      sourceIndex,
    });
  };
}

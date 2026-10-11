// Shared by the server, sidebar and the on-disk coverage check.
export const MAX_SEGMENT = 64;
export const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validSegment(segment: string): boolean {
  return segment.length <= MAX_SEGMENT && SEGMENT.test(segment);
}

/** Exactly FAMILY/ENTRY/NAME, without a file extension. */
export function validName(name: string): boolean {
  const parts = name.split("/");
  return parts.length === 3 && parts.every(validSegment);
}

export const familyOf = (name: string): string => name.split("/")[0] ?? "";
export const entryOf = (name: string): string => name.split("/").slice(0, 2).join("/");
export const leafOf = (name: string): string => name.split("/").at(-1) ?? "";

/** Numbered folders precede other folders; equal numbers use the full name. */
export function compareFolders(a: string, b: string): number {
  const number = (name: string): bigint | undefined => {
    const prefix = /^(\d+)-/.exec(name)?.[1];
    return prefix === undefined ? undefined : BigInt(prefix);
  };
  const left = number(a);
  const right = number(b);
  if (left !== undefined && right !== undefined && left !== right) return left < right ? -1 : 1;
  if (left !== undefined && right === undefined) return -1;
  if (right !== undefined && left === undefined) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareNames(a: string, b: string): number {
  return compareFolders(familyOf(a), familyOf(b)) ||
    compareFolders(a.split("/")[1] ?? "", b.split("/")[1] ?? "") ||
    (leafOf(a) < leafOf(b) ? -1 : leafOf(a) > leafOf(b) ? 1 : 0);
}

export function folderLabel(name: string): string {
  const words = name.replace(/^\d+-/, "").replace(/-and-/g, " & ").replace(/-/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

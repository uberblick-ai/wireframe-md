/** Text labels pair single backticks from the left; longer runs stay literal. */
export function* textRuns(label: string): Generator<{ text: string; mono: boolean }> {
  let start = 0;
  let opening: number | undefined;
  for (const match of label.matchAll(/`+/g)) {
    if (match[0].length !== 1) continue;
    if (opening === undefined) opening = match.index;
    else {
      if (opening > start) yield { text: label.slice(start, opening), mono: false };
      yield { text: label.slice(opening + 1, match.index), mono: true };
      start = match.index + 1;
      opening = undefined;
    }
  }
  if (start < label.length) yield { text: label.slice(start), mono: false };
}

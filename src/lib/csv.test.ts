import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes cells, escapes quotes and blocks spreadsheet formulas", () => {
    const csv = toCsv([["Name", "Note"], ['Dika "D"', "=HYPERLINK(1)"], [null, 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(['"Name","Note"', '"Dika ""D""","\'=HYPERLINK(1)"', '"","3"']);
  });
});

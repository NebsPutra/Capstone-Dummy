import { expect, it } from "vitest";
import { withMissingVillages } from "./wilayah";

const fromApi = [
  { id: "3173020003", name: "Cikini" },
  { id: "3173020004", name: "Gondangdia" },
  { id: "3173020005", name: "Kebon Sirih" },
  { id: "3173020002", name: "Pegangsaan" },
];

it("adds Kelurahan Menteng to Kecamatan Menteng (BB-17)", () => {
  const list = withMissingVillages("3173020", fromApi);
  expect(list.map((v) => v.name)).toEqual(["Cikini", "Gondangdia", "Kebon Sirih", "Menteng", "Pegangsaan"]);
  expect(list.find((v) => v.name === "Menteng")?.id).toBe("3173020001");
});

it("doesn't duplicate once the API includes it, and leaves other areas alone", () => {
  const fixed = [...fromApi, { id: "3173020001", name: "Menteng" }];
  expect(withMissingVillages("3173020", fixed)).toHaveLength(5);
  expect(withMissingVillages("3173010", fromApi)).toBe(fromApi);
});

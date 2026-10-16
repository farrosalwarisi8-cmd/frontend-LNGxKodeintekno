import { describe, it, expect } from "vitest";
import {
  isSoapDraftEmpty,
  parseSoapDraft,
  serializeSoapDraft,
  soapDraftKey,
  soapDraftLabel,
  type SoapDraft,
} from "../soap-draft";

const draft: SoapDraft = {
  visitId: "v-1",
  subjective: "Demam tiga hari",
  objective: "Suhu 38,2",
  assessment: "Suspek dengue",
  plan: "Cek lab, istirahat",
  diagnosisIds: ["icd-1"],
  savedAt: "2026-10-16T02:00:00.000Z",
};

describe("soapDraftKey", () => {
  it("is unique per visit", () => {
    expect(soapDraftKey("v-1")).toBe("emr-soap-draft:v-1");
    expect(soapDraftKey("v-1")).not.toBe(soapDraftKey("v-2"));
  });
});

describe("parseSoapDraft", () => {
  it("round-trips a stored draft", () => {
    expect(parseSoapDraft(serializeSoapDraft(draft))).toEqual(draft);
  });

  it("rejects broken or structurally invalid payloads", () => {
    expect(parseSoapDraft(null)).toBeNull();
    expect(parseSoapDraft("")).toBeNull();
    expect(parseSoapDraft("{bukan json")).toBeNull();
    expect(parseSoapDraft('"teks"')).toBeNull();
    expect(parseSoapDraft('{"subjective":"x"}')).toBeNull(); // tanpa visitId/savedAt
  });

  it("coerces missing fields instead of failing", () => {
    const parsed = parseSoapDraft('{"visitId":"v-9","savedAt":"2026-01-01T00:00:00Z"}');
    expect(parsed).toEqual({
      visitId: "v-9",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      diagnosisIds: [],
      savedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("drops non-string diagnosis ids", () => {
    const parsed = parseSoapDraft(
      '{"visitId":"v-9","savedAt":"2026-01-01T00:00:00Z","diagnosisIds":["a",2,null]}'
    );
    expect(parsed?.diagnosisIds).toEqual(["a"]);
  });
});

describe("isSoapDraftEmpty", () => {
  it("is true when nothing was typed", () => {
    expect(
      isSoapDraftEmpty({
        subjective: "  ",
        objective: "",
        assessment: "",
        plan: "",
        diagnosisIds: [],
      })
    ).toBe(true);
  });

  it("is false as soon as one field or diagnosis is filled", () => {
    expect(
      isSoapDraftEmpty({ subjective: "Batuk", objective: "", assessment: "", plan: "", diagnosisIds: [] })
    ).toBe(false);
    expect(
      isSoapDraftEmpty({
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        diagnosisIds: ["icd-1"],
      })
    ).toBe(false);
  });
});

describe("soapDraftLabel", () => {
  it("says autosave is on when there is no timestamp yet", () => {
    expect(soapDraftLabel(null)).toBe("Draft tersimpan otomatis");
  });

  it("includes the save time once saved", () => {
    expect(soapDraftLabel("2026-10-16T02:00:00.000Z")).toMatch(/Draft tersimpan otomatis \d{2}[:.]\d{2}/);
  });
});
